"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiBase, getToken, ping, chatAI, control, getStatus } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type MsgRole = "user" | "jarvis" | "system";
interface ChatMsg {
  id:         string;
  role:       MsgRole;
  text:       string;
  time:       string;
  action?:    string | null;
  image?:     string | null;
  agent?:     string | null;       // e.g. "groq/llama-3.3-70b-versatile"
  toolsUsed?: string[];            // tools called for this response
}

type Status = { cpu?: number; ram?: number; battery?: number; plugged?: boolean; disk?: number };

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid   = () => Math.random().toString(36).slice(2);
const hhmm  = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// ── Web Speech API wrappers ───────────────────────────────────────────────────
function speakText(text: string, lang = "id-ID") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = lang;
  utt.rate   = 1.05;
  utt.pitch  = 0.9;

  // Pick a male-sounding voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith("id") && v.name.toLowerCase().includes("male")
  ) || voices.find(v => v.lang.startsWith("id"))
    || voices.find(v => v.lang.startsWith("en"));
  if (preferred) utt.voice = preferred;

  window.speechSynthesis.speak(utt);
}

// ── Main HUD Component ────────────────────────────────────────────────────────
export default function HudPage() {
  const router  = useRouter();

  // session
  const [authed,   setAuthed]  = useState(false);
  const [checking, setChecking] = useState(true);

  // chat
  const [messages,  setMessages]  = useState<ChatMsg[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading,   setLoading]   = useState(false);

  // voice
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recogRef  = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef<number>(0);
  const mediaRef    = useRef<MediaStream | null>(null);

  // system status
  const [status, setStatus] = useState<Status>({});
  const [online, setOnline] = useState(true);

  // scroll
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      const base  = getApiBase();
      const token = getToken();
      if (!base || !token) { router.replace("/"); return; }
      try { await ping(); setAuthed(true); } catch { router.replace("/"); }
      finally { setChecking(false); }
    };
    check();
  }, [router]);

  // ── Status polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    const fetchStatus = async () => {
      try {
        const s = await getStatus();
        setStatus({
          cpu:     s.cpu_percent,
          ram:     s.ram_percent,
          battery: s.battery_percent ?? undefined,
          plugged: s.battery_plugged,
          disk:    s.disk_percent,
        });
        setOnline(true);
      } catch { setOnline(false); }
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 10000);
    return () => clearInterval(id);
  }, [authed]);

  // ── Initial greeting ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    const greeting: ChatMsg = {
      id:   uid(),
      role: "jarvis",
      text: "Sistem JARVIS online. Semua modul aktif. Selamat datang kembali. Silakan berikan perintah Anda.",
      time: hhmm(),
    };
    setMessages([greeting]);
    if (voiceEnabled) {
      setTimeout(() => speakText(greeting.text), 500);
    }
  }, [authed]); // eslint-disable-line

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message to AI ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMsg = { id: uid(), role: "user", text: trimmed, time: hhmm() };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await chatAI(trimmed, 1, false);
      const reply: ChatMsg = {
        id:         uid(),
        role:       "jarvis",
        text:       res.response || "Perintah diterima.",
        time:       hhmm(),
        action:     res.action || null,
        agent:      res.agent   || null,
        toolsUsed:  res.tools_used || [],
      };

      // If AI returned a PC action, execute it automatically
      if (res.action) {
        try {
          const ctrl = await control(res.action, res.params || {});
          if (res.action === "screenshot" && ctrl.image) {
            reply.image = ctrl.image;
          }
          reply.text += `\n\n✅ Tindakan **${res.action}** berhasil dijalankan.`;
        } catch (err: any) {
          reply.text += `\n\n⚠️ Gagal jalankan tindakan: ${err.message}`;
        }
      }

      setMessages(prev => [...prev, reply]);
      if (voiceEnabled && reply.text) {
        // Speak only first 200 chars to keep TTS snappy
        speakText(reply.text.replace(/\*\*/g, "").slice(0, 200));
      }
    } catch (err: any) {
      const errMsg: ChatMsg = {
        id:   uid(),
        role: "system",
        text: `❌ Error: ${err.message}`,
        time: hhmm(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, voiceEnabled]);

  // ── Voice input ─────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser ini tidak mendukung Speech Recognition. Gunakan Chrome atau Edge.");
      return;
    }

    // Start audio visualizer
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      const ctx      = new AudioContext();
      const src      = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioCtxRef.current  = ctx;
      analyserRef.current  = analyser;
      drawVisualizer();
    } catch {}

    const recog = new SpeechRecognition();
    recog.lang        = "id-ID";
    recog.continuous  = false;
    recog.interimResults = true;
    recogRef.current  = recog;

    recog.onstart  = () => setListening(true);
    recog.onend    = () => {
      setListening(false);
      stopVisualizer();
    };
    recog.onresult = (e: any) => {
      const t = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(" ");
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        sendMessage(t);
        setTranscript("");
      }
    };
    recog.onerror  = () => { setListening(false); stopVisualizer(); };
    recog.start();
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
    stopVisualizer();
  }, []);

  // ── Audio visualizer ────────────────────────────────────────────────────────
  const drawVisualizer = useCallback(() => {
    const canvas   = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx  = canvas.getContext("2d")!;
    const W    = canvas.width;
    const H    = canvas.height;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const loop = () => {
      animRef.current = requestAnimationFrame(loop);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, W, H);

      const bars  = 32;
      const bw    = W / bars;
      for (let i = 0; i < bars; i++) {
        const val = data[Math.floor(i * data.length / bars)] / 255;
        const bh  = val * H;
        const hue = 185 + val * 60; // cyan → teal
        ctx.fillStyle = `hsla(${hue},100%,60%,${0.4 + val * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(i * bw + 2, H - bh, bw - 4, bh, 3);
        ctx.fill();
      }
    };
    loop();
  }, []);

  const stopVisualizer = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    mediaRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // ── Quick action buttons ────────────────────────────────────────────────────
  const quickActions = [
    { label: "📸 Screenshot",   cmd: "screenshot",          action: "screenshot",       params: {} },
    { label: "🔒 Kunci PC",      cmd: "Kunci PC sekarang",   action: null,               params: {} },
    { label: "📊 Status",        cmd: "Status sistem",       action: null,               params: {} },
    { label: "🔊 Vol 50%",       cmd: "Set volume 50",       action: "set_volume",       params: { level: 50 } },
    { label: "🔕 Mute",          cmd: "Matikan suara",       action: "set_volume",       params: { level: 0 } },
    { label: "🌐 Cuaca",         cmd: "Bagaimana cuaca hari ini?", action: null,         params: {} },
  ];

  // ── Loading / auth check state ──────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#020812",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 16px",
            borderRadius: "50%", border: "2px solid rgba(0,212,255,0.15)",
            borderTopColor: "#00d4ff", animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: "rgba(0,212,255,0.4)", fontSize: "0.75rem", letterSpacing: "0.2em" }}>
            INITIALIZING…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── HUD UI ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#020812",
      display: "flex", flexDirection: "column",
      fontFamily: "'Outfit', 'Inter', monospace",
      color: "#e2e8f0", overflow: "hidden",
      position: "relative",
    }}>

      {/* ── Animated background grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* ── Glow blobs */}
      <div style={{
        position: "fixed", top: "-10%", left: "-5%", width: "50vw", height: "50vh",
        background: "radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "-10%", right: "-5%", width: "45vw", height: "45vh",
        background: "radial-gradient(ellipse, rgba(99,0,255,0.07) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px",
        background: "rgba(2,8,18,0.92)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,212,255,0.12)",
        boxShadow: "0 0 40px rgba(0,212,255,0.04)",
      }}>
        {/* Left — Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(99,0,255,0.2))",
            border: "1px solid rgba(0,212,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 0 16px rgba(0,212,255,0.2)",
          }}>🤖</div>
          <div>
            <div style={{
              fontSize: "1.1rem", fontWeight: 900, letterSpacing: "0.2em",
              background: "linear-gradient(90deg, #00d4ff, #7c3aed)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>J.A.R.V.I.S</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(0,212,255,0.4)", letterSpacing: "0.25em" }}>
              AI VOICE HUD v3.0
            </div>
          </div>
        </div>

        {/* Center — Status Metrics */}
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          {[
            { label: "CPU",  val: status.cpu,     color: status.cpu  != null && status.cpu  > 85 ? "#ef4444" : "#00d4ff" },
            { label: "RAM",  val: status.ram,     color: status.ram  != null && status.ram  > 85 ? "#ef4444" : "#7c3aed" },
            { label: "DISK", val: status.disk,    color: status.disk != null && status.disk > 90 ? "#ef4444" : "#10b981" },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "0.6rem", color: "rgba(226,232,240,0.3)",
                letterSpacing: "0.15em", marginBottom: 2,
              }}>{m.label}</div>
              <Arc pct={m.val ?? 0} color={m.color} size={38} />
            </div>
          ))}

          {status.battery != null && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "0.6rem", color: "rgba(226,232,240,0.3)", letterSpacing: "0.15em", marginBottom: 2 }}>
                BAT
              </div>
              <div style={{
                fontSize: "0.75rem", fontWeight: 700,
                color: status.battery < 20 ? "#ef4444" : "#10b981",
              }}>
                {Math.round(status.battery)}%
                {status.plugged ? " ⚡" : ""}
              </div>
            </div>
          )}
        </div>

        {/* Right — Online + controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: "0.68rem", color: online ? "#10b981" : "#ef4444",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: online ? "#10b981" : "#ef4444",
              boxShadow: online ? "0 0 8px #10b981" : "0 0 8px #ef4444",
              animation: "pulse 2s infinite",
            }} />
            {online ? "ONLINE" : "OFFLINE"}
          </div>

          <button
            id="hud-voice-toggle"
            onClick={() => setVoiceEnabled(v => !v)}
            title={voiceEnabled ? "Matikan suara AI" : "Aktifkan suara AI"}
            style={{
              background: "none", border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: 8, padding: "4px 10px", cursor: "pointer",
              color: voiceEnabled ? "#00d4ff" : "rgba(226,232,240,0.3)",
              fontSize: "0.7rem", letterSpacing: "0.1em",
              transition: "all 0.2s",
            }}
          >
            {voiceEnabled ? "🔊 TTS ON" : "🔇 TTS OFF"}
          </button>

          <button
            onClick={() => router.push("/vision")}
            style={{
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 8, padding: "5px 12px", cursor: "pointer",
              color: "#10b981", fontSize: "0.68rem",
              letterSpacing: "0.1em", transition: "all 0.2s",
            }}
          >
            👁 VISION
          </button>

          <button
            onClick={() => router.push("/hive")}
            style={{
              background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 8, padding: "5px 12px", cursor: "pointer",
              color: "#a78bfa", fontSize: "0.68rem",
              letterSpacing: "0.1em", transition: "all 0.2s",
            }}
          >
            🌐 HIVE
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            style={{
              background: "none", border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: 8, padding: "5px 12px", cursor: "pointer",
              color: "rgba(226,232,240,0.4)", fontSize: "0.68rem",
              letterSpacing: "0.1em", transition: "all 0.2s",
            }}
          >
            ← DASHBOARD
          </button>
        </div>
      </header>



      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", overflow: "hidden",
        position: "relative", zIndex: 1,
      }}>

        {/* ── LEFT: Chat area ────────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          minWidth: 0,
        }}>

          {/* Message list */}
          <div
            id="hud-messages"
            style={{
              flex: 1, overflowY: "auto", padding: "20px 24px",
              display: "flex", flexDirection: "column", gap: 14,
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(0,212,255,0.15) transparent",
            }}
          >
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.7rem", color: "#00d4ff" }}>⬡</span>
                <div style={{
                  display: "flex", gap: 4, padding: "10px 16px",
                  background: "rgba(0,212,255,0.05)",
                  border: "1px solid rgba(0,212,255,0.15)",
                  borderRadius: "0 12px 12px 12px",
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#00d4ff", display: "block",
                      animation: `typing-bounce 1.2s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Live transcript */}
            {transcript && (
              <div style={{
                color: "rgba(0,212,255,0.5)", fontSize: "0.8rem", fontStyle: "italic",
                padding: "6px 14px",
                border: "1px dashed rgba(0,212,255,0.2)", borderRadius: 8,
              }}>
                🎙 {transcript}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* ── Quick actions */}
          <div style={{
            display: "flex", gap: 8, padding: "8px 24px", flexWrap: "wrap",
            borderTop: "1px solid rgba(0,212,255,0.07)",
          }}>
            {quickActions.map((qa, i) => (
              <button
                key={i}
                id={`hud-quick-${i}`}
                onClick={() => sendMessage(qa.cmd)}
                disabled={loading}
                style={{
                  background: "rgba(0,212,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.15)",
                  borderRadius: 8, padding: "5px 12px",
                  color: "rgba(226,232,240,0.6)", fontSize: "0.72rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.1)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#00d4ff";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.4)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.04)";
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(226,232,240,0.6)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,212,255,0.15)";
                }}
              >
                {qa.label}
              </button>
            ))}
          </div>

          {/* ── Input area */}
          <div style={{
            padding: "16px 24px", display: "flex", gap: 10, alignItems: "flex-end",
            background: "rgba(2,8,18,0.96)", borderTop: "1px solid rgba(0,212,255,0.1)",
          }}>
            <textarea
              id="hud-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputText);
                }
              }}
              placeholder="Ketik perintah atau pertanyaan untuk JARVIS… (Enter untuk kirim)"
              rows={2}
              disabled={loading || listening}
              style={{
                flex: 1, background: "rgba(0,212,255,0.04)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: 12, padding: "12px 16px",
                color: "#e2e8f0", fontSize: "0.9rem",
                resize: "none", outline: "none",
                fontFamily: "inherit", lineHeight: 1.5,
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "#00d4ff"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(0,212,255,0.2)"}
            />

            {/* Mic button */}
            <button
              id="hud-mic-btn"
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              disabled={loading}
              title="Tahan untuk bicara"
              style={{
                width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                background: listening
                  ? "rgba(239,68,68,0.2)"
                  : "rgba(0,212,255,0.08)",
                border: `2px solid ${listening ? "#ef4444" : "rgba(0,212,255,0.3)"}`,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
                boxShadow: listening ? "0 0 20px rgba(239,68,68,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >
              {listening ? "⏹" : "🎙"}
            </button>

            {/* Send button */}
            <button
              id="hud-send-btn"
              onClick={() => sendMessage(inputText)}
              disabled={loading || !inputText.trim()}
              style={{
                height: 52, padding: "0 22px", borderRadius: 12, flexShrink: 0,
                background: loading || !inputText.trim()
                  ? "rgba(0,212,255,0.08)"
                  : "linear-gradient(135deg, #00d4ff, #0088ff)",
                border: "none", cursor: loading || !inputText.trim() ? "not-allowed" : "pointer",
                color: loading || !inputText.trim() ? "rgba(0,212,255,0.3)" : "#000",
                fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.08em",
                transition: "all 0.2s",
                boxShadow: loading || !inputText.trim() ? "none" : "0 4px 16px rgba(0,212,255,0.3)",
              }}
            >
              KIRIM ⚡
            </button>
          </div>
        </div>

        {/* ── RIGHT: Visualizer + Audio panel ─────────────────────────────── */}
        <div style={{
          width: 220, flexShrink: 0,
          display: "flex", flexDirection: "column", gap: 16,
          padding: "20px 16px",
          borderLeft: "1px solid rgba(0,212,255,0.08)",
          background: "rgba(2,8,18,0.6)",
        }}>
          {/* Audio waveform title */}
          <div>
            <div style={{
              fontSize: "0.6rem", letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.35)", marginBottom: 10,
            }}>
              AUDIO VISUALIZER
            </div>
            <div style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(0,212,255,0.12)",
              borderRadius: 10, overflow: "hidden",
              height: 72,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <canvas
                ref={canvasRef}
                width={188}
                height={70}
                style={{ display: "block" }}
              />
              {!listening && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(0,212,255,0.2)", fontSize: "0.65rem", letterSpacing: "0.1em",
                }}>
                  STANDBY
                </div>
              )}
            </div>
          </div>

          {/* Mic status */}
          <div style={{
            background: `rgba(${listening ? "239,68,68" : "0,212,255"},0.05)`,
            border: `1px solid rgba(${listening ? "239,68,68" : "0,212,255"},0.15)`,
            borderRadius: 10, padding: "12px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>
              {listening ? "🔴" : "🎙"}
            </div>
            <div style={{
              fontSize: "0.65rem", letterSpacing: "0.15em",
              color: listening ? "#ef4444" : "rgba(0,212,255,0.4)",
              animation: listening ? "pulse 1s infinite" : "none",
            }}>
              {listening ? "MENDENGARKAN…" : "TAHAN MIC UNTUK BICARA"}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(0,212,255,0.07)" }} />

          {/* Stats display */}
          <div>
            <div style={{
              fontSize: "0.6rem", letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.35)", marginBottom: 10,
            }}>
              SISTEM
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "CPU",    val: status.cpu,    unit: "%", color: "#00d4ff" },
                { label: "RAM",    val: status.ram,    unit: "%", color: "#7c3aed" },
                { label: "DISK",   val: status.disk,   unit: "%", color: "#10b981" },
                { label: "BAT",    val: status.battery,unit: "%", color: status.battery != null && status.battery < 20 ? "#ef4444" : "#f59e0b" },
              ].map(s => (
                <div key={s.label}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    marginBottom: 3, fontSize: "0.62rem",
                    color: "rgba(226,232,240,0.35)", letterSpacing: "0.1em",
                  }}>
                    <span>{s.label}</span>
                    <span style={{ color: s.color }}>{s.val != null ? `${Math.round(s.val)}${s.unit}` : "N/A"}</span>
                  </div>
                  <div style={{
                    height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2,
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${s.val ?? 0}%`,
                      background: s.color,
                      boxShadow: `0 0 6px ${s.color}80`,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(0,212,255,0.07)" }} />

          {/* Message count */}
          <div style={{
            textAlign: "center",
            color: "rgba(0,212,255,0.3)", fontSize: "0.62rem",
            letterSpacing: "0.1em",
          }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#00d4ff" }}>
              {messages.length}
            </div>
            INTERAKSI
          </div>

          {/* Clear button */}
          <button
            id="hud-clear-btn"
            onClick={() => setMessages([])}
            style={{
              background: "rgba(239,68,68,0.05)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 8, padding: "7px",
              color: "rgba(239,68,68,0.5)", fontSize: "0.65rem",
              cursor: "pointer", letterSpacing: "0.1em",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.05)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(239,68,68,0.5)";
            }}
          >
            CLEAR CHAT
          </button>
        </div>
      </div>

      {/* ── Global animations */}
      <style>{`
        @keyframes pulse        { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes typing-bounce{ 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes spin         { to{transform:rotate(360deg)} }
        @keyframes slide-in-l   { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:none} }
        @keyframes slide-in-r   { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:none} }
        @keyframes fade-in      { from{opacity:0} to{opacity:1} }

        ::-webkit-scrollbar       { width: 4px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.15); border-radius: 2px }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const isUser   = msg.role === "user";
  const isSystem = msg.role === "system";

  // Map agent string to display label + color
  const agentLabel = (() => {
    if (!msg.agent) return null;
    if (msg.agent.startsWith("groq"))        return { label: "⚡ GROQ",        color: "#f59e0b" };
    if (msg.agent.startsWith("gemini"))      return { label: "🔵 GEMINI",      color: "#00d4ff" };
    if (msg.agent.startsWith("openrouter"))  return { label: "🟣 OPENROUTER",  color: "#a78bfa" };
    if (msg.agent.startsWith("legacy"))      return { label: "🔧 LEGACY",      color: "#6b7280" };
    return { label: msg.agent.toUpperCase().slice(0, 12), color: "#6b7280" };
  })();

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start", gap: 10,
      animation: `${isUser ? "slide-in-r" : "slide-in-l"} 0.2s ease both`,
    }}>
      {/* Avatar */}
      {!isSystem && (
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14,
          background: isUser ? "rgba(124,58,237,0.2)" : "rgba(0,212,255,0.1)",
          border: `1px solid ${isUser ? "rgba(124,58,237,0.3)" : "rgba(0,212,255,0.25)"}`,
        }}>
          {isUser ? "👤" : "⬡"}
        </div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: "78%",
        background: isSystem
          ? "rgba(239,68,68,0.06)"
          : isUser
            ? "rgba(124,58,237,0.1)"
            : "rgba(0,212,255,0.05)",
        border: `1px solid ${isSystem ? "rgba(239,68,68,0.2)" : isUser ? "rgba(124,58,237,0.25)" : "rgba(0,212,255,0.15)"}`,
        borderRadius: isUser ? "12px 0 12px 12px" : "0 12px 12px 12px",
        padding: "10px 14px",
      }}>
        {/* Role label + agent badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          fontSize: "0.58rem", letterSpacing: "0.15em", marginBottom: 5,
        }}>
          <span style={{ color: isSystem ? "#ef4444" : isUser ? "#7c3aed" : "#00d4ff" }}>
            {isSystem ? "SYSTEM" : isUser ? "YOU" : "J.A.R.V.I.S"}
          </span>
          <span style={{ color: "rgba(226,232,240,0.2)", fontWeight: 400 }}>
            {msg.time}
          </span>
          {/* Agent badge */}
          {agentLabel && !isUser && !isSystem && (
            <span style={{
              fontSize: "0.55rem", padding: "1px 6px",
              background: `${agentLabel.color}18`,
              border: `1px solid ${agentLabel.color}40`,
              borderRadius: 4, color: agentLabel.color,
              letterSpacing: "0.1em",
            }}>
              {agentLabel.label}
            </span>
          )}
        </div>

        {/* Tools used badges */}
        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            {msg.toolsUsed.map((t, i) => (
              <span key={i} style={{
                fontSize: "0.58rem", padding: "2px 7px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 4, color: "#10b981",
                letterSpacing: "0.06em",
              }}>
                🔧 {t}
              </span>
            ))}
          </div>
        )}

        {/* Action badge */}
        {msg.action && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 6, padding: "2px 8px", fontSize: "0.62rem",
            color: "#10b981", letterSpacing: "0.1em", marginBottom: 6,
          }}>
            ⚡ {msg.action.toUpperCase()}
          </div>
        )}

        {/* Text */}
        <div style={{
          fontSize: "0.875rem", lineHeight: 1.6,
          color: isSystem ? "#fca5a5" : isUser ? "#c4b5fd" : "#e2e8f0",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg.text.replace(/\*\*(.*?)\*\*/g, "$1")}
        </div>

        {/* Screenshot thumbnail */}
        {msg.image && (
          <img
            src={msg.image}
            alt="screenshot"
            style={{
              marginTop: 10, maxWidth: "100%", borderRadius: 8,
              border: "1px solid rgba(0,212,255,0.2)",
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Arc gauge component ───────────────────────────────────────────────────────

function Arc({ pct, color, size }: { pct: number; color: string; size: number }) {
  const r   = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ * 0.75;  // 270° arc

  return (
    <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={3}
        strokeDasharray={`${circ * 0.75} ${circ}`}
      />
      {/* Value */}
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 0.5s ease", filter: `drop-shadow(0 0 4px ${color}80)` }}
      />
      {/* Center text */}
      <text
        x={size/2} y={size/2 + 4}
        textAnchor="middle"
        style={{ fill: color, fontSize: 9, fontWeight: 700, transform: `rotate(-135deg)`, transformOrigin: `${size/2}px ${size/2}px` }}
      >
        {Math.round(pct)}
      </text>
    </svg>
  );
}
