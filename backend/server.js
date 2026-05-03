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
const PORT = 5000;
const LOG_FILE = "/var/log/auth.log"; 
const BLOCKED_IPS_FILE = "./blocked_ips.json";
const JWT_SECRET = "your_super_secret_loglens_key"; 

const CLF_REGEX = /^(\S+) \S+ \S+ \[([\w:/]+\s[+\-]\d{4})\] "(\S+)\s?(\S+)?\s?(\S+)?" (\d{3}) (\d+|-)/;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // This allows the React app to connect even if the ports shift
    methods: ["GET", "POST"]
  }
});

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ DATABASE_CONNECTED (MongoDB)");

// 1. MUST BE FIRST: Open CORS to everyone for the submission
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. MUST BE SECOND: Parse JSON
app.use(express.json());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // start server here
    app.listen(5000, () => {
      console.log("🚀 LOGLENS ENGINE RUNNING ON PORT 5000");
    });
  })
  .catch(err => {
    console.error("❌ DATABASE_CONNECTION_ERROR", err);
  });

// Setup Multi-part form handling for uploads
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
    severity: parsedData.severity.charAt(0).toUpperCase() + parsedData.severity.slice(1), // Changes 'high' to 'High'
    abuseScore: score,
    rawLog: parsedData.rawLog,
    isBlocked: parsedData.severity === "high"
});

        await threat.save();

        if (parsedData.severity === "high") {
            const title = `🚨 LogLens Alert: ${parsedData.type}`;
            const body = `IP: ${parsedData.ip} (${parsedData.country})\nScore: ${score}%\nStatus: BLOCKED`;
            
            exec(`notify-send -u critical -i security-high "${title}" "${body}"`);
            exec(`paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga`);
            
            blockIP(parsedData.ip);
        }

        // Broadast to NEW_THREAT (charts) and new-log (terminal)
// Ensure the severity sent to the frontend is exactly what the chart expects
// Force every possible format for the chart to catch
const payload = {
    ...parsedData,
    severity: parsedData.severity.charAt(0).toUpperCase() + parsedData.severity.slice(1), // "High"
    sev: parsedData.severity.toLowerCase(), // "high"
    level: parsedData.severity.toLowerCase(), // "high" (some charts use 'level')
    abuseScore: Number(score) || 0,
    value: 1 // Some pie charts need a 'value' key to draw the slice
};

// Send to every possible event name the frontend might listen to
io.emit("new-log", payload);
io.emit("NEW_THREAT", payload);
io.emit("threat-alert", payload);
io.emit("message", payload);
        if (visitorHistory.size > 1000) visitorHistory.clear();

    } catch (err) {
        console.error("❌ DB Storage Error:", err);
    }
};

// --- 6. LIVE LOG WATCHER ---
if (fs.existsSync(LOG_FILE)) {
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

// --- 7. ROUTES (FIXED FOR FRONTEND COMPATIBILITY) ---

// Handle all three names the dashboard is looking for
const getThreatHistory = async (req, res) => {
    try {
        const threats = await Threat.find().sort({ timestamp: -1 }).limit(100);
        res.json(threats);
    } catch (err) {
        console.error("❌ DB Fetch Error:", err);
        res.status(500).json({ error: "Could not fetch threat data" });
    }
};

app.get("/api/history", getThreatHistory); // Original route
app.get("/live-logs", getThreatHistory);   // Alias for logs
app.get("/demo", getThreatHistory);        // Alias for "Load Intel" button
app.get('/', (req, res) => {
  res.send('LogLens API is Running');
});

// 📂 NEW: LOG UPLOAD HANDLER
app.post("/upload", upload.single("logfile"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    // Use an absolute path to avoid confusion
    const filePath = path.resolve(req.file.path);
    
    const rl = readline.createInterface({ 
        input: fs.createReadStream(filePath) 
    });
    
    rl.on("line", (line) => {
        const parsed = parseLine(line);
        if (parsed) processThreat(parsed);
    });

    rl.on("close", () => {
        // Cleanup: delete the temp file after processing
        fs.unlinkSync(filePath); 
    });

    res.json({ success: true, message: "Log processing started!" });
});

// 📊 NEW: LIVE-LOGS ALIAS (Fixes Empty Dashboard)
app.get("/live-logs", async (req, res) => {
    const threats = await Threat.find().sort({ _id: -1 }).limit(100);
    
    // Force capitalization on the history pull too
    const formattedThreats = threats.map(t => ({
        ...t._doc,
        severity: t.severity.charAt(0).toUpperCase() + t.severity.slice(1)
    }));
    
    res.json(formattedThreats);
});

app.post("/api/unblock", async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });

    exec(`sudo iptables -D INPUT -s ${ip} -j DROP`, async (err) => {
        if (err) return res.status(500).json({ error: "Firewall removal failed" });
        await Threat.updateMany({ ip: ip }, { isBlocked: false });
        removeBlockedIP(ip);
        res.json({ success: true, message: `IP ${ip} unblocked.` });
    });
});

app.post("/api/block-ip", (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP required" });
    blockIP(ip);
    res.json({ success: true, message: `IP ${ip} blocked.` });
});

app.get("/api/history", async (req, res) => {
    try {
        const threats = await Threat.find().sort({ timestamp: -1 });
        
        // Some dashboards expect a "data" or "threats" wrapper
        res.json({
            success: true,
            count: threats.length,
            data: threats, // The array of 64 items
            severityCounts: {
                High: threats.filter(t => t.severity === 'High').length,
                Medium: threats.filter(t => t.severity === 'Medium').length,
                Low: threats.filter(t => t.severity === 'Low').length
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "password123") {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: "2h" });
    return res.json({ success: true, token });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

// This matches exactly what your frontend is calling
app.get("/demo", async (req, res) => {
    try {
        const threats = await Threat.find().sort({ timestamp: -1 });
        
        const mappedData = threats.map(t => ({
            ...t._doc,
            // Ensure the key 'severity' is exactly what the Pie Chart looks for
            severity: t.severity ? (t.severity.charAt(0).toUpperCase() + t.severity.slice(1)) : "Low",
            abuseScore: Number(t.abuseScore) || 0
        }));

        // We send it in all common formats to "force" the frontend to find the array
        res.status(200).json({
            success: true,
            data: mappedData,     // Format A
            threats: mappedData,  // Format B
            logs: mappedData,     // Format C
            results: mappedData   // Format D
        });
    } catch (err) {
        res.status(500).json({ success: false, data: [] });
    }
});

server.listen(PORT, () => {
  console.log(`✅ LOGLENS ENGINE RUNNING ON PORT ${PORT}`);
  console.log(`🛡️ PERSISTENT BLOCKS LOADED: ${getBlockedIPs().length}`);
});
