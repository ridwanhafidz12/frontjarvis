"use client";
import { useState, useEffect, useRef } from "react";
import { getApiBase, getToken } from "@/lib/api";

interface Line { type: "cmd" | "out" | "err"; text: string }

export default function TerminalTab() {
  const [lines, setLines] = useState<Line[]>([
    { type: "out", text: "JARVIS Interactive Shell v2.0" },
    { type: "out", text: "Type commands below. Results execute on the remote PC." },
    { type: "out", text: '─────────────────────────────' },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [cwd, setCwd] = useState("C:\\");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const runCmd = async (cmd: string) => {
    if (!cmd.trim() || loading) return;

    setLines(prev => [...prev, { type: "cmd", text: `PS ${cwd}> ${cmd}` }]);
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setLoading(true);
    setInput("");

    try {
      const base = getApiBase();
      const token = getToken();
      const resp = await fetch(`${base}/api/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "run_cmd", params: { cmd } }),
      });
      const data = await resp.json();
      const output = data.output || "(no output)";
      setLines(prev => [...prev, { type: "out", text: output }]);
    } catch (e: any) {
      setLines(prev => [...prev, { type: "err", text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      runCmd(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      if (idx >= 0) {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : history[idx]);
    }
  };

  const QUICK_CMDS = [
    "Get-Process | Select-Object -First 10 Name, CPU, WorkingSet",
    "dir C:\\Users\\$env:USERNAME\\Desktop",
    "ipconfig",
    "systeminfo | Select-Object -First 5",
    "Get-Date",
    "whoami",
    "tasklist",
    "netstat -an",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 180px)", minHeight: 450 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>💻 Interactive Shell</h2>
        <button className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}
          onClick={() => setLines([{ type: "out", text: "Terminal cleared." }])}>
          🗑 Clear
        </button>
      </div>

      {/* Quick commands */}
      <div className="jarvis-card" style={{ padding: 12, background: "rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.4)", marginBottom: 8, fontWeight: 700, letterSpacing: "0.05em" }}>⚡ QUICK COMMANDS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_CMDS.map(cmd => (
            <button key={cmd} className="btn-primary" style={{ fontSize: "0.65rem", padding: "4px 8px", borderRadius: 4, background: "rgba(255,255,255,0.03)" }}
              onClick={() => { setInput(cmd); inputRef.current?.focus(); }}>
              {cmd.split("|")[0].trim().substring(0, 20)}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Display */}
      <div style={{
        flex: 1, background: "#05070a", borderRadius: 12, padding: 16,
        fontFamily: "'Cascadia Code', 'Consolas', monospace", fontSize: "0.85rem",
        overflowY: "auto", border: "1px solid rgba(0,212,255,0.15)",
        boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)"
      }}>
        {lines.map((line, i) => (
          <div key={i} style={{ 
            color: line.type === "cmd" ? "#00d4ff" : line.type === "err" ? "#ef4444" : "#e2e8f0",
            marginBottom: 4, whiteSpace: "pre-wrap", wordBreak: "break-all",
            opacity: line.type === "cmd" ? 1 : 0.9
          }}>
            {line.type === "cmd" ? "" : ""}
            {line.text}
          </div>
        ))}
        {loading && (
          <div style={{ color: "#00d4ff", opacity: 0.7, animation: "pulse 1s infinite" }}>
            ▒ Executing command...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Line */}
      <div style={{
        display: "flex", gap: 10, background: "#05070a", border: "1px solid rgba(0,212,255,0.3)",
        borderRadius: 8, padding: "10px 14px", alignItems: "center"
      }}>
        <span style={{ color: "#00d4ff", fontWeight: 700, fontSize: "0.85rem" }}>PS&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Enter PowerShell command..."
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#e2e8f0", fontSize: "0.85rem", fontFamily: "monospace"
          }}
        />
        {loading && <div className="spinner" style={{ width: 14, height: 14 }} />}
      </div>
    </div>
  );
}
