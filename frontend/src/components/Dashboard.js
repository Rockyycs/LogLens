import React, { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import io from "socket.io-client";
import MapChart from "./MapChart";
import LiveFeed from "./LiveFeed";

const API_BASE_URL = "https://loglens-c3ws.onrender.com";
const socket = io(API_BASE_URL, { transports: ["websocket"] });

const THEME = {
  bg: '#0a0b10',
  card: '#161b22',
  accent: '#00f2ff',
  danger: '#ff4d4d',
  warning: '#f39c12',
  success: '#4ade80',
  text: '#8b949e',
  border: 'rgba(255,255,255,0.1)'
};

const Dashboard = ({ data, setData }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const fileInputRef = useRef(null);

  // 🔴 Real-time alerts
  useEffect(() => {
    socket.on("new-log", (log) => {
      if (log.abuseScore > 80) {
        toast.error(`🚨 Blocked ${log.ip}`);
        setBlockedIPs(prev => [...new Set([...prev, log.ip])]);
      }
    });
    return () => socket.off("new-log");
  }, []);

  // 📤 Upload
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("logfile", file);

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData
      });

      const result = await res.json();

      setData({
        total: result.totalLogs,
        threats: result.threats,
        ips: result.ips,
        sev_data: result.sev_data || { high: 0, medium: 0, low: 0 }
      });

      toast.success("Analysis complete 🚀");

    } catch {
      toast.error("Upload failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // 🎯 Demo
  const handleDemo = async () => {
    const res = await fetch(`${API_BASE_URL}/demo`);
    const data = await res.json();
    setData(data);
    toast.info("Demo loaded");
  };

  // 📄 PDF EXPORT (ELITE)
  const exportToPDF = async () => {
    if (!data?.ips?.length) return alert("No data");

    const doc = new jsPDF();

    // PAGE 1
    doc.setFontSize(20);
    doc.setTextColor(0,242,255);
    doc.text("LogLens Security Intelligence Report", 14, 20);

    const avg = Math.round(
      data.ips.reduce((a,b)=>a+(b.abuseScore||0),0)/(data.ips.length||1)
    );

    doc.setTextColor(255);
    doc.text(`Risk Score: ${avg}%`, 14, 40);

    doc.text(
      `Detected ${data.threats} threats across ${data.total} logs.
Environment risk is ${avg > 70 ? "HIGH" : avg > 40 ? "MEDIUM" : "LOW"}.
Immediate monitoring recommended.`,
      14, 60
    );

    // PAGE 2 (Charts)
    doc.addPage();

    const chart = document.querySelector(".recharts-wrapper");
    if (chart) {
      const canvas = await html2canvas(chart);
      doc.addImage(canvas.toDataURL(), "PNG", 10, 20, 180, 80);
    }

    const map = document.querySelector("#map-container");
    if (map) {
      const canvas = await html2canvas(map);
      doc.addImage(canvas.toDataURL(), "PNG", 10, 110, 180, 80);
    }

    // PAGE 3 (Table)
    doc.addPage();

    autoTable(doc, {
      startY: 20,
      head: [["IP", "Score", "Country", "Severity"]],
      body: data.ips.map(i => [
        i.ip,
        i.abuseScore,
        i.country,
        i.severity || "low"
      ])
    });

    doc.save("loglens_report.pdf");
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:THEME.bg, color:"white" }}>
      
      <ToastContainer theme="dark"/>

      {/* SIDEBAR */}
      <div style={{ width:220, padding:20, background:"#111" }}>
        <h2 style={{ color:THEME.accent }}>LOGLENS</h2>
        <p style={{ color:THEME.text }}>Overview</p>
        <p style={{ color:THEME.text }}>Intel</p>
        <p style={{ color:THEME.text }}>Reports</p>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, padding:30 }}>

        {/* TOP BAR */}
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <h1>Overview</h1>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleDemo}>DEMO</button>

            <input type="file" hidden ref={fileInputRef} onChange={handleUpload}/>
            <button onClick={()=>fileInputRef.current.click()}>
              {isProcessing ? "ANALYZING..." : "UPLOAD"}
            </button>

            <button onClick={exportToPDF}>PDF</button>
          </div>
        </div>

        {!data ? (
          <div style={{ textAlign:"center", marginTop:100 }}>
            <h2 style={{ color:THEME.accent }}>ENGINE OFFLINE</h2>
          </div>
        ) : (

          <div>

            {/* CARDS */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
              {[
                { label:"EVENTS", value:data.total, color:THEME.accent },
                { label:"THREATS", value:data.threats, color:THEME.danger },
                { label:"BLOCKED", value:blockedIPs.length, color:THEME.success },
                { label:"RISK", value:"HIGH", color:"purple" }
              ].map((c,i)=>(
                <motion.div key={i}
                  whileHover={{ scale:1.05 }}
                  style={{
                    background:THEME.card,
                    padding:20,
                    borderLeft:`4px solid ${c.color}`
                  }}>
                  <p>{c.label}</p>
                  <h2>{c.value}</h2>
                </motion.div>
              ))}
            </div>

            {/* CHART */}
            <div style={{ marginTop:30 }}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.ips}>
                  <Area dataKey="abuseScore" stroke={THEME.accent} fill={THEME.accent}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* MAP + LIVE */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginTop:30 }}>
              <div id="map-container"><MapChart data={data.ips}/></div>
              <LiveFeed/>
            </div>

            {/* TABLE */}
            <table style={{ width:"100%", marginTop:30 }}>
              <thead>
                <tr>
                  <th>IP</th><th>Score</th><th>Country</th>
                </tr>
              </thead>
              <tbody>
                {data.ips.map((ip,i)=>(
                  <tr key={i}>
                    <td>{ip.ip}</td>
                    <td>{ip.abuseScore}</td>
                    <td>{ip.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
