import React, { useEffect, useState, useRef } from "react";

function LiveFeed({ live }) {
  const [logs, setLogs] = useState([]);
  const feedEndRef = useRef(null); // Reference for auto-scroll

  const scrollToBottom = () => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!live) return;

    const fetchLogs = async () => {
      try {
        const res = await fetch("http://localhost:5000/live-logs");
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
        }
      } catch (err) {
        console.error("Live logs error:", err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [live]);

  // Trigger scroll whenever logs update
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
    <div style={{
      background: "#020617",
      padding: "20px",
      borderRadius: "12px",
      border: "1px solid rgba(34, 197, 94, 0.2)",
      height: "300px",
      overflowY: "auto",
      fontFamily: "'Fira Code', monospace",
      fontSize: "0.85rem",
      position: "relative"
    }}>
      <div style={{ position: "sticky", top: 0, background: "#020617", paddingBottom: "10px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "15px" }}>
        <span style={{ color: "#22c55e" }}>root@loglens:~# tail -f /var/log/attacks</span>
        <span style={{ color: live ? "#22c55e" : "#ef4444", fontSize: "0.7rem" }}>
          {live ? "● LIVE" : "○ PAUSED"}
        </span>
      </div>

      {(Array.isArray(logs) ? logs : []).map((log, i) => (
        <div key={i} style={{ marginBottom: "8px", borderLeft: `2px solid ${log.severity === 'high' ? '#ef4444' : '#38bdf8'}`, paddingLeft: "10px" }}>
          <span style={{ color: "#64748b" }}>[{new Date().toLocaleTimeString()}]</span>
          <span style={{ color: "#f8fafc" }}> src=</span><span style={{ color: "#38bdf8" }}>{log.ip}</span>
          <span style={{ color: "#f8fafc" }}> event=</span><span style={{ color: log.severity === 'high' ? '#ef4444' : '#fbbf24' }}>{log.threat || "Unknown"}</span>
          <span style={{ color: "#64748b", fontSize: "0.75rem" }}> sev={log.severity}</span>
        </div>
      ))}

      {/* This empty div marks the bottom of the list */}
      <div ref={feedEndRef} />

      {logs.length === 0 && <div style={{ color: "#475569", textAlign: "center", marginTop: "50px" }}>Awaiting incoming packets...</div>}
    </div>
  );
}

export default LiveFeed;
