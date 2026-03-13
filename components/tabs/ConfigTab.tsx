"use client";
import { useState, useEffect } from "react";
import { getConfig, updateConfig } from "@/lib/api";

export default function ConfigTab() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editVal, setEditVal] = useState("");

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await getConfig();
      setConfig(data);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveValue = async () => {
    if (!editKey) return;
    setSaving(true);
    try {
      let val: any = editVal;
      if (editVal === "true") val = true;
      else if (editVal === "false") val = false;
      else if (!isNaN(Number(editVal)) && editVal !== "") val = Number(editVal);

      await updateConfig({ [editKey]: val });
      setMsg(`✅ Saved: ${editKey} = ${editVal}`);
      fetchConfig();
      setEditKey("");
      setEditVal("");
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const SENSITIVE = ["telegram_token", "gemini_key", "openai_key", "supabase_key", "supabase_url"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>⚙️ Configuration</h2>
        <button className="btn-primary" onClick={fetchConfig} disabled={loading}>🔄 Refresh</button>
      </div>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: "0.875rem",
          background: msg.startsWith("✅") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: msg.startsWith("✅") ? "#10b981" : "#ef4444"
        }}>{msg}</div>
      )}

      {/* Edit form */}
      <div className="jarvis-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: "0.875rem" }}>✏️ Edit Config Value</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="jarvis-input" style={{ width: 200 }}
            value={editKey} onChange={e => { setEditKey(e.target.value); setEditVal(String(config[e.target.value] ?? "")); }}>
            <option value="">— Select key —</option>
            {Object.keys(config).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input className="jarvis-input" style={{ flex: 1, minWidth: 200 }}
            value={editVal} onChange={e => setEditVal(e.target.value)}
            placeholder="New value..." onKeyDown={e => e.key === "Enter" && saveValue()} />
          <button className="btn-success" onClick={saveValue} disabled={saving || !editKey}>
            {saving ? "Saving..." : "💾 Save"}
          </button>
        </div>
      </div>

      {/* Config display */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div className="jarvis-card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", color: "rgba(226,232,240,0.5)", fontWeight: 500 }}>Key</th>
                <th style={{ padding: "10px 16px", textAlign: "left", color: "rgba(226,232,240,0.5)", fontWeight: 500 }}>Value</th>
                <th style={{ padding: "10px 16px", textAlign: "center", color: "rgba(226,232,240,0.5)", fontWeight: 500 }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config).map(([key, val]) => (
                <tr key={key} style={{ borderBottom: "1px solid rgba(0,212,255,0.05)" }}>
                  <td style={{ padding: "8px 16px" }}>
                    <code style={{ color: "#00d4ff", fontSize: "0.8rem" }}>{key}</code>
                    {SENSITIVE.includes(key) && <span style={{ fontSize: "0.65rem", color: "#f59e0b", marginLeft: 4 }}>🔒</span>}
                  </td>
                  <td style={{ padding: "8px 16px", color: "#e2e8f0", fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {Array.isArray(val) ? `[${val.join(", ")}]` : String(val)}
                  </td>
                  <td style={{ padding: "8px 16px", textAlign: "center" }}>
                    <button className="btn-primary" style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                      onClick={() => { setEditKey(key); setEditVal(Array.isArray(val) ? val.join(", ") : String(val)); }}>
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
