import React, { useEffect, useState } from "react";

function LogsTable() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [attackFilter, setAttackFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const [sortField, setSortField] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");

  const [page, setPage] = useState(1);
  const rowsPerPage = 5;

  useEffect(() => {
    fetch("http://localhost:5000/logs")
      .then((res) => res.json())
      .then((data) => setLogs(data));
  }, []);

  const severityColor = (sev) => {
    if (sev === "high") return "#ff4d4f";
    if (sev === "medium") return "#ffa940";
    return "#52c41a";
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = logs
    .filter((log) => {
      const matchesSearch =
        log.ip?.toLowerCase().includes(search.toLowerCase()) ||
        log.path?.toLowerCase().includes(search.toLowerCase());

      const matchesAttack =
        attackFilter === "" || log.attack_type === attackFilter;

      const matchesSeverity =
        severityFilter === "" || log.severity === severityFilter;

      return matchesSearch && matchesAttack && matchesSeverity;
    })
    .sort((a, b) => {
      if (!a[sortField]) return 0;
      return sortOrder === "asc"
        ? a[sortField] > b[sortField]
          ? 1
          : -1
        : a[sortField] < b[sortField]
        ? 1
        : -1;
    });

  const start = (page - 1) * rowsPerPage;
  const paginatedLogs = filtered.slice(start, start + rowsPerPage);

  return (
    <div style={{ marginTop: "30px" }}>
      <h2 style={{ color: "#fff" }}>📄 Logs Explorer</h2>

      {/* FILTERS */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          placeholder="🔍 Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select onChange={(e) => setAttackFilter(e.target.value)}>
          <option value="">All Attacks</option>
          <option value="sql_injection">SQL Injection</option>
          <option value="xss">XSS</option>
          <option value="directory_traversal">Traversal</option>
          <option value="scanner">Scanner</option>
          <option value="brute_force">Brute Force</option>
        </select>

        <select onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="">All Severity</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* TABLE */}
      <table style={{ width: "100%", background: "#0b1220" }}>
        <thead>
          <tr>
            {["ip", "timestamp", "method", "path", "status"].map((field) => (
              <th
                key={field}
                onClick={() => handleSort(field)}
                style={{ cursor: "pointer" }}
              >
                {field.toUpperCase()}
              </th>
            ))}
            <th>Attack</th>
            <th>Severity</th>
          </tr>
        </thead>

        <tbody>
          {paginatedLogs.map((log, i) => (
            <tr
              key={i}
              onClick={() => setSelectedLog(log)}
              style={{
                background:
                  log.severity === "high"
                    ? "rgba(255,0,0,0.1)"
                    : "transparent",
              }}
            >
              <td>{log.ip}</td>
              <td>{log.timestamp}</td>
              <td>{log.method}</td>
              <td>{log.path}</td>
              <td>{log.status}</td>
              <td>{log.attack_type}</td>

              {/* Animated Severity */}
              <td>
                <span
                  style={{
                    background: severityColor(log.severity),
                    padding: "4px 10px",
                    borderRadius: "6px",
                    animation:
                      log.severity === "high"
                        ? "pulse 1s infinite"
                        : "none",
                  }}
                >
                  {log.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* PAGINATION */}
      <div style={{ marginTop: "10px" }}>
        <button onClick={() => setPage(page - 1)} disabled={page === 1}>
          Prev
        </button>
        <span style={{ margin: "0 10px" }}>Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={start + rowsPerPage >= filtered.length}
        >
          Next
        </button>
      </div>

      {/* DETAILS */}
      {selectedLog && (
        <div style={{ marginTop: "20px", color: "#0f0" }}>
          <h3>🔍 Log Details</h3>
          <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
          <button onClick={() => setSelectedLog(null)}>Close</button>
        </div>
      )}

      {/* ANIMATION */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}

export default LogsTable;
