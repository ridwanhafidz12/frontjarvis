"use client";
import { useState, useCallback, useRef, ReactNode } from "react";
import { control } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
type MsgState = { ok: boolean; text: string } | null;

// ── Voice definitions ──────────────────────────────────────────────────────

interface VoiceOption {
  id:       string;
  label:    string;
  lang:     string;
  flag:     string;
  // backend params sent to pyttsx3 / Windows SAPI
  rate?:    number;   // speed: 80-300, default 200
  volume?:  number;   // 0.0-1.0
  gender?:  "male" | "female";
  pitch?:   number;   // not all engines support
}

const VOICE_OPTIONS: VoiceOption[] = [
  // ── Indonesia ──────────────────────────────────────────────────────────
  { id: "id-female-normal",  label: "Perempuan Normal",   lang: "id-ID", flag: "🇮🇩", rate: 185, volume: 1.0, gender: "female" },
  { id: "id-female-slow",    label: "Perempuan Lambat",   lang: "id-ID", flag: "🇮🇩", rate: 140, volume: 1.0, gender: "female" },
  { id: "id-male-normal",    label: "Laki-laki Normal",   lang: "id-ID", flag: "🇮🇩", rate: 185, volume: 1.0, gender: "male"   },
  { id: "id-male-deep",      label: "Laki-laki Dalam",    lang: "id-ID", flag: "🇮🇩", rate: 160, volume: 1.0, gender: "male"   },
  { id: "id-whisper",        label: "Bisikan",             lang: "id-ID", flag: "🇮🇩", rate: 150, volume: 0.4, gender: "female" },
  { id: "id-robot",          label: "Suara Robot",         lang: "id-ID", flag: "🇮🇩", rate: 220, volume: 1.0, gender: "male"   },
  { id: "id-fast",           label: "Super Cepat",         lang: "id-ID", flag: "🇮🇩", rate: 280, volume: 1.0, gender: "female" },
  // ── English ────────────────────────────────────────────────────────────
  { id: "en-female-normal",  label: "Female Normal",       lang: "en-US", flag: "🇺🇸", rate: 190, volume: 1.0, gender: "female" },
  { id: "en-male-normal",    label: "Male Normal",         lang: "en-US", flag: "🇺🇸", rate: 185, volume: 1.0, gender: "male"   },
  { id: "en-male-deep",      label: "Male Deep",           lang: "en-US", flag: "🇺🇸", rate: 160, volume: 1.0, gender: "male"   },
  { id: "en-fast",           label: "Fast Talker",         lang: "en-US", flag: "🇺🇸", rate: 280, volume: 1.0, gender: "female" },
  { id: "en-slow-serious",   label: "Slow & Serious",      lang: "en-US", flag: "🇺🇸", rate: 135, volume: 1.0, gender: "male"   },
  { id: "en-whisper",        label: "Whisper",             lang: "en-US", flag: "🇺🇸", rate: 150, volume: 0.35, gender: "female" },
  // ── Other languages ────────────────────────────────────────────────────
  { id: "ms-female",         label: "Melayu Perempuan",    lang: "ms-MY", flag: "🇲🇾", rate: 185, volume: 1.0, gender: "female" },
  { id: "ms-male",           label: "Melayu Laki-laki",    lang: "ms-MY", flag: "🇲🇾", rate: 185, volume: 1.0, gender: "male"   },
  { id: "en-gb-female",      label: "British Female",      lang: "en-GB", flag: "🇬🇧", rate: 185, volume: 1.0, gender: "female" },
  { id: "en-gb-male",        label: "British Male",        lang: "en-GB", flag: "🇬🇧", rate: 175, volume: 1.0, gender: "male"   },
];

// Group voices by language
const VOICE_GROUPS = [
  { label: "🇮🇩 Bahasa Indonesia", ids: VOICE_OPTIONS.filter(v => v.lang === "id-ID").map(v => v.id) },
  { label: "🇺🇸 English (US)",     ids: VOICE_OPTIONS.filter(v => v.lang === "en-US").map(v => v.id) },
  { label: "🇲🇾 Bahasa Melayu",    ids: VOICE_OPTIONS.filter(v => v.lang === "ms-MY").map(v => v.id) },
  { label: "🇬🇧 English (UK)",     ids: VOICE_OPTIONS.filter(v => v.lang === "en-GB").map(v => v.id) },
];

