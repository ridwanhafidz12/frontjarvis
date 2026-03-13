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
    if (!cmd.trim()) return;

    setLines(prev => [...prev, { type: "cmd", text: `PS ${cwd}> ${cmd}` }]);
    setHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setLoading(true);

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
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      runCmd(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : history[idx] || "");
    }
  };

  const QUICK_CMDS = [
    "Get-Process | Select-Object -First 10 Name, CPU, WorkingSet",
    "dir C:\\Users\\$env:USERNAME\\Desktop",
    "ipconfig",
    "systeminfo | Select-Object -First 5",
    "Get-Date",
    "whoami",
    "tasklist | findstr chrome",
    "netstat -an | findstr LISTENING",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>💻 Interactive Shell</h2>
        <button className="btn-danger" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
          onClick={() => setLines([{ type: "out", text: "Terminal cleared." }])}>
          🗑 Clear
        </button>
      </div>

      {/* Quick commands */}
      <div className="jarvis-card" style={{ padding: 12 }}>
        <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.5)", marginBottom: 8 }}>⚡ Quick Commands</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_CMDS.map(cmd => (
            <button key={cmd} className="btn-primary" style={{ fontSize: "0.7rem", padding: "3px 8px" }}
              onClick={() => { setInput(cmd); inputRef.current?.focus(); }}>
              {cmd.split("|")[0].trim().substring(0, 30)}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal output */}
      <div className="terminal" onClick={() => inputRef.current?.focus()}
        style={{ height: 400, cursor: "text" }}>
        {lines.map((line, i) => (
          <div key={i} style={{ marginBottom: 2 }}>
            {line.type === "cmd" && <span className="prompt">{line.text}</span>}
            {line.type === "out" && <span className="output" style={{ whiteSpace: "pre-wrap" }}>{line.text}</span>}
            {line.type === "err" && <span className="error">{line.text}</span>}
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="spinner" style={{ width: 12, height: 12, borderColor: "rgba(0,212,255,0.2)", borderTopColor: "#00d4ff" }} />
            <span style={{ color: "rgba(0,212,255,0.6)", fontSize: "0.8rem" }}>Executing...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 8, background: "#000",
        border: "1px solid rgba(0,212,255,0.3)", borderRadius: 8, padding: "8px 12px",
        alignItems: "center"
      }}>
        <span style={{ color: "#10b981", fontFamily: "monospace", fontSize: "0.85rem", flexShrink: 0 }}>
          PS {cwd.length > 30 ? "..." + cwd.slice(-27) : cwd}&gt;
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Type PowerShell command..."
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#00d4ff", fontFamily: "monospace", fontSize: "0.85rem"
          }}
          id="terminal-input"
          autoFocus
        />
        <button className="btn-primary" style={{ padding: "4px 12px", fontSize: "0.8rem" }}
          onClick={() => runCmd(input)} disabled={loading}>
          ▶ Run
        </button>
      </div>
    </div>
  );
}
