"use client";
import { useState, useEffect, useRef } from "react";
import { getLogs } from "@/lib/api";

export default function LogsTab() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lineCount, setLineCount] = useState(100);
  const [filter, setFilter] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getLogs(lineCount);
      setLines(data.lines || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [lineCount]);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(fetchLogs, 5000);
    return () => clearInterval(iv);
  }, [autoRefresh, lineCount]);

  useEffect(() => {
    if (autoRefresh) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const getLevelColor = (line: string): string => {
    if (line.includes("[ERROR]") || line.includes("[CRITICAL]")) return "#ef4444";
    if (line.includes("[WARNING]")) return "#f59e0b";
    if (line.includes("[INFO]")) return "#00d4ff";
    if (line.includes("[DEBUG]")) return "rgba(226,232,240,0.4)";
    return "#e2e8f0";
  };

  const filtered = filter
    ? lines.filter(l => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>📋 System Logs</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input className="jarvis-input" style={{ width: 200 }} placeholder="Filter logs..."
            value={filter} onChange={e => setFilter(e.target.value)} />
          <select className="jarvis-input" style={{ width: 90 }}
            value={lineCount} onChange={e => setLineCount(parseInt(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", cursor: "pointer", color: "rgba(226,232,240,0.7)" }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: "#00d4ff" }} />
            Auto
          </label>
          <button className="btn-primary" onClick={fetchLogs} disabled={loading}>
            {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : "🔄"}
          </button>
        </div>
      </div>

      {/* Log levels legend */}
      <div style={{ display: "flex", gap: 12, fontSize: "0.75rem" }}>
        {[
          { label: "ERROR", color: "#ef4444" },
          { label: "WARNING", color: "#f59e0b" },
          { label: "INFO", color: "#00d4ff" },
          { label: "DEBUG", color: "rgba(226,232,240,0.4)" },
        ].map(l => (
          <span key={l.label} style={{ color: l.color, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: l.color, display: "inline-block" }} />
            {l.label}
          </span>
        ))}
        <span style={{ color: "rgba(226,232,240,0.3)", marginLeft: "auto" }}>
          {filtered.length} / {lines.length} lines
        </span>
      </div>

      {/* Log terminal */}
      <div style={{
        background: "#000", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8,
        padding: 12, height: 500, overflowY: "auto",
        fontFamily: "'Cascadia Code', 'Fira Code', monospace", fontSize: "0.78rem"
      }}>
        {filtered.length === 0 ? (
          <div style={{ color: "rgba(226,232,240,0.3)", padding: 20, textAlign: "center" }}>
            {loading ? "Loading..." : "No logs found"}
          </div>
        ) : filtered.map((line, i) => (
          <div key={i} style={{
            color: getLevelColor(line),
            marginBottom: 1, padding: "1px 0",
            borderBottom: "1px solid rgba(255,255,255,0.02)"
          }}>
            {line}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