// ── Quick TTS by language ──────────────────────────────────────────────────

const QUICK_TTS_ID = [
  "Halo! JARVIS sedang mengawasi kamu.",
  "Jangan panik. Semuanya baik-baik saja.",
  "Peringatan sistem: akses tidak sah terdeteksi.",
  "Perhatian! JARVIS mengambil alih kendali.",
  "Baterai hampir habis, segera charger.",
  "Seseorang sedang melihatmu sekarang.",
  "Komputer ini sedang dimonitor dari jarak jauh.",
];

const QUICK_TTS_EN = [
  "I see you. I'm always watching.",
  "Don't panic. Everything is under control.",
  "System alert: unauthorized access detected.",
  "Attention! JARVIS is now taking control.",
  "This machine has been compromised.",
  "Someone is monitoring your activity right now.",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function useRunner() {
  const [loading, setLoading] = useState<string | null>(null);
  const [msg,     setMsg]     = useState<MsgState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (
    id:     string,
    action: string,
    params: Record<string, unknown>,
    label:  string,
  ) => {
    setMsg(null);
    setLoading(id);
    try {
      await control(action, params);
      if (timer.current) clearTimeout(timer.current);
      setMsg({ ok: true, text: `✅ ${label} berhasil` });
      timer.current = setTimeout(() => setMsg(null), 3500);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg({ ok: false, text: `❌ ${label} gagal: ${m}` });
    } finally {
      setLoading(null);
    }
  }, []);

  return { loading, msg, setMsg, run };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PrankCard({ icon, title, subtitle, danger = false, children }: {
  icon: string; title: string; subtitle: string; danger?: boolean; children: ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(6,10,22,0.6)",
      border: `1px solid ${danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 14, padding: "18px 18px",
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: danger ? "rgba(239,68,68,0.1)" : "rgba(0,212,255,0.07)",
          border: `1px solid ${danger ? "rgba(239,68,68,0.2)" : "rgba(0,212,255,0.15)"}`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35rem",
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: danger ? "#ef4444" : "#e2e8f0" }}>{title}</div>
          <div style={{ fontSize: "0.71rem", color: "rgba(226,232,240,0.4)", marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function RunBtn({ id, label, loading, onClick, danger = false, disabled = false }: {
  id: string; label: string; loading: string | null;
  onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  const isLoading = loading === id;
  return (
    <button
      onClick={onClick}
      disabled={!!loading || disabled}
      style={{
        width: "100%", borderRadius: 9, padding: "10px",
        fontSize: "0.85rem", fontWeight: 700,
        background: danger ? "rgba(239,68,68,0.12)" : "rgba(0,212,255,0.1)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : "rgba(0,212,255,0.25)"}`,
        color: danger ? "#ef4444" : "#00d4ff",
        cursor: !!loading || disabled ? "not-allowed" : "pointer",
        opacity: !!loading && !isLoading ? 0.5 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        fontFamily: "inherit", transition: "all 0.15s",
      }}
    >
      {isLoading
        ? <span style={{
            width: 14, height: 14, borderRadius: "50%",
            border: `2px solid ${danger ? "#ef4444" : "#00d4ff"}`,
            borderTopColor: "transparent", display: "inline-block",
            animation: "prank-spin 0.7s linear infinite",
          }} />
        : label}
    </button>
  );
}

function RangeInput({ min, max, value, onChange, accent = "#00d4ff", label }: {
  min: number; max: number; value: number;
  onChange: (v: number) => void; accent?: string; label?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {label && <span style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>{label}</span>}
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        style={{ flex: 1, accentColor: accent }} />
      <span style={{ color: accent, fontWeight: 800, fontFamily: "monospace", fontSize: "0.85rem", minWidth: 38, textAlign: "right" }}>
        {value}s
      </span>
    </div>
  );
}

function InputField({ value, onChange, placeholder, multiline = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const base: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: "0.85rem",
    fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box",
  };
  if (multiline) return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={2}
      style={{ ...base, resize: "none" }} />
  );
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={base} />
  );
}

