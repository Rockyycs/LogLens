import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import React, { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line } from "recharts";
import { toast, ToastContainer } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css';
import io from "socket.io-client";
import MapChart from "./MapChart";
import LiveFeed from "./LiveFeed";

const API_BASE_URL = "https://loglens-c3ws.onrender.com"; 
const socket = io(API_BASE_URL, { transports: ["websocket"] });

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

const Dashboard = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isProcessing, setIsProcessing] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState([]); 
  const fileInputRef = useRef(null);

  useEffect(() => {
    socket.on("new-log", (log) => {
      if (log.abuseScore > 80) {
        toast.error(`Blocked ${log.ip}`);
        setBlockedIPs(prev => [...new Set([...prev, log.ip])]);
      }
    });

    return () => socket.off("new-log");
  }, []);

  // 🔥 FINAL FIXED UPLOAD FUNCTION
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log("Uploading:", file);

    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", file); // ✅ FIXED

    try {
      const res = await fetch(`${API_BASE_URL}/analyze`, { // ✅ FIXED
        method: "POST",
        body: formData,
      });

      console.log("Status:", res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error("Server error:", text);
        throw new Error("Server failed");
      }

      const result = await res.json();

      console.log("Result:", result);

      setData(result);
      toast.success("Analysis complete 🚀");

    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      toast.error("Upload failed. Backend issue.");
    } finally {
      setIsProcessing(false);
      e.target.value = null;
    }
  };

  const handleDemo = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/demo`);
      const data = await res.json();
      setData(data);
      toast.info("Demo loaded");
    } catch {
      toast.error("Demo failed");
    }
  };

  const exportToPDF = () => {
    if (!data?.ips) return alert("No data");

    const doc = new jsPDF();

    autoTable(doc, {
      head: [["IP", "Score", "Country"]],
      body: data.ips.map(i => [i.ip, i.abuseScore, i.country])
    });

    doc.save("report.pdf");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: THEME.bg, color: "white" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: "250px", padding: "30px", background: THEME.surface }}>
        <h2 style={{ color: THEME.accent }}>LOGLENS</h2>
        {["Overview","Incident","Intel","Reports"].map(tab => (
          <div key={tab} onClick={() => setActiveTab(tab)}
            style={{ marginTop: "15px", cursor: "pointer", color: activeTab===tab ? THEME.accent : THEME.text }}>
            {tab}
          </div>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: "40px" }}>
        <ToastContainer theme="dark" />

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h1>{activeTab}</h1>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleDemo} style={btnStyle}>LOAD_INTEL</button>

            <input type="file" hidden ref={fileInputRef} onChange={handleUpload} />

            <button onClick={() => fileInputRef.current.click()} style={btnStyle}>
              {isProcessing ? "ANALYZING..." : "UPLOAD_LOG"}
            </button>

            <button onClick={exportToPDF} style={btnStyle}>PDF</button>
          </div>
        </div>

        {/* CONTENT */}
        {!data ? (
          <div style={{ textAlign: "center", marginTop: "100px" }}>
            <h2 style={{ color: THEME.accent }}>ENGINE OFFLINE</h2>
            <p>Upload log file</p>
          </div>
        ) : (
          <div style={{ marginTop: "40px" }}>
            <h3>Total Logs: {data.total}</h3>
            <h3>Threats: {data.threats}</h3>

            <h4 style={{ marginTop: "30px" }}>Top IPs:</h4>
            {data.ips?.slice(0,5).map(ip => (
              <div key={ip.ip}>
                {ip.ip} - {ip.abuseScore}%
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
