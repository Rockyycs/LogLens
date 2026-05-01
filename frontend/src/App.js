import React, { useState } from "react";
// Ensure Dashboard.js is located at src/components/Dashboard.js
import Dashboard from "./components/Dashboard";

function App() {
  const [data, setData] = useState(null);

  return (
    <div className="App" style={{ background: "#05070a" }}>
      {/* The old Sidebar has been removed. 
          The new Dashboard component now handles the 
          integrated professional sidebar.
      */}
      <Dashboard data={data} setData={setData} />
    </div>
  );
}

export default App;