// ── TTS Voice selector ─────────────────────────────────────────────────────

function VoiceSelector({ selected, onSelect }: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const voice = VOICE_OPTIONS.find(v => v.id === selected)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Selected voice preview */}
      <div style={{
        background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 9, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
        flexWrap: "wrap",
      }}>
        <span style={{ fontSize: "1.3rem" }}>{voice.flag}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#00d4ff" }}>{voice.label}</div>
          <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.4)" }}>
            {voice.lang} · Kecepatan {voice.rate} · Volume {Math.round((voice.volume ?? 1) * 100)}%
            {voice.gender === "female" ? " · ♀" : " · ♂"}
          </div>
        </div>
        <span style={{ fontSize: "0.7rem", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff", borderRadius: 6, padding: "2px 8px" }}>
          Aktif
        </span>
      </div>

      {/* Groups */}
      {VOICE_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            {group.label}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
            {VOICE_OPTIONS.filter(v => group.ids.includes(v.id)).map(v => (
              <button
                key={v.id}
                onClick={() => onSelect(v.id)}
                style={{
                  background: selected === v.id ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selected === v.id ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 8, padding: "8px 10px",
                  cursor: "pointer", fontFamily: "inherit",
                  color: selected === v.id ? "#00d4ff" : "rgba(226,232,240,0.6)",
                  fontSize: "0.78rem", fontWeight: selected === v.id ? 700 : 400,
                  display: "flex", alignItems: "center", gap: 6, textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "1rem" }}>{v.flag}</span>
                <div>
                  <div>{v.label}</div>
                  <div style={{ fontSize: "0.62rem", opacity: 0.5, marginTop: 1 }}>
                    {v.rate} wpm · {v.gender === "female" ? "♀" : "♂"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const SOUND_EFFECTS = [
  { label: "🔔 Beep",      type: "beep",     danger: false },
  { label: "❌ Error",     type: "error",    danger: true  },
  { label: "💀 Critical",  type: "critical", danger: true  },
  { label: "✅ Success",   type: "success",  danger: false },
  { label: "⚠️ Warning",   type: "warning",  danger: true  },
  { label: "🚨 Alarm",     type: "alarm",    danger: true  },
];

export default function PrankTab() {
  const { loading, msg, setMsg, run } = useRunner();

  // TTS
  const [ttsText,     setTtsText]     = useState("Halo! JARVIS sedang mengawasi kamu.");
  const [voiceId,     setVoiceId]     = useState("id-female-normal");
  const [quickLang,   setQuickLang]   = useState<"id" | "en">("id");

  // Blackscreen
  const [blackDur,    setBlackDur]    = useState(10);

  // Jumpscare
  const [jumpMsg,     setJumpMsg]     = useState("BOO! 😱");

  // BSOD
  const [bsodDur,     setBsodDur]     = useState(10);

  // Popup
  const [popTitle,    setPopTitle]    = useState("JARVIS");
  const [popMsg,      setPopMsg]      = useState("This message is brought to you by JARVIS.");

  // Marquee
  const [marquee,     setMarquee]     = useState("JARVIS was here 👀");

  // Build voice params from selected voice
  const buildVoiceParams = () => {
    const v = VOICE_OPTIONS.find(x => x.id === voiceId) ?? VOICE_OPTIONS[0];
    return {
      text:   ttsText,
      lang:   v.lang,
      rate:   v.rate ?? 185,
      volume: v.volume ?? 1.0,
      gender: v.gender ?? "female",
    };
  };

  const quickMessages = quickLang === "id" ? QUICK_TTS_ID : QUICK_TTS_EN;

  return (
    <>
      <style>{`
        @keyframes prank-spin { to { transform: rotate(360deg); } }
        @keyframes prank-up   { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 4px" }}>
            🎭 Prank & Fun Tools
          </h2>
          <p style={{ fontSize: "0.72rem", color: "rgba(226,232,240,0.35)", margin: 0 }}>
            Remote interaction tools untuk PC target · gunakan dengan bijak
          </p>
        </div>

        {/* Toast */}
        {msg && (
          <div style={{
            padding: "10px 16px", borderRadius: 10,
            background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: msg.ok ? "#22c55e" : "#ef4444",
            fontSize: "0.82rem", fontWeight: 600,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            animation: "prank-up 0.2s ease both",
          }}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
          </div>
        )}

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>

          {/* ── TTS with Voice Picker ─── */}
          <div style={{
            gridColumn: "1 / -1",  // Full width
            background: "rgba(6,10,22,0.6)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: "18px 18px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35rem",
              }}>🔊</div>
              <div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#e2e8f0" }}>Text to Speech</div>
                <div style={{ fontSize: "0.71rem", color: "rgba(226,232,240,0.4)", marginTop: 1 }}>
                  JARVIS speaks text aloud · multi-language voice support
                </div>
              </div>
            </div>

            {/* Message input */}
            <InputField value={ttsText} onChange={setTtsText} placeholder="Teks yang akan diucapkan…" multiline />

            {/* Quick messages with lang toggle */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
                  Pesan Cepat
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["id", "en"] as const).map(l => (
                    <button key={l} onClick={() => setQuickLang(l)} style={{
                      background: quickLang === l ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${quickLang === l ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                      color: quickLang === l ? "#00d4ff" : "rgba(226,232,240,0.4)",
                      borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem",
                      cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                    }}>
                      {l === "id" ? "🇮🇩 ID" : "🇺🇸 EN"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {quickMessages.map(t => (
                  <button key={t} onClick={() => setTtsText(t)} style={{
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6, padding: "6px 10px", color: "rgba(226,232,240,0.55)",
                    fontSize: "0.76rem", cursor: "pointer", textAlign: "left",
                    fontFamily: "inherit", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(226,232,240,0.55)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                  >
                    "{t}"
                  </button>
                ))}
              </div>
            </div>

            {/* Voice selector */}
            <div>
              <div style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
                Pilih Suara
              </div>
              <VoiceSelector selected={voiceId} onSelect={setVoiceId} />
            </div>

            {/* Speak button */}
            <RunBtn
              id="speak" label="🔊 Ucapkan Sekarang" loading={loading}
              onClick={() => run("speak", "speak", buildVoiceParams(), "Text to Speech")}
            />
          </div>

          {/* Blackscreen */}
          <PrankCard icon="⬛" title="Black Screen" subtitle="Temporary screen blackout on target PC">
            <RangeInput min={1} max={60} value={blackDur} onChange={setBlackDur} label="Duration" />
            <RunBtn id="blackscreen" label="⬛ Activate Blackscreen" loading={loading}
              onClick={() => run("blackscreen", "blackscreen", { duration: blackDur }, "Black Screen")} />
          </PrankCard>

          {/* Jumpscare */}
          <PrankCard icon="😱" title="Jumpscare" subtitle="Fullscreen red scare with alarm sound" danger>
            <InputField value={jumpMsg} onChange={setJumpMsg} placeholder="Scare message…" />
            <RunBtn id="jumpscare" label="😱 Send Jumpscare" loading={loading} danger
              onClick={() => run("jumpscare", "jumpscare", { message: jumpMsg }, "Jumpscare")} />
          </PrankCard>

          {/* Fake BSOD */}
          <PrankCard icon="💀" title="Fake BSOD" subtitle="Simulate Windows Blue Screen of Death" danger>
            <RangeInput min={2} max={60} value={bsodDur} onChange={setBsodDur} label="Duration" accent="#ef4444" />
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: "8px 12px", fontSize: "0.72rem", color: "rgba(239,68,68,0.7)" }}>
              ⚠️ Layar PC target akan terblokir selama {bsodDur} detik.
            </div>
            <RunBtn id="bsod" label="💀 Show Fake BSOD" loading={loading} danger
              onClick={() => {
                if (window.confirm(`Tampilkan Fake BSOD selama ${bsodDur} detik?`))
                  run("bsod", "bsod", { duration: bsodDur }, "Fake BSOD");
              }} />
          </PrankCard>

          {/* Custom Popup */}
          <PrankCard icon="💬" title="Custom Popup" subtitle="Show a Windows message dialog box">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <InputField value={popTitle} onChange={setPopTitle} placeholder="Popup title…" />
              <InputField value={popMsg}   onChange={setPopMsg}   placeholder="Message…" multiline />
            </div>
            <RunBtn id="popup" label="💬 Show Popup" loading={loading}
              onClick={() => run("popup", "popup", { title: popTitle, message: popMsg }, "Custom Popup")} />
          </PrankCard>

          {/* Sound Effects */}
          <PrankCard icon="🔔" title="Sound Effects" subtitle="Play system alert sounds on target PC">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {SOUND_EFFECTS.map(s => (
                <button key={s.type} disabled={!!loading}
                  onClick={() => run(s.type, "play_sound", { type: s.type }, s.label)}
                  style={{
                    background: s.danger ? "rgba(239,68,68,0.1)" : "rgba(0,212,255,0.08)",
                    border: `1px solid ${s.danger ? "rgba(239,68,68,0.25)" : "rgba(0,212,255,0.2)"}`,
                    color: s.danger ? "#ef4444" : "#00d4ff",
                    borderRadius: 8, padding: "10px",
                    fontSize: "0.82rem", fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading && loading !== s.type ? 0.5 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  {loading === s.type
                    ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${s.danger ? "#ef4444" : "#00d4ff"}`, borderTopColor: "transparent", display: "inline-block", animation: "prank-spin 0.7s linear infinite" }} />
                    : s.label}
                </button>
              ))}
            </div>
          </PrankCard>

          {/* Desktop Notification */}
          <PrankCard icon="📢" title="Desktop Notification" subtitle="Send a toast notification to target PC">
            <InputField value={marquee} onChange={setMarquee} placeholder="Notification message…" />
            <RunBtn id="marquee" label="📢 Send Notification" loading={loading}
              onClick={() => run("marquee", "popup", { title: "JARVIS Notification", message: marquee }, "Desktop Notification")} />
          </PrankCard>

          {/* Quick Combo */}
          <PrankCard icon="⚡" title="Quick Pranks" subtitle="One-click instant prank actions">
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                { id: "combo-bsod5",     label: "💀 Quick BSOD (5s)",             action: "bsod",        params: { duration: 5 },                                 danger: true  },
                { id: "combo-black10",   label: "⬛ Quick Blackout (10s)",         action: "blackscreen", params: { duration: 10 },                                 danger: false },
                { id: "combo-scare",     label: "😱 Default Jumpscare",            action: "jumpscare",   params: { message: "BOO! 😱" },                          danger: true  },
                { id: "combo-scream",    label: "🚨 Loud Alarm",                   action: "play_sound",  params: { type: "critical" },                             danger: true  },
                { id: "combo-tts-id",    label: "👁 Pengawasan (Bahasa Indonesia)", action: "speak",       params: { text: "Halo! JARVIS sedang mengawasi kamu.", lang: "id-ID", rate: 185, volume: 1.0, gender: "female" }, danger: false },
                { id: "combo-tts-en",    label: "👁 I See You (English)",          action: "speak",       params: { text: "I can see you. Be careful.", lang: "en-US", rate: 185, volume: 1.0, gender: "male" }, danger: false },
                { id: "combo-warning",   label: "⚠️ System Warning Popup",         action: "popup",       params: { title: "⚠️ System Alert", message: "Your PC has been accessed remotely by JARVIS." }, danger: true  },
              ].map(item => (
                <button key={item.id} disabled={!!loading}
                  onClick={() => { if (item.danger && !window.confirm(`Jalankan: ${item.label}?`)) return; run(item.id, item.action, item.params, item.label); }}
                  style={{
                    background: item.danger ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${item.danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)"}`,
                    color: item.danger ? "#ef4444" : "rgba(226,232,240,0.7)",
                    borderRadius: 8, padding: "9px 14px",
                    fontSize: "0.82rem", fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading && loading !== item.id ? 0.5 : 1,
                    display: "flex", alignItems: "center", gap: 8,
                    textAlign: "left", fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  {loading === item.id
                    ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "prank-spin 0.7s linear infinite" }} />
                    : null}
                  {item.label}
                </button>
              ))}
            </div>
          </PrankCard>

        </div>
      </div>
    </>
  );
}