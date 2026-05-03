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
const { exec } = require("child_process");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

// ================= CONFIG =================
const PORT = process.env.PORT || 5000;
const ABUSE_IPDB_KEY = "YOUR_API_KEY"; // optional
const upload = multer({ dest: "uploads/" });

// ================= MIDDLEWARE =================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ================= DB =================
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/loglens")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

// ================= HELPERS =================
function parseLine(line) {
  if (!line) return null;

  const ipMatch = line.match(/\d+\.\d+\.\d+\.\d+/);
  if (!ipMatch) return null;

  return {
    ip: ipMatch[0],
    country: "Global",
    severity: line.includes("error") ? "high" : "low",
    rawLog: line,
  };
}

async function checkAbuseScore(ip) {
  try {
    const res = await axios.get("https://api.abuseipdb.com/api/v2/check", {
      params: { ipAddress: ip, maxAgeInDays: 90 },
      headers: { Key: ABUSE_IPDB_KEY, Accept: "application/json" },
    });
    return res.data.data.abuseConfidenceScore;
  } catch {
    return 0;
  }
}

// ================= SOCKET =================
io.on("connection", () => {
  console.log("⚡ Client connected");
});

// ================= ROUTES =================

app.get("/", (req, res) => {
  res.send("LogLens API Running");
});

// 🔥 FINAL UPLOAD HANDLER (IMPORTANT)
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

  console.log("📂 Processing file...");

  for await (const line of rl) {
    total++;

    const parsed = parseLine(line);
    if (!parsed) continue;

    const score = await checkAbuseScore(parsed.ip);

    parsed.abuseScore = score;
    ips.push(parsed);

    const sev = parsed.severity || "low";
    if (sev_data[sev] !== undefined) {
      sev_data[sev]++;
    }

    io.emit("new-log", parsed);
  }

  fs.unlinkSync(filePath);

  console.log("✅ Done");

  res.json({
    total,
    threats: ips.length,
    ips,
    sev_data,
  });
};

// ✅ SUPPORT BOTH (VERY IMPORTANT)
app.post("/upload", upload.single("logfile"), handleUpload);
app.post("/analyze", upload.single("file"), handleUpload);

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
