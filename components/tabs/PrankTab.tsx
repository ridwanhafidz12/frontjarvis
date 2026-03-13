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
      setMsg({ type: "ok", text: `✅ ${action} executed!` });
    } catch (e: any) {
      setMsg({ type: "err", text: `❌ Error: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>🎭 Prank Tools</h2>
        <p style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.4)", marginTop: 2 }}>
          Fun remote actions on the target PC
        </p>
      </div>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: "0.875rem",
          background: msg.type === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.type === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: msg.type === "ok" ? "#10b981" : "#ef4444"
        }}>{msg.text}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {/* TTS */}
        <div className="jarvis-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>🔊 Text to Speech</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", marginBottom: 12 }}>
            JARVIS speaks text loudly on target PC
          </div>
          <textarea className="jarvis-input" rows={2} value={ttsText}
            onChange={e => setTtsText(e.target.value)} style={{ marginBottom: 8 }} />
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }}
            onClick={() => run("speak", { text: ttsText })} disabled={loading}>
            🔊 Speak Now
          </button>
        </div>

        {/* Black Screen */}
        <div className="jarvis-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>⬛ Black Screen</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", marginBottom: 12 }}>
            Turns screen black for N seconds
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="range" min={1} max={30} value={blackDuration}
              onChange={e => setBlackDuration(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#00d4ff" }} />
            <span style={{ color: "#00d4ff", fontWeight: 700, width: 50 }}>{blackDuration}s</span>
          </div>
          <button className="btn-warning" style={{ width: "100%", justifyContent: "center" }}
            onClick={() => run("blackscreen", { duration: blackDuration })} disabled={loading}>
            ⬛ Black Screen
          </button>
        </div>

        {/* Jumpscare */}
        <div className="jarvis-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>😱 Jumpscare</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", marginBottom: 12 }}>
            Shows scary fullscreen with alarm sound
          </div>
          <input className="jarvis-input" value={jumpMsg}
            onChange={e => setJumpMsg(e.target.value)} style={{ marginBottom: 8 }} />
          <button className="btn-danger" style={{ width: "100%", justifyContent: "center" }}
            onClick={() => run("jumpscare", { message: jumpMsg })} disabled={loading}>
            😱 Jumpscare!
          </button>
        </div>

        {/* Fake BSOD */}
        <div className="jarvis-card" style={{ padding: 16, border: "1px solid rgba(239,68,68,0.2)" }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>💀 Fake BSOD</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", marginBottom: 12 }}>
            Fake Windows Blue Screen of Death
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.5)" }}>Duration:</span>
            <input type="range" min={2} max={30} value={bsodDuration}
              onChange={e => setBsodDuration(parseInt(e.target.value))}
              style={{ flex: 1, accentColor: "#ef4444" }} />
            <span style={{ color: "#ef4444", fontWeight: 700, width: 50 }}>{bsodDuration}s</span>
          </div>
          <button className="btn-danger" style={{ width: "100%", justifyContent: "center" }}
            onClick={() => { if (confirm("Show Fake BSOD?")) run("bsod", { duration: bsodDuration }); }}
            disabled={loading}>
            💀 Fake BSOD
          </button>
        </div>

        {/* Custom Popup */}
        <div className="jarvis-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>💬 Custom Popup</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", marginBottom: 12 }}>
            Show a Windows dialog box
          </div>
          <input className="jarvis-input" value={popupTitle} onChange={e => setPopupTitle(e.target.value)}
            placeholder="Title" style={{ marginBottom: 6 }} />
          <textarea className="jarvis-input" rows={2} value={popupMsg}
            onChange={e => setPopupMsg(e.target.value)} placeholder="Message" style={{ marginBottom: 8 }} />
          <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }}
            onClick={() => run("popup", { title: popupTitle, message: popupMsg })} disabled={loading}>
            💬 Show Popup
          </button>
        </div>

        {/* Sound effects */}
        <div className="jarvis-card" style={{ padding: 16 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>🔔 Sound Effects</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", marginBottom: 12 }}>
            Play system sounds
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["beep", "error", "critical"].map(s => (
              <button key={s} className="btn-primary" onClick={() => run("play_sound", { type: s })}
                disabled={loading} style={{ justifyContent: "center" }}>
                🔔 {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
