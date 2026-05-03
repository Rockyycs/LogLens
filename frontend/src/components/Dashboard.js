import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./dashboard.css";

export default function Dashboard({ data, setData }) {
  const [loading, setLoading] = useState(false);

  // ---------------- DEMO ----------------
  const loadDemo = () => {
    const demo = {
      total: 1420,
      threats: 12,
      blocked: 0,
      risk: "HIGH",
      ips: [
        { ip: "192.168.1.105", abuseScore: 80, country: "US" },
        { ip: "45.33.2.11", abuseScore: 92, country: "CN" },
        { ip: "103.21.244.2", abuseScore: 60, country: "IN" },
        { ip: "84.200.69.80", abuseScore: 70, country: "DE" }
      ],
      timeline: [
        { time: "10:00", value: 200 },
        { time: "10:30", value: 150 },
        { time: "11:00", value: 180 },
        { time: "11:30", value: 300 },
        { time: "12:00", value: 500 }
      ]
    };

    setData(demo);
    toast.success("Demo loaded 🚀");
  };

  // ---------------- UPLOAD ----------------
  const uploadLog = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("logfile", file);

    try {
      const res = await fetch(process.env.REACT_APP_API + "/upload", {
        method: "POST",
        body: formData
      });

      const result = await res.json();
      setData(result);

      toast.success("Analysis complete 🚀");
    } catch {
      toast.error("Upload failed");
    }

    setLoading(false);
  };

  // ---------------- PDF ----------------
  const exportPDF = () => {
    if (!data) return;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("LogLens Security Report", 14, 15);

    doc.setFontSize(10);
    doc.text(`Risk Level: ${data.risk}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [["IP", "Score", "Country"]],
      body: data.ips.map(i => [i.ip, i.abuseScore, i.country])
    });

    doc.save("report.pdf");
  };

  // ---------------- SAFE DEFAULT ----------------
  if (!data) {
    return (
      <div style={{ padding: 40, color: "#888" }}>
        Upload a log file or click DEMO
      </div>
    );
  }

  // ---------------- UI ----------------
  return (
    <div className="dashboard">

      {/* HEADER */}
      <div className="top-bar">
        <button onClick={loadDemo}>DEMO</button>

        <label className="upload-btn">
          UPLOAD
          <input type="file" onChange={uploadLog} hidden />
        </label>

        <button onClick={exportPDF}>PDF</button>
      </div>

      {/* STATS */}
      <div className="stats">
        <Card title="EVENTS" value={data.total || 0} color="cyan" />
        <Card title="THREATS" value={data.threats || 0} color="red" />
        <Card title="BLOCKED" value={data.blocked || 0} color="green" />
        <Card title="RISK" value={data.risk || "LOW"} color="purple" />
      </div>

      {/* CHARTS */}
      <div className="charts">
        <div className="chart-box">
          <h4>INGESTION TIMELINE</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.timeline || []}>
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#00f5ff" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h4>SEVERITY</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { name: "High", value: data.threats },
              { name: "Low", value: data.total - data.threats }
            ]}>
              <Bar dataKey="value" fill="#00f5ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MAP + TERMINAL */}
      <div className="grid">
        <div className="map-box">🌍 Map (placeholder)</div>

        <div className="terminal">
          root@loglens:~# tail -f /var/log/attacks
          <br />
          {loading ? "Analyzing..." : "Live stream ready"}
        </div>
      </div>

      {/* TABLE */}
      <div className="table">
        <h4>TOP MALICIOUS SOURCES</h4>

        <table>
          <thead>
            <tr>
              <th>IP</th>
              <th>Score</th>
              <th>Country</th>
            </tr>
          </thead>

          <tbody>
            {data.ips.map((i, idx) => (
              <tr key={idx}>
                <td>{i.ip}</td>
                <td>{i.abuseScore}</td>
                <td>{i.country}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

// ---------------- CARD ----------------
const Card = ({ title, value, color }) => (
  <motion.div className={`card ${color}`} whileHover={{ scale: 1.05 }}>
    <p>{title}</p>
    <h2>{value}</h2>
  </motion.div>
);
