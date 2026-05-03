import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";

function App() {
  const [data, setData] = useState({
    ingested_events: 0,
    active_threats: 0,
    avg_abuse_confidence: 0,
    firewall_blocks: 0,
    threats: [], // The actual list of analyzed logs
  });

  const [loading, setLoading] = useState(false);

  // REPLACE THIS with your actual Render backend URL
  const API_BASE_URL = "https://your-backend-name.onrender.com";

  /**
   * Handles the log file upload to the backend.
   * This sends the file to your live Render server for analysis.
   */
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("logFile", file); // Ensure 'logFile' matches your backend upload.single()

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
        // Note: Do NOT set 'Content-Type' header manually; 
        // the browser will set it to 'multipart/form-data' with the boundary.
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Analysis Result:", result);

      // Assuming your backend returns an object with stats and a list of threats
      setData(result); 
      
    } catch (error) {
      console.error("Critical Upload Error:", error);
      alert("Failed to connect to the backend. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" style={{ background: "#05070a", minHeight: "100vh", color: "white" }}>
      {/* 
          Pass the data, the setter, and the upload handler down to Dashboard.
          This allows you to trigger the upload from the 'UPLOAD_LOG' button.
      */}
      <Dashboard 
        data={data} 
        setData={setData} 
        handleFileUpload={handleFileUpload}
        loading={loading}
      />
    </div>
  );
}

export default App;
