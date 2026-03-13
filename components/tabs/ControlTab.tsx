"use client";
import { useState } from "react";
import { control, screenshot, webcam, recordScreen, getApiBase, getToken } from "@/lib/api";

type Msg = { type: "success" | "error" | "info"; text: string };

export default function ControlTab() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const [imgData, setImgData] = useState<string | null>(null);
  const [imgLabel, setImgLabel] = useState("");
  const [volume, setVolume] = useState(50);
  const [appName, setAppName] = useState("notepad");
  const [shutdownDelay, setShutdownDelay] = useState(0);
  const [recordDuration, setRecordDuration] = useState(10);
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<any>, onSuccess?: (r: any) => void) => {
    setMsg(null);
    setLoading(label);
    try {
      const r = await fn();
      setMsg({ type: "success", text: `✅ ${label} done` });
      if (onSuccess) onSuccess(r);
    } catch (e: any) {
      setMsg({ type: "error", text: `❌ ${label} failed: ${e.message}` });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Notification */}
      {msg && (
        <div style={{
          padding: "10px 16px", borderRadius: 8, fontSize: "0.875rem",
          background: msg.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
          border: `1px solid ${msg.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
          color: msg.type === "error" ? "#ef4444" : "#10b981"
        }}>
          {msg.text}
        </div>
      )}

      {/* Screen Capture */}
      <Section title="📸 Screen & Camera">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Btn label="Screenshot" cls="btn-primary" loading={loading}
            onClick={() => run("Screenshot", screenshot, r => { setImgData(r.image); setImgLabel("Screenshot"); })} />
          <Btn label="📷 Webcam" cls="btn-primary" loading={loading}
            onClick={() => run("Webcam", webcam, r => { setImgData(r.image); setImgLabel("Webcam"); })} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn label={`🎬 Record ${recordDuration}s`} cls="btn-primary" loading={loading}
              onClick={() => run("Recording", () => recordScreen(recordDuration))} />
            <input type="range" min={3} max={30} value={recordDuration}
              onChange={e => setRecordDuration(parseInt(e.target.value))}
              style={{ width: 80, accentColor: "#00d4ff" }} />
            <span style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.5)" }}>{recordDuration}s</span>
          </div>
        </div>
        {imgData && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.6)" }}>{imgLabel}</span>
              <button style={{ fontSize: "0.75rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setImgData(null)}>✕</button>
            </div>
            <img src={imgData} alt={imgLabel} style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(0,212,255,0.2)" }} />
          </div>
        )}
      </Section>

      {/* Apps */}
      <Section title="🚀 Open Application">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="jarvis-input" style={{ width: 200 }} value={appName}
            onChange={e => setAppName(e.target.value)} placeholder="App name..." />
          <Btn label="▶ Open" cls="btn-primary" loading={loading}
            onClick={() => run(`Open ${appName}`, () => control("open_app", { app: appName }))} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {["notepad", "calc", "chrome", "firefox", "explorer", "taskmgr", "cmd", "powershell"].map(a => (
            <button key={a} className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              onClick={() => { setAppName(a); run(`Open ${a}`, () => control("open_app", { app: a })); }}>
              {a}
            </button>
          ))}
        </div>
      </Section>

      {/* Volume */}
      <Section title="🔊 Volume Control">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.5)", width: 30 }}>🔇</span>
          <input type="range" min={0} max={100} value={volume}
            onChange={e => setVolume(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: "#00d4ff" }} />
          <span style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.5)", width: 30 }}>🔊</span>
          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#00d4ff", width: 44 }}>{volume}%</span>
          <Btn label="Set" cls="btn-primary" loading={loading}
            onClick={() => run(`Volume ${volume}%`, () => control("set_volume", { level: volume }))} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {[0, 25, 50, 75, 100].map(v => (
            <button key={v} className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              onClick={() => { setVolume(v); run(`Volume ${v}%`, () => control("set_volume", { level: v })); }}>
              {v}%
            </button>
          ))}
        </div>
      </Section>

      {/* Power */}
      <Section title="⏻ Power Control">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Btn label="🔒 Lock PC" cls="btn-warning" loading={loading}
            onClick={() => run("Lock", () => control("lock"))} />
          <Btn label={`⏻ Shutdown ${shutdownDelay}s`} cls="btn-danger" loading={loading}
            onClick={() => run("Shutdown", () => control("shutdown", { delay: shutdownDelay }))} />
          <Btn label={`🔄 Restart ${shutdownDelay}s`} cls="btn-danger" loading={loading}
            onClick={() => run("Restart", () => control("restart", { delay: shutdownDelay }))} />
          <Btn label="⛔ Cancel" cls="btn-primary" loading={loading}
            onClick={() => run("Cancel shutdown", () => control("cancel_shutdown"))} />
          <input type="number" min={0} max={3600} value={shutdownDelay} onChange={e => setShutdownDelay(parseInt(e.target.value))}
            className="jarvis-input" style={{ width: 90 }} placeholder="delay sec" />
        </div>
      </Section>

      {/* TTS */}
      <Section title="🔊 Text to Speech">
        <TtsControl loading={loading} run={run} />
      </Section>
    </div>
  );
}

function TtsControl({ loading, run }: any) {
  const [text, setText] = useState("Hello! I am JARVIS, your AI assistant.");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <input className="jarvis-input" value={text} onChange={e => setText(e.target.value)}
        placeholder="Text to speak..." style={{ flex: 1 }} />
      <button className="btn-primary" disabled={!!loading}
        onClick={() => run("Speak", () => control("speak", { text }))}>
        🔊 Speak
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="jarvis-card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

function Btn({ label, cls, onClick, loading }: any) {
  return (
    <button className={cls} onClick={onClick} disabled={!!loading}>
      {loading === label ? <div className="spinner" style={{ width: 14, height: 14 }} /> : label}
    </button>
  );
}
