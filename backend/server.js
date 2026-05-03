const geoip = require("geoip-lite");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const path = require("path"); 
const { exec } = require("child_process");
const jwt = require("jsonwebtoken");
const readline = require("readline");
const axios = require('axios');
const mongoose = require('mongoose');
const Threat = require('./models/Threat');

// --- 1. CONFIGURATION & INITIALIZATION ---
const ABUSE_IPDB_KEY = "4241a4c973943dc551bd9e1578248be113ef61e4952bb53d849bd1d6a849ed5f25a8285e407a2fbc";
const BANNED_COUNTRIES = ['CN', 'RU', 'KP']; 
const app = express();

const LOG_FILE = fs.existsSync("/var/log/auth.log") ? "/var/log/auth.log" : null; 
const BLOCKED_IPS_FILE = "./blocked_ips.json";
const JWT_SECRET = "your_super_secret_loglens_key"; 

const CLF_REGEX = /^(\S+) \S+ \S+ \[([\w:/]+\s[+\-]\d{4})\] "(\S+)\s?(\S+)?\s?(\S+)?" (\d{3}) (\d+|-)/;

const io = new Server(server, {
  cors: {
    origin: ["https://log-lens-p4a434btw-rockyycs-projects-3b259ed7.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/loglens')
  .then(() => {
    console.log("✅ DATABASE_CONNECTED (MongoDB)");
  })
  .catch(err => {
    console.error("❌ DATABASE_CONNECTION_ERROR", err);
  });

// --- MIDDLEWARE ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: "uploads/" });

// Load Security Signatures
let signatures = [];
try {
    if (fs.existsSync("./signatures.json")) {
        signatures = JSON.parse(fs.readFileSync("./signatures.json", "utf8"));
    } else {
        signatures = [
            { name: "SQL_INJECTION", pattern: "(select|union|insert|--|' OR '1'='1')", severity: "high" },
            { name: "PATH_TRAVERSAL", pattern: "(\\.\\.\\/|\\/etc\\/|\\.env)", severity: "high" }
        ];
    }
} catch (err) { console.error("❌ Error loading signatures.json"); }

// --- 2. PERSISTENCE HELPERS ---
function getBlockedIPs() {
    if (!fs.existsSync(BLOCKED_IPS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(BLOCKED_IPS_FILE, "utf8"));
    } catch (e) { return []; }
}

function saveBlockedIP(ip) {
    const list = getBlockedIPs();
    if (!list.includes(ip)) {
        list.push(ip);
        fs.writeFileSync(BLOCKED_IPS_FILE, JSON.stringify(list, null, 2));
    }
}

function removeBlockedIP(ip) {
    let list = getBlockedIPs();
    list = list.filter(item => item !== ip);
    fs.writeFileSync(BLOCKED_IPS_FILE, JSON.stringify(list, null, 2));
}

// --- 3. CORE LOG PARSER ENGINE ---
function parseLine(line) {
  if (!line.trim()) return null;

  let logIP, logStatus, logPath; 
  const match = line.match(CLF_REGEX);

  if (match) {
    const [_, ip, timestamp, method, urlPath, protocol, status, size] = match;
    logIP = ip;
    logStatus = parseInt(status);
    logPath = urlPath;
  } else {
    const ipMatch = line.match(/\d+\.\d+\.\d+\.\d+/);
    if (!ipMatch) return null;
    logIP = ipMatch[0];
    logStatus = line.match(/\s(\d{3})\s/) ? parseInt(line.match(/\s(\d{3})\s/)[1]) : 200;
    logPath = "unknown";
  }

  const geo = geoip.lookup(logIP);
  const country = geo ? geo.country : "Global";

  let threatType = "CLEAN";
  let severity = "low";

  for (const sig of signatures) {
    const regex = new RegExp(sig.pattern, "i");
    if (regex.test(line)) {
      threatType = sig.name;
      severity = sig.severity;
      break; 
    }
  }

  if (threatType === "CLEAN" && logStatus >= 400) {
    threatType = "ACCESS_DENIED";
    severity = "medium";
  }

  return {
    ip: logIP,
    country,
    timestamp: new Date().toISOString(),
    status: logStatus,
    path: logPath, 
    type: threatType,
    severity,
    rawLog: line
  };
}

// --- 4. ACTIVE DEFENSE (FIREWALL) ---
function blockIP(ip) {
    if (ip === '127.0.0.1' || ip === 'localhost' || !ip) return;
    
    if (process.env.NODE_ENV === 'production') {
        console.log(`☁️ CLOUD_MODE: Logging block for ${ip} (iptables skipped)`);
        saveBlockedIP(ip);
        return;
    }

    exec(`sudo iptables -A INPUT -s ${ip} -j DROP`, (err) => {
        if (!err) {
            console.log(`🛡️ FIREWALL: Dropped traffic from ${ip}`);
            saveBlockedIP(ip);
        } else {
            console.error(`❌ Failed to block ${ip}`);
        }
    });
}

async function checkAbuseScore(ip) {
    try {
        const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
            params: { ipAddress: ip, maxAgeInDays: 90 },
            headers: { 'Key': ABUSE_IPDB_KEY, 'Accept': 'application/json' }
        });
        return response.data.data.abuseConfidenceScore;
    } catch (error) {
        return 0;
    }
}

// --- 5. DETECTION & BEHAVIORAL ANALYSIS ---
const visitorHistory = new Map();

const processThreat = async (parsedData) => {
    try {
        const score = await checkAbuseScore(parsedData.ip);
        const now = Date.now();
        const ip = parsedData.ip;

        if (BANNED_COUNTRIES.includes(parsedData.country)) {
            parsedData.type = "GEO_FENCE_BLOCK";
            parsedData.severity = "high";
        }

        if (!visitorHistory.has(ip)) {
            visitorHistory.set(ip, { count: 1, firstSeen: now });
        } else {
            const stats = visitorHistory.get(ip);
            stats.count += 1;
            if (stats.count > 10 && (now - stats.firstSeen) < 30000) {
                parsedData.type = "BRUTE_FORCE_DETECTED";
                parsedData.severity = "high";
            }
        }

        const threat = new Threat({
            ip: parsedData.ip,
            country: parsedData.country,
            type: parsedData.type,
            severity: parsedData.severity.charAt(0).toUpperCase() + parsedData.severity.slice(1),
            abuseScore: score,
            rawLog: parsedData.rawLog,
            isBlocked: parsedData.severity === "high"
        });

        await threat.save();

        if (parsedData.severity === "high") {
            if (process.env.NODE_ENV !== 'production') {
                const title = `🚨 LogLens Alert: ${parsedData.type}`;
                const body = `IP: ${parsedData.ip} (${parsedData.country})\nScore: ${score}%\nStatus: BLOCKED`;
                exec(`notify-send -u critical -i security-high "${title}" "${body}"`);
                exec(`paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga`);
            }
            blockIP(parsedData.ip);
        }

        const payload = {
            ...parsedData,
            severity: parsedData.severity.charAt(0).toUpperCase() + parsedData.severity.slice(1),
            abuseScore: Number(score) || 0,
            value: 1 
        };

        io.emit("new-log", payload);
        io.emit("NEW_THREAT", payload);

        if (visitorHistory.size > 1000) visitorHistory.clear();

    } catch (err) {
        console.error("❌ Threat Processing Error:", err);
    }
};

// --- 6. LIVE LOG WATCHER ---
if (LOG_FILE && fs.existsSync(LOG_FILE)) {
    console.log(`👁️ Monitoring: ${LOG_FILE}...`);
    fs.watchFile(LOG_FILE, (curr, prev) => {
        if (curr.mtime <= prev.mtime) return;
        const stream = fs.createReadStream(LOG_FILE, { start: prev.size });
        const rl = readline.createInterface({ input: stream });
        rl.on("line", (line) => {
            const parsed = parseLine(line);
            if (parsed) processThreat(parsed);
        });
    });
}

// --- 7. ROUTES ---

app.get('/', (req, res) => {
  res.send('LogLens API is Running');
});

app.get("/api/history", async (req, res) => {
    try {
        const threats = await Threat.find().sort({ timestamp: -1 }).limit(100);
        res.json({ success: true, data: threats });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/demo", async (req, res) => {
    try {
        const threats = await Threat.find().sort({ timestamp: -1 }).limit(100);
        const mappedData = threats.map(t => ({
            ...t._doc,
            severity: t.severity ? (t.severity.charAt(0).toUpperCase() + t.severity.slice(1)) : "Low"
        }));
        res.json({ success: true, data: mappedData, threats: mappedData });
    } catch (err) {
        res.status(500).json({ success: false, data: [] });
    }
});

// --- UPDATED UPLOAD ROUTE ---
app.post("/upload", upload.single("logfile"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const filePath = path.resolve(req.file.path);
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream });

    console.log("📂 File received, starting analysis...");

    for await (const line of rl) {
        const parsed = parseLine(line);
        if (parsed) {
            await processThreat(parsed); 
        }
    }

    fs.unlinkSync(filePath); 
    res.json({ success: true, message: "Analysis Complete!" });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "password123") {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ success: true, token });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

// --- 8. STARTUP & ERROR HANDLING ---

process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('🔥 UNHANDLED REJECTION:', reason);
});

const FINAL_PORT = process.env.PORT || 5000;

server.listen(FINAL_PORT, '0.0.0.0', () => {
    console.log(`✅ LOGLENS ENGINE ONLINE ON PORT ${FINAL_PORT}`);
    console.log(`🛡️ PERSISTENT BLOCKS LOADED: ${getBlockedIPs().length}`);
}).on('error', (err) => {
    console.error('❌ SERVER CRASHED DURING STARTUP:', err);
});
