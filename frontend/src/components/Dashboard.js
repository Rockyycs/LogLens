import html2canvas from "html2canvas";
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
    formData.append("logfile", file); // ✅ FIXED

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, { // ✅ FIXED
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

setData({
  total: result?.total || 0,
  threats: result?.threats || 0,
  ips: result?.ips || [],
  sev_data: result?.sev_data || { high: 0, medium: 0, low: 0 }
});

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

const exportToPDF = async () => {
  if (!data?.ips || data.ips.length === 0) {
    alert("No data");
    return;
  }

  const doc = new jsPDF();

  // ================= PAGE 1: EXECUTIVE SUMMARY =================
  doc.setFontSize(20);
  doc.setTextColor(0, 242, 255);
  doc.text("LogLens Executive Report", 14, 20);

  doc.setFontSize(11);
  doc.setTextColor(150);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  const avgScore = Math.round(
    data.ips.reduce((a, b) => a + (b.abuseScore || 0), 0) /
    (data.ips.length || 1)
  );

  const riskLevel =
    avgScore > 70 ? "HIGH" : avgScore > 40 ? "MEDIUM" : "LOW";

  // 🧠 AI-style summary (auto generated)
  const summaryText = `
This report analyzes ${data.total} log events and detected ${data.threats} potential threats.
The overall risk score is ${avgScore}% indicating a ${riskLevel} risk environment.
Most activity originates from ${data.ips[0]?.country || "unknown regions"} 
with patterns suggesting automated probing or brute-force attempts.
Immediate monitoring and mitigation is recommended.
`;

  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.text(summaryText, 14, 45, { maxWidth: 180 });

  // ================= PAGE 2 =================
  doc.addPage();

  doc.setFontSize(16);
  doc.setTextColor(0, 242, 255);
  doc.text("Threat Analytics", 14, 15);

  // ================= 📊 CAPTURE CHART =================
  try {
    const chartElement = document.querySelector(".recharts-wrapper");

    if (chartElement) {
      const canvas = await html2canvas(chartElement);
      const img = canvas.toDataURL("image/png");

      doc.addImage(img, "PNG", 14, 25, 180, 80);
    }
  } catch (err) {
    console.log("Chart capture failed");
  }

  // ================= 📍 CAPTURE MAP =================
  try {
    const mapElement = document.querySelector("#map-container");

    if (mapElement) {
      const canvas = await html2canvas(mapElement);
      const img = canvas.toDataURL("image/png");

      doc.addImage(img, "PNG", 14, 110, 180, 80);
    }
  } catch (err) {
    console.log("Map capture failed");
  }

  // ================= PAGE 3 =================
  doc.addPage();

  doc.setFontSize(16);
  doc.setTextColor(0, 242, 255);
  doc.text("Detailed Threat Table", 14, 15);

  autoTable(doc, {
    startY: 25,

    head: [["IP Address", "Score", "Country", "Severity"]],

    body: data.ips.map(i => [
      i.ip || "-",
      i.abuseScore ?? 0,
      i.country || "Unknown",
      i.severity || "low"
    ]),

    headStyles: {
      fillColor: [0, 242, 255],
      textColor: 0
    },

    didParseCell: (cell) => {
      if (cell.section === "body") {
        const severity = cell.row.raw[3];

        if (severity === "high") {
          cell.cell.styles.fillColor = [255, 77, 77];
          cell.cell.styles.textColor = 255;
        } else if (severity === "medium") {
          cell.cell.styles.fillColor = [243, 156, 18];
        } else {
          cell.cell.styles.fillColor = [74, 222, 128];
        }
      }
    }
  });

  // ================= FOOTER =================
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(
      `LogLens SIEM Report • Page ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save("loglens_enterprise_report.pdf");
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
