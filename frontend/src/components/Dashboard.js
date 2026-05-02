import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line } from "recharts";
import { toast, ToastContainer } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css';
import io from "socket.io-client";
import MapChart from "./MapChart";
import LiveFeed from "./LiveFeed";

const socket = io("http://localhost:5000");

const THEME = {
  bg: '#0a0b10',
  surface: '#161b22', 
  card: '#161b22',
  accent: '#00f2ff',
  danger: '#ff4d4d',
  warning: '#f39c12',
  success: '#4ade80',
  text: '#8b949e',
  border: 'rgba(255, 255, 255, 0.1)'
};

const cardStyle = {
  backgroundColor: THEME.card,
  borderRadius: '12px',
  padding: '20px',
  border: "1px solid " + THEME.border,
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

// --- NEW COMPONENT: REPUTATION BADGE ---
const AbuseBadge = ({ score }) => {
    const color = score > 80 ? THEME.danger : score > 40 ? THEME.warning : THEME.success;
    return (
        <span style={{ 
            fontSize: '0.7rem', 
            padding: '2px 8px', 
            borderRadius: '12px', 
            background: `${color}20`, 
            color: color, 
            border: `1px solid ${color}50`,
            fontWeight: 'bold'
        }}>
            {score || 0}% INTEL
        </span>
    );
};

// --- UPDATED TABLE: WITH ABUSE SCORES ---
const TopAttackersTable = ({ ips, blockedIPs, onBlock }) => (
  <div style={{ width: "100%", marginTop: "10px" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", color: "#94a3b8", fontSize: "0.85rem" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid " + THEME.border, textAlign: "left" }}>
          <th style={{ padding: "12px 8px" }}>IP Address</th>
          <th style={{ padding: "12px 8px" }}>Global Reputation</th>
          <th style={{ padding: "12px 8px" }}>Origin</th>
          <th style={{ padding: "12px 8px" }}>Status</th>
          <th style={{ padding: "12px 8px", textAlign: "right" }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {ips && ips.length > 0 ? (
          ips.slice(0, 8).map((item, idx) => (
            <tr key={idx} style={{ borderBottom: "1px solid " + THEME.border, background: idx % 2 === 0 ? 'transparent' : '#ffffff05' }}>
              <td style={{ padding: "12px 8px", color: "white", fontFamily: "monospace" }}>{item.ip}</td>
              <td style={{ padding: "12px 8px" }}><AbuseBadge score={item.abuseScore} /></td>
              <td style={{ padding: "12px 8px" }}>{item.country || "Global"}</td>
              <td style={{ padding: "12px 8px" }}>
                {blockedIPs.includes(item.ip) ? (
                    <span style={{ color: THEME.danger, fontSize: "0.7rem", border: "1px solid " + THEME.danger, padding: "2px 6px", borderRadius: "4px", background: "rgba(255, 77, 77, 0.1)" }}>DROPPED</span>
                ) : (
                    <span style={{ color: THEME.warning, fontSize: "0.7rem", border: "1px solid " + THEME.warning, padding: "2px 6px", borderRadius: "4px" }}>FLAGGED</span>
                )}
              </td>
              <td style={{ padding: "12px 8px", textAlign: "right" }}>
                {!blockedIPs.includes(item.ip) && (
                  <button onClick={() => onBlock(item.ip)} style={{ background: "transparent", border: "1px solid " + THEME.danger, color: THEME.danger, padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer" }}>BLOCK</button>
                )}
              </td>
            </tr>
          ))
        ) : (
          <tr><td colSpan="5" style={{ padding: "40px", textAlign: "center" }}>Awaiting intel stream...</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

const StatBox = ({ label, value, color, subtitle }) => (
  <div style={{ ...cardStyle, borderLeft: "2px solid " + color, background: THEME.surface }}>
    <div style={{ fontSize: "0.7rem", color: THEME.text, marginBottom: "12px", letterSpacing: "1px" }}>{label}</div>
    <div style={{ fontSize: "1.8rem", fontWeight: "800", color }}>{value || 0}</div>
    {subtitle && <div style={{ fontSize: '0.65rem', color: THEME.text, marginTop: '5px' }}>{subtitle}</div>}
  </div>
);

const OverviewContent = ({ data, blockedIPs, handleManualBlock, velocityData }) => {
  if (!data) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
        <StatBox label="INGESTED_EVENTS" value={data.total} color={THEME.accent} />
        <StatBox label="ACTIVE_THREATS" value={data.threats} color={THEME.danger} />
        <StatBox label="AVG_ABUSE_CONFIDENCE" value={`${Math.round(data.ips?.reduce((a, b) => a + (b.abuseScore || 0), 0) / (data.ips?.length || 1))}%`} color={THEME.warning} />
        <StatBox label="FIREWALL_BLOCKS" value={blockedIPs.length} color={THEME.success} subtitle="REAL-TIME DROPS" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2.1fr 0.9fr", gap: "24px" }}>
        <div style={cardStyle}>
          <h4 style={titleStyle}>Attack Velocity (Last 30 Min)</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={velocityData}>
              <XAxis dataKey="time" stroke={THEME.border} tick={{fill: THEME.text, fontSize: 10}} />
              <YAxis stroke={THEME.border} tick={{fill: THEME.text, fontSize: 10}} />
              <Tooltip contentStyle={{background: THEME.surface, border: "1px solid " + THEME.border}} />
              <Line type="monotone" dataKey="threats" stroke={THEME.danger} strokeWidth={3} dot={{ r: 4, fill: THEME.danger }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <h4 style={titleStyle}>Severity Balance</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={Object.entries(data.sev_data || {}).map(([n, v]) => ({ n, v }))}>
              <XAxis dataKey="n" stroke="none" tick={{fill: THEME.text, fontSize: 11}} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                {Object.entries(data.sev_data || {}).map((entry, index) => (
                  <Cell key={index} fill={entry[0] === 'high' ? THEME.danger : THEME.accent} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div style={cardStyle}>
          <h4 style={titleStyle}>Global Threat Map</h4>
          <MapChart attackIps={data.ips || []} />
        </div>
        <div style={cardStyle}>
          <h4 style={titleStyle}>Live SOC Stream</h4>
          <LiveFeed live={true} />
        </div>
      </div>

      <div style={cardStyle}>
        <h4 style={titleStyle}>Threat Intelligence Database</h4>
        <TopAttackersTable ips={data.ips || []} blockedIPs={blockedIPs} onBlock={handleManualBlock} />
      </div>
    </div>
  );
};

const Dashboard = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isProcessing, setIsProcessing] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState([]); 
  const [velocityData, setVelocityData] = useState([]);

  useEffect(() => {
    socket.on("new-log", (newLog) => {
      // 1. Auto-Alert & Block
      if (newLog.severity === "high" || newLog.abuseScore > 80) {
        toast.error(`SHIELD ACTIVE: Blocked ${newLog.ip} (${newLog.abuseScore}% Abuse Score)`, { theme: "dark" });
        setBlockedIPs(prev => [...new Set([...prev, newLog.ip])]);
      }

      // 2. Update Charts
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setVelocityData(prev => {
          const last = prev[prev.length - 1];
          if (last && last.time === now) {
              return [...prev.slice(0, -1), { ...last, threats: last.threats + 1 }];
          }
          return [...prev.slice(-10), { time: now, threats: 1 }];
      });
    });

    return () => socket.off("new-log");
  }, []);

  const handleManualBlock = async (ip) => {
    try {
      const res = await fetch("http://localhost:5000/api/block-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip })
      });
      if (res.ok) {
        toast.success(`FIREWALL UPDATED: ${ip} Dropped`);
        setBlockedIPs(prev => [...new Set([...prev, ip])]);
      }
    } catch (err) { toast.error("Engine connection lost."); }
  };

  const handleUpload = async (e) => {
    if (!e.target.files[0]) return;
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("logfile", e.target.files[0]);
    try {
      const res = await fetch("http://localhost:5000/upload", { method: "POST", body: formData });
      const result = await res.json();
      setData(result);
      toast.success("Log file processed successfully!");
    } catch (err) { toast.error("Upload failed."); } finally { setIsProcessing(false); e.target.value = null; }
  };

  const handleDemo = async () => {
    try {
      const res = await fetch("http://localhost:5000/demo");
      const demoJson = await res.json();
      setData(demoJson);
      toast.info("Demo intelligence loaded.");
    } catch (err) { toast.error("Failed to load demo data"); }
  };

  const exportToPDF = (currentData) => {
    if (!currentData || !currentData.ips) return alert("No data to export!");
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(0, 242, 255);
    doc.text("LOGLENS THREAT INTELLIGENCE REPORT", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [["IP Address", "Abuse Score", "Country", "Threat Type", "Status"]],
      body: currentData.ips.map(item => [
          item.ip, 
          `${item.abuseScore || 0}%`, 
          item.country || "Unknown", 
          item.type || "Malicious",
          blockedIPs.includes(item.ip) ? "DROPPED" : "FLAGGED"
      ]),
      theme: 'striped',
      headStyles: { fillColor: [22, 27, 34], textColor: [0, 242, 255] },
    });
    doc.save("LogLens_Security_Audit.pdf");
  };

// --- HELPER: INCIDENT LOG TABLE ---
const IncidentTable = ({ blockedIPs }) => (
    <div style={cardStyle}>
        <h4 style={titleStyle}>Active Mitigation Logs</h4>
        <table style={{ width: "100%", color: THEME.text, fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
                <tr style={{ borderBottom: "1px solid " + THEME.border }}>
                    <th style={{ padding: "12px" }}>Target IP</th>
                    <th style={{ padding: "12px" }}>Action Taken</th>
                    <th style={{ padding: "12px" }}>Status</th>
                </tr>
            </thead>
            <tbody>
                {blockedIPs.map((ip, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid " + THEME.border }}>
                        <td style={{ padding: "12px", color: "white", fontFamily: "monospace" }}>{ip}</td>
                        <td style={{ padding: "12px" }}>IPTABLES_DROP</td>
                        <td style={{ padding: "12px", color: THEME.danger }}>ACTIVE_BAN</td>
                    </tr>
                ))}
                {blockedIPs.length === 0 && <tr><td colSpan="3" style={{ padding: "20px", textAlign: "center" }}>No active firewall blocks.</td></tr>}
            </tbody>
        </table>
    </div>
);

// --- UPDATED RENDER PAGE ---
const renderPage = () => {
    if (activeTab === "Overview" && !data) {
        return (
            <div style={{ color: "white", padding: "100px", textAlign: "center" }}>
                <h2 style={{ color: THEME.accent, letterSpacing: '4px' }}>LOGLENS ENGINE OFFLINE</h2>
                <p style={{ color: THEME.text }}>Start the backend or upload a log file to begin monitoring.</p>
            </div>
        );
    }

    switch (activeTab) {
        case "Overview":
            return <OverviewContent data={data} blockedIPs={blockedIPs} handleManualBlock={handleManualBlock} velocityData={velocityData} />;
        
        case "Incident Response":
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <StatBox label="TOTAL_BLOCKS" value={blockedIPs.length} color={THEME.danger} />
                        <StatBox label="SYSTEM_HEALTH" value="SECURE" color={THEME.success} />
                    </div>
                    <IncidentTable blockedIPs={blockedIPs} />
                </div>
            );

        case "Threat Intel":
            return (
                <div style={cardStyle}>
                    <h4 style={titleStyle}>Reputation Intelligence</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {data?.ips?.map((ip, i) => (
                            <div key={i} style={{ padding: '15px', background: '#ffffff05', borderRadius: '8px', border: '1px solid ' + THEME.border }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: THEME.accent, fontFamily: 'monospace' }}>{ip.ip}</span>
                                    <AbuseBadge score={ip.abuseScore} />
                                </div>
                                <p style={{ fontSize: '0.7rem', color: THEME.text, marginTop: '10px' }}>
                                    Detected via: <span style={{ color: 'white' }}>{ip.type}</span> | 
                                    Country: <span style={{ color: 'white' }}>{ip.country}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            );

        case "Reports":
            return (
                <div style={cardStyle}>
                    <h4 style={titleStyle}>Export Center</h4>
                    <div style={{ padding: '20px', background: '#ffffff05', border: '1px dashed ' + THEME.border, borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ color: THEME.text, marginBottom: '15px' }}>Current session contains {data?.ips?.length || 0} security events.</p>
                        <button onClick={() => exportToPDF(data)} style={btnStyle}>DOWNLOAD FULL PDF REPORT</button>
                    </div>
                </div>
            );

        default:
            return <OverviewContent data={data} blockedIPs={blockedIPs} handleManualBlock={handleManualBlock} velocityData={velocityData} />;
    }
};

  const topThreat = data?.ips?.reduce((prev, current) => (prev.abuseScore > current.abuseScore) ? prev : current, { abuseScore: 0 });

  return (
    <div style={{ display: "flex", background: THEME.bg, minHeight: "100vh", color: "white", fontFamily: "'JetBrains Mono', monospace" }}>
      {/* SIDEBAR */}
      <div style={{ width: "280px", background: THEME.surface, borderRight: "1px solid " + THEME.border, padding: "40px 24px", height: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column" }}>
        <h2 style={{ color: THEME.accent, marginBottom: "50px", letterSpacing: '2px' }}>LOGLENS SIEM TOOL</h2>
        <nav style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          {["Overview", "Incident Response", "Threat Intel", "Reports"].map((item) => (
            <div key={item} onClick={() => setActiveTab(item)} style={{ padding: "14px", color: activeTab === item ? THEME.accent : THEME.text, background: activeTab === item ? "#ffffff05" : "transparent", borderRadius: "8px", cursor: "pointer", borderLeft: activeTab === item ? `3px solid ${THEME.accent}` : '3px solid transparent' }}>
              {item}
            </div>
          ))}
        </nav>

        {/* THREAT INTEL CARD */}
        {topThreat && topThreat.abuseScore > 0 && (
            <div style={{ background: '#ff4d4d10', border: '1px solid #ff4d4d40', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.6rem', color: THEME.danger, fontWeight: 'bold' }}>CRITICAL_IP_DETECTED</div>
                <div style={{ fontSize: '1rem', marginTop: '5px' }}>{topThreat.ip}</div>
                <div style={{ fontSize: '0.7rem', color: THEME.text }}>{topThreat.abuseScore}% Global Confidence</div>
            </div>
        )}

        <div style={{ borderTop: "1px solid " + THEME.border, paddingTop: "20px" }}>
            <div style={{ fontSize: "0.65rem", color: THEME.text, marginBottom: "10px" }}>FIREWALL_HISTORY ({blockedIPs.length})</div>
            <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: '0.7rem' }}>
                {blockedIPs.map(ip => <div key={ip} style={{ color: THEME.danger, marginBottom: "4px" }}>✂ {ip}</div>)}
            </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: "40px" }}>
        <ToastContainer position="bottom-right" />
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: 'center', marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{activeTab}</h1>
            {isProcessing && <p style={{ color: THEME.success, fontSize: '0.8rem' }}>● ANALYZING STREAM...</p>}
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={handleDemo} style={{ ...btnStyle, background: "transparent", border: "1px solid " + THEME.accent, color: THEME.accent }}>LOAD_INTEL</button>
            <label style={btnStyle}>UPLOAD_LOG <input type="file" hidden onChange={handleUpload}/></label>
            <button onClick={() => exportToPDF(data)} style={{ ...btnStyle, background: THEME.accent, color: 'black' }}>GENERATE_PDF</button>
          </div>
        </header>
        {renderPage()}
      </div>
    </div>
  );
};

export default Dashboard;
