import React, { useEffect, useState, useRef } from "react";

function LiveFeed({ live, customLogs }) {
  const [logs, setLogs] = useState([]);
  const containerRef = useRef(null);

  // Manual scroll function that stays inside the box
  const scrollToBottom = () => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      // We set the scrollTop of the DIV, which doesn't move the Browser Window
      containerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  };

  useEffect(() => {
    if (customLogs && customLogs.length > 0) {
      setLogs(customLogs);
    }
  }, [customLogs]);

  useEffect(() => {
    // Only auto-scroll if the user isn't trying to read something (optional)
    // For now, this will keep it at the bottom without jumping the page
    scrollToBottom();
  }, [logs]);

  return (
    <div 
      ref={containerRef}
      style={{
        background: "#0a0b10", 
        padding: "20px",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        height: "350px",        // Fixed height
        overflowY: "auto",      // Scrollable
        overflowAnchor: "none", // CRITICAL: Stops browser from jumping the page
        fontFamily: "'Fira Code', monospace",
        fontSize: "0.8rem",
        position: "relative",
        scrollbarWidth: "thin",
        scrollbarColor: "#1e293b transparent"
      }}
    >
      {/* Terminal Header */}
      <div style={{ 
        position: "sticky", 
        top: 0, 
        background: "#0a0b10", 
        paddingBottom: "10px", 
        display: "flex", 
        justifyContent: "space-between", 
        borderBottom: "1px solid rgba(255,255,255,0.05)", 
        marginBottom: "15px",
        zIndex: 10
      }}>
        <span style={{ color: "#4ade80" }}>root@loglens:~# tail -f /var/log/attacks</span>
        <span style={{ color: live ? "#4ade80" : "#ef4444", fontSize: "0.75rem", fontWeight: "bold" }}>
          {live ? "● LIVE" : "○ PAUSED"}
        </span>
      </div>

      {/* Log Entries */}
      {logs.map((log, i) => (
        <div key={i} style={{ 
          display: "flex", 
          alignItems: "center",
          marginBottom: "6px", 
          borderLeft: `2px solid ${log.severity === 'high' ? '#ff4d4d' : '#00f2ff'}`, 
          paddingLeft: "12px",
          lineHeight: "1.4"
        }}>
          <span style={{ color: "#6e7681", marginRight: "8px" }}>
            [{log.time || "20:22:00"}]
          </span>
          <span style={{ color: "#ffffff" }}>src=</span>
          <span style={{ color: "#00f2ff", marginRight: "8px" }}>{log.ip || "0.0.0.0"}</span>
          <span style={{ color: "#ffffff" }}>event=</span>
          <span style={{ color: "#f0883e", marginRight: "8px" }}>{log.threat || "Unknown"}</span>
          <span style={{ color: "#8b949e", fontSize: "0.75rem", marginLeft: "auto" }}>
            sev={log.severity || "low"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default LiveFeed;
