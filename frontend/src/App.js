import React, { useState } from "react";
import Dashboard from "./components/Dashboard";

function App() {
  const [data, setData] = useState(null);
  return (
    <div className="App" style={{ background: "#05070a", minHeight: "100vh" }}>
      <Dashboard data={data} setData={setData} />
    </div>
  );
}
export default App;
