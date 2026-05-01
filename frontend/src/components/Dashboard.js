import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState, useEffect } from "react"; // Combined imports
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { io } from "socket.io-client"; // Socket import
import MapChart from "./MapChart";
import LiveFeed from "./LiveFeed";

// 1. GLOBAL THEME & STYLES
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
          ips.slice(0, 10).map((item, idx) => (
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
const Dashboard = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- LIVE SOCKET CONNECTION ---
  useEffect(() => {
    const socket = io("http://localhost:5000");

    socket.on("connect", () => {
      console.log("🟢 Connected to LogLens Engine");
    });

    socket.on("new-log", (newEntry) => {
      setData((prevData) => {
        if (!prevData) {
          return {
            total: 1,
            threats: newEntry.status >= 400 ? 1 : 0,
            ips: [newEntry],
            score: 99,
            top: "HTTP_AUTH",
            timeline: [{ time: newEntry.timestamp, val: 1 }],
            sev_data: { high: newEntry.status >= 400 ? 1 : 0, low: newEntry.status < 400 ? 1 : 0 }
          };
        }

        return {
          ...prevData,
          total: prevData.total + 1,
          threats: newEntry.status >= 400 ? prevData.threats + 1 : prevData.threats,
          ips: [newEntry, ...prevData.ips].slice(0, 15),
          sev_data: {
            ...prevData.sev_data,
            high: newEntry.status >= 400 ? prevData.sev_data.high + 1 : prevData.sev_data.high,
            low: newEntry.status < 400 ? prevData.sev_data.low + 1 : prevData.sev_data.low
          }
        };
      });
    });

    return () => socket.disconnect();
  }, [setData]);

  const handleUpload = async (e) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("logfile", e.target.files[0]);
    try {
      const res = await fetch("http://localhost:5000/upload", { method: "POST", body: formData });
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemo = async () => {
    const res = await fetch("http://localhost:5000/demo");
    const demoJson = await res.json();
    setData(demoJson);
  };

  const exportToPDF = (currentData) => {
    if (!currentData) {
      alert("No data available to export!");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(0, 242, 255);
    doc.text("LogLens Security Report", 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [["IP Address", "Country", "Threat Type", "Severity"]],
      body: currentData.ips.map(item => [item.ip, item.country || "Unknown", "Malicious Activity", "HIGH"]),
      theme: 'grid',
      headStyles: { fillColor: [22, 27, 34] },
    });
    doc.save(`LogLens_Report_${Date.now()}.pdf`);
  };

  const OverviewContent = () => {
    if (!data) {
      return (
        <div style={{ height: "60vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", border: `1px dashed ${THEME.border}`, borderRadius: "16px" }}>
          <h3 style={{ color: "white" }}>Awaiting Ingestion...</h3>
          <p style={{ color: "#475569", fontSize: "0.8rem" }}>System status: STANDBY</p>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
          <StatBox label="INGESTED_EVENTS" value={data.total} color={THEME.accent} />
          <StatBox label="ACTIVE_THREATS" value={data.threats} color={THEME.danger} />
          <StatBox label="PRIMARY_VECTOR" value={data.top} color="#c084fc" />
          <StatBox label="SECURITY_SCORE" value={data.score} color="#4ade80" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
          <div style={cardStyle}>
            <h4 style={titleStyle}>Ingestion Timeline</h4>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.timeline}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={THEME.accent} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={THEME.accent} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke={THEME.border} tick={{fill: THEME.text, fontSize: 10}} />
                <Tooltip contentStyle={{background: THEME.surface, border: `1px solid ${THEME.border}`}} />
                <Area type="monotone" dataKey="val" stroke={THEME.accent} fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
<div style={cardStyle}>
  <h4 style={titleStyle}>Severity Distribution</h4>
  <ResponsiveContainer width="100%" height={260}>
    {/* Added check: only render chart if sev_data exists */}
    <BarChart data={data?.sev_data ? Object.entries(data.sev_data).map(([n, v]) => ({ n, v })) : []}>
      <XAxis dataKey="n" stroke="none" tick={{fill: THEME.text, fontSize: 11}} />
      <Bar dataKey="v" radius={[4, 4, 0, 0]}>
        {/* Added optional chaining on sev_data */}
        {data?.sev_data && Object.entries(data.sev_data).map((entry, index) => (
          <Cell key={index} fill={entry[0] === 'high' ? THEME.danger : THEME.accent} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr", gap: "24px" }}>
          <div style={cardStyle}>
            <h4 style={titleStyle}>Geospatial Attribution</h4>
            <MapChart attackIps={data.ips} />
          </div>
          <div style={cardStyle}>
            <h4 style={titleStyle}>Heuristic Live Stream</h4>
            <LiveFeed live={true} />
          </div>
        </div>

        <div style={cardStyle}>
          <h4 style={titleStyle}>Top Malicious Sources</h4>
          <TopAttackersTable ips={data.ips} />
        </div>
      </div>
    );
  };

  const renderPage = () => {
    switch (activeTab) {
      case "Overview": return <OverviewContent />;
      case "Reports": return (
        <div style={cardStyle}>
          <h4 style={titleStyle}>Security Reports Archive</h4>
          {["Daily_Audit_Log.pdf", "Threat_Heuristics_April.csv"].map(file => (
            <div key={file} style={{ padding: "15px", borderBottom: `1px solid ${THEME.border}`, display: "flex", justifyContent: "space-between" }}>
              <span>{file}</span>
              <span style={{ color: THEME.accent, cursor: "pointer" }}>DOWNLOAD</span>
            </div>
          ))}
        </div>
      );
      default: return <div style={{ color: "white" }}>Module {activeTab} Initializing...</div>;
    }
  };

  return (
    <div style={{ display: "flex", background: THEME.bg, minHeight: "100vh", color: "white", fontFamily: "monospace" }}>
      <div style={{ width: "280px", background: THEME.surface, borderRight: `1px solid ${THEME.border}`, padding: "40px 24px", height: "100vh", position: "sticky", top: 0 }}>
        <h2 style={{ color: THEME.accent, marginBottom: "50px" }}>LOGLENS</h2>
        <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {["Overview", "Incident Response", "Threat Intel", "Reports", "Settings"].map((item) => (
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
            <button onClick={() => exportToPDF(data)} style={{ ...btnStyle, background: "transparent", border: `1px solid ${THEME.border}`, color: "white" }}>PDF</button>
          </div>
        </header>
        {renderPage()}
      </div>
    </div>
  );
};

export default Dashboard;
