import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid } from "recharts";
import MapChart from "./MapChart";
import LiveFeed from "./LiveFeed";

// 1. THEME DEFINITION
const THEME = {
  bg: '#0a0b10',
  surface: '#161b22', 
  card: '#161b22',
  accent: '#00f2ff',
  danger: '#ff4d4d',
  text: '#8b949e',
  border: 'rgba(255, 255, 255, 0.1)'
};

const cardStyle = {
  backgroundColor: THEME.card,
  borderRadius: '12px',
  padding: '20px',
  border: `1px solid ${THEME.border}`,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  color: 'white'
};

const btnStyle = {
  background: THEME.accent,
  color: "black",
  padding: "12px 24px",
  borderRadius: "6px",
  fontSize: "0.8rem",
  fontWeight: "bold",
  cursor: "pointer",
  border: "none"
};

const titleStyle = {
  fontSize: "0.85rem",
  color: THEME.text,
  marginBottom: "24px",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  fontWeight: "bold"
};

// 2. HELPER COMPONENTS
const StatBox = ({ label, value, color }) => (
  <div style={{ ...cardStyle, borderLeft: `2px solid ${color}`, background: THEME.surface }}>
    <div style={{ fontSize: "0.7rem", color: THEME.text, marginBottom: "12px", letterSpacing: "1px" }}>{label}</div>
    <div style={{ fontSize: "1.8rem", fontWeight: "800", color }}>{value}</div>
  </div>
);

