const geoip = require("geoip-lite");
const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const readline = require("readline");
const axios = require("axios");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { 
    origin: "https://log-lens-gtyb8spak-rockyycs-projects-3b259ed7.vercel.app",
    methods: ["GET", "POST"],
    credentials: true 
  }
});

// ================= CONFIG =================
const PORT = process.env.PORT || 5000;
const ABUSE_IPDB_KEY = "YOUR_API_KEY"; // Replace with your actual key
const upload = multer({ dest: "uploads/" });

// ================= MIDDLEWARE =================
app.use(cors({ 
  origin: ["https://log-lens-gtyb8spak-rockyycs-projects-3b259ed7.vercel.app", "http://localhost:3000"],
  credentials: true 
}));
app.use(express.json());

// ================= DB =================
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/loglens")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

// ================= HELPERS =================

// 🔥 SMART PARSER WITH ATTACK DETECTION
function parseLine(line) {
  if (!line) return null;

  const ipMatch = line.match(/\d+\.\d+\.\d+\.\d+/);
  if (!ipMatch) return null;

  const lower = line.toLowerCase();

  let attackType = "NORMAL";
  let severity = "low";

  // 🔥 ATTACK DETECTION
  if (lower.includes("union") || lower.includes("select") || lower.includes("sql")) {
    attackType = "SQL_INJECTION";
    severity = "high";
  }
  else if (lower.includes("<script") || lower.includes("xss")) {
    attackType = "XSS";
    severity = "high";
  }
  else if (lower.includes("login") || lower.includes("failed")) {
    attackType = "BRUTE_FORCE";
    severity = "medium";
  }
  else if (lower.includes("../")) {
    attackType = "PATH_TRAVERSAL";
    severity = "high";
  }
  else if (lower.includes("error")) {
    attackType = "ERROR";
    severity = "medium";
  }

  // 🌍 GEO LOCATION
  const geo = geoip.lookup(ipMatch[0]);

  return {
    ip: ipMatch[0],
    country: geo?.country || "Global",
    severity,
    type: attackType,
    rawLog: line,
  };
}

// 🔥 Abuse IP (optional)
async function checkAbuseScore(ip) {
  if (!ABUSE_IPDB_KEY || ABUSE_IPDB_KEY === "YOUR_API_KEY") return 0;

  try {
    const res = await axios.get("https://api.abuseipdb.com/api/v2/check", {
      params: { ipAddress: ip, maxAgeInDays: 90 },
      headers: { Key: ABUSE_IPDB_KEY, Accept: "application/json" }
    });

    return res.data.data.abuseConfidenceScore;
  } catch {
    return 0;
  }
}

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);
});

// ================= ROUTES =================

app.get("/", (req, res) => {
  res.send("LogLens API Running");
});

// 🔥 FINAL UPLOAD HANDLER
const handleUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = path.resolve(req.file.path);
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream });

  let total = 0;
  let ips = [];
  let sev_data = { high: 0, medium: 0, low: 0 };
  let attackTypes = {};
  let timeline = {};   // 👈 ADD HERE

console.log("📂 Processing file...");


try {
  for await (const line of rl) {
    total++;

    // ✅ TIMELINE FIX (ADD THIS)
    const timeMatch = line.match(/\d{2}:\d{2}:\d{2}/);
    const timeKey = timeMatch ? timeMatch[0].slice(0, 5) : "00:00";
    timeline[timeKey] = (timeline[timeKey] || 0) + 1;

    const parsed = parseLine(line);
    if (!parsed) continue;

    const score = await checkAbuseScore(parsed.ip);
    parsed.abuseScore = score;

    ips.push(parsed);

    // ✅ SEVERITY COUNT (SAFE)
    const sev = parsed.severity || "low";
    if (sev_data[sev] !== undefined) {
      sev_data[sev]++;
    }

    // ✅ VECTOR COUNT (OPTIONAL BUT FIXES "Unknown")
    attackTypes[parsed.type || "unknown"] =
      (attackTypes[parsed.type || "unknown"] || 0) + 1;

    io.emit("new-log", parsed);
  }

  // ✅ TIMELINE ARRAY (ADD THIS AFTER LOOP)
  const timelineArr = Object.entries(timeline).map(([time, val]) => ({
    time,
    val
  }));

  // ✅ TOP VECTOR
  const top = Object.keys(attackTypes).length
    ? Object.keys(attackTypes).reduce((a, b) =>
        attackTypes[a] > attackTypes[b] ? a : b
      )
    : "Unknown";

  // ✅ SCORE
  const score =
    sev_data.high > 10 ? "HIGH" :
    sev_data.medium > 5 ? "MEDIUM" :
    "LOW";

  console.log("✅ Done");

  res.json({
    total,
    threats: ips.length,
    ips,
    sev_data,
    timeline: timelineArr,   // 🔥 FIXED
    top,
    score
  });

} catch (err) {
  console.error(err);
  res.status(500).json({ error: "Processing failed" });
}
};

// SUPPORT BOTH ROUTES
app.post("/upload", upload.single("logfile"), handleUpload);
app.post("/analyze", upload.single("file"), handleUpload);

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
