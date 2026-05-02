import React, { useState } from "react";

const Login = ({ setToken }) => {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("loglens_token", data.token);
        setToken(data.token);
      } else {
        alert("ACCESS DENIED: Invalid Credentials");
      }
    } catch (err) {
      alert("Auth Engine Offline");
    }
  };

  const inputStyle = {
    display: "block",
    width: "100%",
    padding: "12px",
    margin: "15px 0",
    background: "#0a0b10",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "6px",
    color: "white",
    outline: "none"
  };

  return (
    <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#0a0b10", fontFamily: "monospace" }}>
      <form onSubmit={handleSubmit} style={{ background: "#161b22", padding: "40px", borderRadius: "12px", border: "1px solid #00f2ff", boxShadow: "0 0 20px rgba(0, 242, 255, 0.2)", width: "350px" }}>
        <h2 style={{ color: "#00f2ff", textAlign: "center", marginBottom: "30px", letterSpacing: "2px" }}>LOGLENS_AUTH</h2>
        <input type="text" placeholder="OPERATOR_ID" onChange={e => setUser(e.target.value)} style={inputStyle} />
        <input type="password" placeholder="ACCESS_KEY" onChange={e => setPass(e.target.value)} style={inputStyle} />
        <button type="submit" style={{ width: "100%", background: "#00f2ff", color: "black", padding: "12px", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", marginTop: "10px" }}>
          INITIALIZE SESSION
        </button>
      </form>
    </div>
  );
};

export default Login;
