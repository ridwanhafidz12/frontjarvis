"use client";
import { useState } from "react";
import { control, screenshot, webcam, recordScreen } from "@/lib/api";

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
      setMsg({ type: "success", text: `✅ ${label} completed` });
      if (onSuccess) onSuccess(r);
    } catch (e: any) {
      setMsg({ type: "error", text: `❌ ${label} failed: ${e.message}` });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Notification */}
      {msg && (
        <div className="fade-in" style={{
          padding: "12px 16px", borderRadius: 10, fontSize: "0.9rem", fontWeight: 500,
          background: msg.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
          border: `1px solid ${msg.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
          color: msg.type === "error" ? "#ef4444" : "#10b981"
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
        {/* Screen Capture */}
        <Section title="📸 Screen & Camera">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <Btn label="Screenshot" cls="btn-primary" loading={loading}
              onClick={() => run("Screenshot", screenshot, r => { setImgData(r.image); setImgLabel("Screenshot"); })} />
            <Btn label="📷 Webcam" cls="btn-primary" loading={loading}
              onClick={() => run("Webcam", webcam, r => { setImgData(r.image); setImgLabel("Webcam"); })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 8 }}>
            <Btn label={`🎬 Record`} cls="btn-primary" loading={loading}
              onClick={() => run("Recording", () => recordScreen(recordDuration))} />
            <input type="range" min={3} max={60} value={recordDuration}
              onChange={e => setRecordDuration(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#00d4ff" }} />
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#00d4ff", width: 30 }}>{recordDuration}s</span>
          </div>
          {imgData && (
            <div className="fade-in" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(226,232,240,0.6)" }}>{imgLabel} Preview</span>
                <button style={{ fontSize: "0.75rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => setImgData(null)}>✕ Close</button>
              </div>
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid var(--jarvis-primary)" }}>
                <img src={imgData} alt={imgLabel} style={{ width: "100%", display: "block" }} />
              </div>
            </div>
          )}
        </Section>

        {/* Apps */}
        <Section title="🚀 Application Launcher">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="jarvis-input" style={{ flex: 1 }} value={appName}
              onChange={e => setAppName(e.target.value)} placeholder="Enter process name..." />
            <Btn label="▶ Launch" cls="btn-primary" loading={loading}
              onClick={() => run(`Launch ${appName}`, () => control("open_app", { app: appName }))} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["notepad", "calc", "chrome", "firefox", "explorer", "taskmgr", "cmd", "powershell"].map(a => (
              <button key={a} className="btn-primary" style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 6 }}
                onClick={() => { setAppName(a); run(`Open ${a}`, () => control("open_app", { app: a })); }}>
                {a}
              </button>
            ))}
          </div>
        </Section>

        {/* Volume */}
        <Section title="🔊 System Volume">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: "1.2rem" }}>{volume === 0 ? "🔇" : volume < 50 ? "🔉" : "🔊"}</span>
            <input type="range" min={0} max={100} value={volume}
              onChange={e => setVolume(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#00d4ff" }} />
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "#00d4ff", width: 45 }}>{volume}%</span>
            <Btn label="Apply" cls="btn-primary" loading={loading}
              onClick={() => run(`Set Volume ${volume}%`, () => control("set_volume", { level: volume }))} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 25, 50, 75, 100].map(v => (
              <button key={v} className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 12px", borderRadius: 6 }}
                onClick={() => { setVolume(v); run(`Set Volume ${v}%`, () => control("set_volume", { level: v })); }}>
                {v}%
              </button>
            ))}
          </div>
        </Section>

        {/* Power */}
        <Section title="⏻ Power Operations">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Btn label="🔒 Lock PC" cls="btn-warning" loading={loading}
              onClick={() => run("Lock", () => control("lock"))} />
            <Btn label="⛔ Cancel Cmd" cls="btn-primary" loading={loading}
              onClick={() => run("Cancel", () => control("cancel_shutdown"))} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(239,68,68,0.05)", padding: 12, borderRadius: 10, border: "1px solid rgba(239,68,68,0.1)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.7rem", color: "rgba(239,68,68,0.6)", marginBottom: 4, fontWeight: 700 }}>DELAY (SEC)</div>
              <input type="number" min={0} max={3600} value={shutdownDelay} onChange={e => setShutdownDelay(parseInt(e.target.value))}
                className="jarvis-input" style={{ width: "100%", textAlign: "center" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Btn label="⏻ Shutdown" cls="btn-danger" loading={loading}
                onClick={() => { if(confirm("Shutdown remote PC?")) run("Shutdown", () => control("shutdown", { delay: shutdownDelay })) }} />
              <Btn label="🔄 Restart" cls="btn-danger" loading={loading}
                onClick={() => { if(confirm("Restart remote PC?")) run("Restart", () => control("restart", { delay: shutdownDelay })) }} />
            </div>
          </div>
        </Section>

        {/* TTS */}
        <Section title="🗣️ Text to Speech">
          <TtsControl loading={loading} run={run} />
        </Section>
      </div>
    </div>
  );
}

function TtsControl({ loading, run }: any) {
  const [text, setText] = useState("Hello! I am JARVIS, your AI assistant.");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <textarea className="jarvis-input" value={text} onChange={e => setText(e.target.value)}
        placeholder="Type message to speak..." style={{ width: "100%", minHeight: 60, resize: "none" }} />
      <button className="btn-primary" disabled={!!loading} style={{ justifyContent: "center", padding: 10 }}
        onClick={() => run("Speak", () => control("speak", { text }))}>
        🗣️ Speak Now
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="jarvis-card" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
      <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--jarvis-primary)", marginBottom: 16, borderBottom: "1px solid rgba(0,212,255,0.1)", paddingBottom: 8 }}>{title}</h3>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Btn({ label, cls, onClick, loading }: any) {
  return (
    <button className={cls} onClick={onClick} disabled={!!loading} style={{ flex: 1, justifyContent: "center", padding: "8px 12px" }}>
      {loading === label ? <div className="spinner" style={{ width: 14, height: 14 }} /> : label}
    </button>
  );
}
