import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";

function App() {
  // Check localStorage for an existing session token on startup
  const [token, setToken] = useState(localStorage.getItem("loglens_token"));
  const [data, setData] = useState(null);

  // Optional: Sync state if localStorage changes in another tab
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem("loglens_token"));
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <div className="App" style={{ background: "#05070a", minHeight: "100vh" }}>
      {/* 
          GATEKEEPER LOGIC:
          If no token is found, show the Login screen.
          Once setToken is called with a valid string, React will 
          automatically render the Dashboard.
      */}
      {!token ? (
        <Login setToken={setToken} />
      ) : (
        <Dashboard data={data} setData={setData} />
      )}
    </div>
  );
}

export default App;