const TopAttackersTable = ({ ips }) => (
  <div style={{ width: "100%", marginTop: "10px" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", color: "#94a3b8", fontSize: "0.85rem" }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${THEME.border}`, textAlign: "left" }}>
          <th style={{ padding: "12px 8px" }}>IP Address</th>
          <th style={{ padding: "12px 8px" }}>Origin</th>
          <th style={{ padding: "12px 8px" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {ips && ips.length > 0 ? (
          ips.slice(0, 5).map((item, idx) => (
            <tr key={idx} style={{ borderBottom: `1px solid ${THEME.border}`, background: idx % 2 === 0 ? 'transparent' : '#ffffff05' }}>
              <td style={{ padding: "12px 8px", color: "white", fontFamily: "monospace" }}>{item.ip}</td>
              <td style={{ padding: "12px 8px" }}>{item.country || "Global"}</td>
              <td style={{ padding: "12px 8px" }}>
                <span style={{ color: "#ff4d4d", fontSize: "0.7rem", border: "1px solid #ff4d4d", padding: "2px 6px", borderRadius: "4px" }}>MALICIOUS</span>
              </td>
            </tr>
          ))
        ) : (
          <tr><td colSpan="3" style={{ padding: "40px", textAlign: "center" }}>Awaiting log analysis...</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

// 3. MAIN DASHBOARD COMPONENT
const Dashboard = () => {
  const [data, setData] = useState({ live_logs: [] });
  const [isLive, setIsLive] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isProcessing, setIsProcessing] = useState(false);

  const exportToPDF = (currentData) => {
    if (!currentData || !currentData.ips) {
      alert("No data available to export! Upload a log first.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(0, 242, 255);
    doc.text("LogLens Security Report", 14, 20);
    
    autoTable(doc, {
      startY: 30,
      head: [["IP Address", "Origin", "Vector Detected", "Severity"]],
      body: currentData.ips.map(item => [
        item.ip, 
        item.country || "Unknown", 
        currentData.top || "Generic Attack", 
        "HIGH"
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 27, 34] },
    });
    doc.save(`LogLens_Analysis_${Date.now()}.pdf`);
  };


const handleUpload = async (e) => {
  if (!e.target.files[0]) return;
  setIsProcessing(true);
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("https://loglens-c3ws.onrender.com/upload", { 
      method: "POST", 
      body: formData 
    });
    
    if (!res.ok) throw new Error("Upload failed");
    const result = await res.json();

const reader = new FileReader();

reader.onload = (event) => {
  const rawContent = event.target.result;
  const content = rawContent.toUpperCase();
  // your logic
};

reader.readAsText(file); // 🔥 MUST ADD THIS

      const patterns = {
        "BRUTE_FORCE": (content.match(/FAILED|LOGIN|AUTH|PASSWORD/g) || []).length,
        "SQL_INJECTION": (content.match(/SELECT|UNION|INSERT|DROP|' OR '/g) || []).length,
        "DOS_ATTACK": (content.match(/FLOOD|TIMEOUT|OVERLOAD|LIMIT/g) || []).length,
        "EXPLOIT": (content.match(/SHELL|PAYLOAD|RCE|SYSTEM/g) || []).length
      };

      const topVector = Object.keys(patterns).reduce((a, b) => patterns[a] > patterns[b] ? a : b);
      const detectedVector = patterns[topVector] > 0 ? topVector : "NETWORK_SCAN";

      const totalEvents = result.total || 5;
      let newSevData = { high: 0, medium: 0, low: 0 };

      if (detectedVector === "SQL_INJECTION" || detectedVector === "EXPLOIT") {
        newSevData = { high: Math.floor(totalEvents * 0.7), medium: Math.floor(totalEvents * 0.2), low: Math.floor(totalEvents * 0.1) };
      } else if (detectedVector === "BRUTE_FORCE" || detectedVector === "DOS_ATTACK") {
        newSevData = { high: Math.floor(totalEvents * 0.3), medium: Math.floor(totalEvents * 0.6), low: Math.floor(totalEvents * 0.1) };
      } else {
        newSevData = { high: 1, medium: 1, low: totalEvents - 2 };
      }

      setData({
        ...result,
        sev_data: newSevData,
        top: detectedVector,
        timeline: (result.timeline && result.timeline.length > 0) ? result.timeline : [
          { time: "12:00", val: Math.floor(totalEvents * 0.2) },
          { time: "13:00", val: Math.floor(totalEvents * 0.5) },
          { time: "14:00", val: Math.floor(totalEvents * 0.8) },
          { time: "15:00", val: totalEvents }
        ]
      });

      setIsLive(true);
      setIsProcessing(false);
    };

    reader.readAsText(file);

  } catch (err) {
    console.error("Upload error:", err);
    setIsProcessing(false);
  }
};

      // Initial Update for Charts
      setData(prev => ({ 
        ...prev,
        ...result, 
        top: detectedVector,
        sev_data: newSevData,
        timeline: finalTimeline
      }));

      // 3. START CONTINUOUS "STREAMING" EFFECT
      const allLines = rawContent.split('\n').filter(line => line.trim() !== '');
      let lineIndex = 0;

      const streamLogs = setInterval(() => {
        // Loop back to start if we reach the end of the file for "continuous" effect
        if (lineIndex >= allLines.length) lineIndex = 0; 
        
        const currentLine = allLines[lineIndex];
        const ipMatch = currentLine.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
        
        const newLogEntry = {
          time: new Date().toLocaleTimeString([], { hour12: false }),
          ip: ipMatch ? ipMatch[0] : "127.0.0.1",
          threat: detectedVector,
          severity: (detectedVector === "SQL_INJECTION" || detectedVector === "EXPLOIT") ? "high" : "low"
        };

        setData(prev => ({
          ...prev,
          // This keeps the list at 15 items and adds the new one to the bottom
          live_logs: [...(prev.live_logs || []).slice(-14), newLogEntry]
        }));

        lineIndex++;
      }, 800); // 800ms = constant updates within a second

      // Optional: Store interval ID in a ref if you want to stop it later
    };
    reader.readAsText(file);

  } catch (err) {
    console.error("Upload Error:", err);
  } finally {
    setIsProcessing(false);
  }
};

const handleDemo = () => {
  const demoData = {
    total: 154,
    threats: 12,
    top: "BRUTE_FORCE",
    // These keys (time and val) now match your AreaChart precisely
    timeline: [
      { time: "13:00", val: 10 },
      { time: "14:00", val: 25 },
      { time: "15:00", val: 45 },
      { time: "16:00", val: 30 },
      { time: "17:00", val: 60 },
      { time: "18:00", val: 20 }
    ],
    sev_data: { high: 8, medium: 4, low: 2 },
    live_logs: [
      { time: "21:19:01", ip: "192.168.1.5", event: "SQL_INJECTION", sev: "high" },
      { time: "21:19:05", ip: "45.33.2.11", event: "BRUTE_FORCE", sev: "high" },
      { time: "21:19:10", ip: "127.0.0.1", event: "CLEAN_TRAFFIC", sev: "low" }
    ]
  };

  setData(demoData);
  setIsLive(true);
};
  // INNER COMPONENT FOR OVERVIEW
  const OverviewContent = () => {
    if (!data.total && !data.live_logs.length) return <div style={{ color: "white", textAlign: "center", padding: "50px" }}>Awaiting Data...</div>;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
          <StatBox label="INGESTED_EVENTS" value={data.total || 0} color={THEME.accent} />
          <StatBox label="ACTIVE_THREATS" value={data.threats || 0} color={THEME.danger} />
          <StatBox label="PRIMARY_VECTOR" value={data.top || "SCANNING"} color="#c084fc" />
          <StatBox 
  label="SECURITY_SCORE" 
  value={data.total > 0 ? `${Math.max(0, 100 - (data.threats * 2))}%` : "100%"} 
  color="#4ade80" 
/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
          <div style={cardStyle}>
            <h4 style={titleStyle}>Ingestion Timeline</h4>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.timeline || []}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={THEME.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={THEME.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke={THEME.text} tick={{fill: THEME.text, fontSize: 10}} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{background: THEME.surface, border: `1px solid ${THEME.border}`, color: 'white'}} />
                <Area type="monotone" dataKey="val" stroke={THEME.accent} fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={cardStyle}>
            <h4 style={titleStyle}>Severity Distribution</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.sev_data ? Object.entries(data.sev_data).map(([n, v]) => ({ n, v })) : []}>
                <XAxis dataKey="n" stroke="none" tick={{fill: THEME.text, fontSize: 11}} />
                <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {data.sev_data && Object.entries(data.sev_data).map((entry, index) => (
                    <Cell key={index} fill={entry[0] === 'high' ? THEME.danger : THEME.accent} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr", gap: "24px" }}>
          <div style={cardStyle}><h4 style={titleStyle}>Geospatial Attribution</h4><MapChart attackIps={data.ips || []} /></div>
          <div style={{ ...cardStyle, height: '450px' }}><h4 style={titleStyle}>Heuristic Live Stream</h4><LiveFeed live={isLive} customLogs={data.live_logs} /></div>
        </div>

        <div style={cardStyle}><h4 style={titleStyle}>Top Malicious Sources</h4><TopAttackersTable ips={data.ips || []} /></div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", background: THEME.bg, minHeight: "100vh", color: "white", fontFamily: "monospace" }}>
      <div style={{ width: "280px", background: THEME.surface, borderRight: `1px solid ${THEME.border}`, padding: "40px 24px", height: "100vh", position: "sticky", top: 0 }}>
        <h2 style={{ color: THEME.accent, marginBottom: "50px" }}>LOGLENS</h2>
        <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {["Overview"].map((item) => (
            <div key={item} onClick={() => setActiveTab(item)} style={{ padding: "14px", color: activeTab === item ? THEME.accent : THEME.text, background: activeTab === item ? "#12232e" : "transparent", borderRadius: "8px", cursor: "pointer" }}>
              {item}
            </div>
          ))}
        </nav>
      </div>

      <div style={{ flex: 1, padding: "40px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
          <div>
            <h1>{activeTab}</h1>
            {isProcessing && <p style={{ color: "#4ade80" }}>⚡ Processing Stream...</p>}
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={handleDemo} style={{ ...btnStyle, background: "transparent", border: `1px solid ${THEME.accent}`, color: THEME.accent }}>DEMO</button>
            <label style={btnStyle}>UPLOAD <input type="file" hidden onChange={handleUpload}/></label>
            <button onClick={() => exportToPDF(data)} style={btnStyle}>PDF</button>
          </div>
        </header>
        {activeTab === "Overview" ? <OverviewContent /> : <div style={{ color: "white", padding: "20px" }}>Module {activeTab} Loading...</div>}
      </div>
    </div>
  );
};

export default Dashboard;
