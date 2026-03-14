"use client";
import { useState } from "react";
import { control } from "@/lib/api";

interface Prank { id: string; icon: string; label: string; desc: string; action: string; params?: any; cls: string; confirm?: boolean }

const PRANKS: Prank[] = [
  { id: "speak", icon: "🔊", label: "Text to Speech", desc: "JARVIS speaks text out loud on target PC", action: "speak", cls: "btn-primary", params: {} },
  { id: "blackscreen", icon: "⬛", label: "Black Screen", desc: "Turn screen black for N seconds", action: "blackscreen", cls: "btn-warning", params: { duration: 5 } },
  { id: "jumpscare", icon: "😱", label: "Jumpscare", desc: "Show a scary popup with alarm sound", action: "jumpscare", cls: "btn-danger", params: {} },
  { id: "bsod", icon: "💀", label: "Fake BSOD", desc: "Simulate Blue Screen of Death", action: "bsod", cls: "btn-danger", params: { duration: 5 }, confirm: true },
  { id: "popup", icon: "💬", label: "Custom Popup", desc: "Show a Windows message popup", action: "popup", cls: "btn-primary", params: {} },
  { id: "beep", icon: "🔔", label: "System Beep", desc: "Play system beep sound", action: "play_sound", cls: "btn-primary", params: { type: "beep" } },
  { id: "error", icon: "🚨", label: "Error Sound", desc: "Play error alarm sound", action: "play_sound", cls: "btn-danger", params: { type: "error" } },
];

export default function PrankTab() {
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [ttsText, setTtsText] = useState("Hello from JARVIS!");
  const [bsodDuration, setBsodDuration] = useState(5);
  const [blackDuration, setBlackDuration] = useState(5);
  const [jumpMsg, setJumpMsg] = useState("BOO! 😱");
  const [popupTitle, setPopupTitle] = useState("JARVIS");
  const [popupMsg, setPopupMsg] = useState("This is a test message from JARVIS!");

  const run = async (action: string, params: Record<string, any>) => {
    setLoading(true);
    setMsg(null);
    try {
      await control(action, params);
      setMsg({ type: "ok", text: `✅ ${action} executed successfully!` });
    } catch (e: any) {
      setMsg({ type: "err", text: `❌ Error: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#e2e8f0" }}>🎭 Prank & Fun Tools</h2>
        <p style={{ fontSize: "0.85rem", color: "rgba(226,232,240,0.4)", marginTop: 4 }}>
          Remotely interact with the target computer in a fun way.
        </p>
      </div>

      {msg && (
        <div className="fade-in" style={{
          padding: "12px 16px", borderRadius: 10, fontSize: "0.9rem", fontWeight: 500,
          background: msg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: msg.type === "ok" ? "#10b981" : "#ef4444"
        }}>{msg.text}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {/* TTS */}
        <div className="jarvis-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>🔊</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>Text to Speech</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>Speak text loudly</div>
            </div>
          </div>
          <textarea className="jarvis-input" rows={2} value={ttsText}
            onChange={e => setTtsText(e.target.value)} style={{ width: "100%", marginBottom: 12, resize: "none" }} />
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "10px" }}
            onClick={() => run("speak", { text: ttsText })} disabled={loading}>
            🔊 Speak Now
          </button>
        </div>

        {/* Black Screen */}
        <div className="jarvis-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>⬛</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>Black Screen</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>Temporary blackout</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <input type="range" min={1} max={60} value={blackDuration}
              onChange={e => setBlackDuration(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#00d4ff" }} />
            <span style={{ color: "#00d4ff", fontWeight: 800, width: 40 }}>{blackDuration}s</span>
          </div>
          <button className="btn-warning" style={{ width: "100%", justifyContent: "center", padding: "10px" }}
            onClick={() => run("blackscreen", { duration: blackDuration })} disabled={loading}>
            ⬛ Activate
          </button>
        </div>

        {/* Jumpscare */}
        <div className="jarvis-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>😱</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>Jumpscare</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>Fullscreen scary alert</div>
            </div>
          </div>
          <input className="jarvis-input" value={jumpMsg}
            onChange={e => setJumpMsg(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
          <button className="btn-danger" style={{ width: "100%", justifyContent: "center", padding: "10px" }}
            onClick={() => run("jumpscare", { message: jumpMsg })} disabled={loading}>
            😱 Send Jumpscare
          </button>
        </div>

        {/* Fake BSOD */}
        <div className="jarvis-card" style={{ padding: 20, border: "1px solid rgba(239,68,68,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>💀</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#ef4444" }}>Fake BSOD</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>Simulate system crash</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <input type="range" min={2} max={60} value={bsodDuration}
              onChange={e => setBsodDuration(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#ef4444" }} />
            <span style={{ color: "#ef4444", fontWeight: 800, width: 40 }}>{bsodDuration}s</span>
          </div>
          <button className="btn-danger" style={{ width: "100%", justifyContent: "center", padding: "10px" }}
            onClick={() => { if (confirm("Show Fake BSOD? This will block the user's screen temporarily.")) run("bsod", { duration: bsodDuration }); }}
            disabled={loading}>
            💀 Show BSOD
          </button>
        </div>

        {/* Custom Popup */}
        <div className="jarvis-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>💬</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>Custom Popup</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>Show Windows dialog</div>
            </div>
          </div>
          <input className="jarvis-input" value={popupTitle} onChange={e => setPopupTitle(e.target.value)}
            placeholder="Title" style={{ width: "100%", marginBottom: 8 }} />
          <textarea className="jarvis-input" rows={2} value={popupMsg}
            onChange={e => setPopupMsg(e.target.value)} placeholder="Message" style={{ width: "100%", marginBottom: 12, resize: "none" }} />
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "10px" }}
            onClick={() => run("popup", { title: popupTitle, message: popupMsg })} disabled={loading}>
            💬 Show Popup
          </button>
        </div>

        {/* Sound effects */}
        <div className="jarvis-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "1.5rem" }}>🔔</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>Sound Effects</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>Play system alerts</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["beep", "error", "critical", "success"].map(s => (
              <button key={s} className={s === "error" || s === "critical" ? "btn-danger" : "btn-primary"} 
                onClick={() => run("play_sound", { type: s })}
                disabled={loading} style={{ justifyContent: "center", textTransform: "capitalize" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
