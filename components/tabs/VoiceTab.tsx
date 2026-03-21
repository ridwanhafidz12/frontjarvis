"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { getApiBase, getToken } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  audio?: string; // base64 mp3
  time: Date;
  action?: string | null;
  params?: Record<string, unknown>;
}

declare global {
  interface Window {
    SpeechRecognition: unknown;
    webkitSpeechRecognition: unknown;
  }
}

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Waveform Visualizer ────────────────────────────────────────────────────
function WaveformRing({ active, size = 120 }: { active: boolean; size?: number }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {/* Outer ring */}
      {active && (
        <>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute",
              inset: -(i * 14),
              borderRadius: "50%",
              border: `${1.5 - i * 0.3}px solid rgba(0,212,255,${0.25 - i * 0.07})`,
              animation: `voice-ping 1.8s ease ${i * 0.3}s infinite`,
            }} />
          ))}
        </>
      )}
      {/* Core circle */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: active
          ? "radial-gradient(circle, rgba(0,212,255,0.25) 0%, rgba(124,58,237,0.15) 60%, transparent 100%)"
          : "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
        border: `2px solid ${active ? "rgba(0,212,255,0.6)" : "rgba(255,255,255,0.1)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.4s ease",
        boxShadow: active ? "0 0 40px rgba(0,212,255,0.3), inset 0 0 30px rgba(0,212,255,0.1)" : "none",
      }}>
        <span style={{ fontSize: size * 0.4, filter: active ? "drop-shadow(0 0 10px #00d4ff)" : "none" }}>
          {active ? "🎙️" : "🤖"}
        </span>
      </div>
    </div>
  );
}

// ── Audio Player ───────────────────────────────────────────────────────────
function AudioPlayer({ src, autoPlay }: { src: string; autoPlay?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (autoPlay && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [src, autoPlay]);
  return (
    <audio
      ref={audioRef}
      src={`data:audio/mp3;base64,${src}`}
      controls
      style={{
        width: "100%", height: 28, marginTop: 4,
        filter: "invert(1) hue-rotate(180deg)",
        opacity: 0.8,
      }}
    />
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────
function VoiceBubble({ msg, autoPlayAudio }: { msg: VoiceMessage; autoPlayAudio: boolean }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      animation: "voice-up 0.3s ease both",
      gap: 4,
    }}>
      {msg.action && (
        <div style={{
          fontSize: "0.65rem", padding: "2px 8px", borderRadius: 20,
          background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
          color: "rgba(167,139,250,0.8)", fontWeight: 600, letterSpacing: "0.05em",
          alignSelf: isUser ? "flex-end" : "flex-start",
        }}>
          ⚡ {msg.action}
        </div>
      )}
      <div style={{
        maxWidth: "78%",
        background: isUser
          ? "linear-gradient(135deg,rgba(0,212,255,0.15),rgba(124,58,237,0.15))"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${isUser ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "10px 14px",
      }}>
        <div style={{
          fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em",
          color: isUser ? "rgba(0,212,255,0.7)" : "rgba(167,139,250,0.6)",
          marginBottom: 5, textTransform: "uppercase",
        }}>
          {isUser ? "You" : "JARVIS"}
          <span style={{ color: "rgba(226,232,240,0.2)", marginLeft: 8, fontWeight: 400, fontSize: "0.6rem" }}>
            {msg.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "#e2e8f0", lineHeight: 1.6 }}>
          {msg.text}
        </p>
        {msg.audio && (
          <AudioPlayer src={msg.audio} autoPlay={!isUser && autoPlayAudio} />
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function VoiceTab() {
  const [messages,    setMessages]    = useState<VoiceMessage[]>([]);
  const [listening,   setListening]   = useState(false);
  const [processing,  setProcessing]  = useState(false);
  const [autoPlay,    setAutoPlay]    = useState(true);
  const [ttsEnabled,  setTtsEnabled]  = useState(true);
  const [srSupported, setSrSupported] = useState(false);
  const [status,      setStatus]      = useState("Menunggu perintah…");
  const [geminiKey,   setGeminiKey]   = useState("");
  const [showConfig,  setShowConfig]  = useState(false);
  const [transcript,  setTranscript]  = useState("");
  const [history,     setHistory]     = useState<Array<{role: string; content: string}>>([]);

  const endRef    = useRef<HTMLDivElement>(null);
  const recRef    = useRef<unknown>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSrSupported(!!SR);
    try {
      const k = sessionStorage.getItem("jv_gk") || "";
      setGeminiKey(k);
    } catch {}
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send voice/text to backend ────────────────────────────────────────
  const sendToJarvis = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setProcessing(true);
    setStatus("JARVIS sedang berpikir…");

    const userMsg: VoiceMessage = {
      id: uid(), role: "user", text, time: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    const newHistory = [...history, { role: "user", content: text }];

    try {
      const base  = getApiBase();
      const token = getToken();

      // Prefer gemini key from config, else from sessionStorage
      const useKey = geminiKey || "";
      let resp: Response;

      if (useKey) {
        // Direct Gemini call with function calling via AI chat endpoint
        resp = await fetch(`${base}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            message: text,
            history: newHistory.slice(-10),
            user_id: 0,
            tts: ttsEnabled,
          }),
        });
      } else {
        // Via voice chat endpoint
        resp = await fetch(`${base}/api/voice/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text, tts: ttsEnabled }),
        });
      }

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as {
        response?: string; text?: string;
        audio?: string; audio_mime?: string;
        action?: string | null; params?: Record<string, unknown>;
      };

      const respText = data.response || data.text || "…";
      const assistantMsg: VoiceMessage = {
        id: uid(), role: "assistant",
        text: respText,
        audio: data.audio,
        time: new Date(),
        action: data.action,
        params: data.params,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setHistory([...newHistory, { role: "assistant", content: respText }]);
      setStatus("Selesai. Tekan mikrofon atau ketik.");

      // Execute action if any
      if (data.action) {
        await executeAction(data.action, data.params || {});
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      const errMsg: VoiceMessage = {
        id: uid(), role: "assistant",
        text: `❌ Gagal: ${err}`,
        time: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
      setStatus("❌ Error. Coba lagi.");
    } finally {
      setProcessing(false);
    }
  }, [geminiKey, history, ttsEnabled]);

  // ── Execute JARVIS action ────────────────────────────────────────────
  const executeAction = async (action: string, params: Record<string, unknown>) => {
    try {
      const base  = getApiBase();
      const token = getToken();
      await fetch(`${base}/api/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, params }),
      });
    } catch {}
  };

  // ── Start listening via Web Speech API ───────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.lang = "id-ID";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart  = () => { setListening(true); setStatus("Mendengarkan… Bicara!"); };
    rec.onend    = () => { setListening(false); };
    rec.onerror  = () => { setListening(false); setStatus("Menunggu perintah…"); };
    rec.onresult = (e: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ev = e as any;
      const t: string = ev.results[0][0].transcript;
      setTranscript(t);
      if (ev.results[0].isFinal && t) {
        setTranscript("");
        sendToJarvis(t);
      }
    };
    recRef.current = rec;
    rec.start();
  }, [sendToJarvis]);

  const stopListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recRef.current as any)?.stop?.();
    setListening(false);
  };

  const handleVoiceBtn = () => {
    if (listening) stopListening();
    else startListening();
  };

  // ── Text input send ──────────────────────────────────────────────────
  const [textInput, setTextInput] = useState("");
  const handleSendText = () => {
    const t = textInput.trim();
    if (!t || processing) return;
    setTextInput("");
    sendToJarvis(t);
  };

  const saveKey = () => {
    try { sessionStorage.setItem("jv_gk", geminiKey); } catch {}
    setShowConfig(false);
  };

  // ── Quick commands ────────────────────────────────────────────────────
  const QUICK = [
    { label: "📊 Status", text: "Cek status PC sekarang" },
    { label: "📸 Screenshot", text: "Ambil screenshot layar" },
    { label: "🔊 Volume 70", text: "Set volume ke 70" },
    { label: "🔒 Kunci PC", text: "Kunci PC sekarang" },
    { label: "🌐 Buka Chrome", text: "Buka Chrome" },
    { label: "📋 Clipboard", text: "Baca isi clipboard" },
    { label: "📷 Webcam", text: "Foto dari webcam" },
    { label: "💻 Proses", text: "Tampilkan proses yang berjalan" },
  ];

  return (
    <>
      <style>{`
        @keyframes voice-ping   { 0%{transform:scale(1);opacity:0.8;} 70%,100%{transform:scale(1.6);opacity:0;} }
        @keyframes voice-up     { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;} }
        @keyframes voice-glow   { 0%,100%{box-shadow:0 0 20px rgba(0,212,255,0.3);} 50%{box-shadow:0 0 40px rgba(0,212,255,0.6);} }
        @keyframes voice-pulse  { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
        @keyframes voice-spin   { to{transform:rotate(360deg);} }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "calc(100vh - 140px)", minHeight: 520 }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 2px" }}>
              🎙️ Voice-to-Voice AI
            </h2>
            <p style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.35)", margin: 0 }}>
              Bicara langsung ke JARVIS · Respons suara & aksi otomatis
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {/* TTS toggle */}
            <button onClick={() => setTtsEnabled(v => !v)} style={{
              background: ttsEnabled ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${ttsEnabled ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: ttsEnabled ? "#00d4ff" : "rgba(226,232,240,0.4)",
              borderRadius: 7, padding: "4px 10px", fontSize: "0.7rem", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {ttsEnabled ? "🔊 TTS On" : "🔇 TTS Off"}
            </button>
            {/* Auto-play toggle */}
            <button onClick={() => setAutoPlay(v => !v)} style={{
              background: autoPlay ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${autoPlay ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
              color: autoPlay ? "#22c55e" : "rgba(226,232,240,0.4)",
              borderRadius: 7, padding: "4px 10px", fontSize: "0.7rem", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {autoPlay ? "▶ Auto Play" : "⏸ Manual"}
            </button>
            {/* Config */}
            <button onClick={() => setShowConfig(v => !v)} style={{
              background: showConfig ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${showConfig ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.08)"}`,
              color: "rgba(226,232,240,0.5)", borderRadius: 7, padding: "4px 9px",
              fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
            }}>⚙️</button>
            {/* Clear */}
            <button onClick={() => { setMessages([]); setHistory([]); }} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(226,232,240,0.4)", borderRadius: 7, padding: "4px 9px",
              fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
            }}>🧹</button>
          </div>
        </div>

        {/* Config panel */}
        {showConfig && (
          <div style={{
            background: "rgba(6,10,22,0.95)", border: "1px solid rgba(0,212,255,0.15)",
            borderRadius: 12, padding: 14, animation: "voice-up 0.2s ease both",
          }}>
            <p style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.4)", marginBottom: 8 }}>
              Kosongkan untuk menggunakan key dari JARVIS backend (config.json).
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.4)", width: 130, flexShrink: 0 }}>
                Gemini API Key
              </span>
              <input
                type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIzaSy... (kosongkan = pakai backend)"
                style={{
                  flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: "0.78rem",
                  fontFamily: "monospace", outline: "none",
                }}
              />
            </div>
            <button onClick={saveKey} style={{
              marginTop: 8, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff", borderRadius: 7, padding: "5px 14px", fontSize: "0.75rem",
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>💾 Simpan</button>
          </div>
        )}

        {/* Quick commands */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {QUICK.map(q => (
            <button key={q.text} onClick={() => sendToJarvis(q.text)} disabled={processing} style={{
              background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.13)",
              color: "rgba(0,212,255,0.75)", borderRadius: 20, padding: "3px 10px",
              fontSize: "0.68rem", fontWeight: 600, cursor: processing ? "not-allowed" : "pointer",
              opacity: processing ? 0.5 : 1, whiteSpace: "nowrap", fontFamily: "inherit",
            }}>{q.label}</button>
          ))}
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: "flex", gap: 14, minHeight: 0 }}>

          {/* Left: Visualizer */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 20, padding: "20px 14px",
            background: "rgba(4,8,18,0.7)", borderRadius: 16,
            border: "1px solid rgba(0,212,255,0.08)",
            minWidth: 180, flexShrink: 0,
          }}>
            <WaveformRing active={listening} size={110} />

            {/* Status */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "0.72rem", fontWeight: 600,
                color: listening ? "#00d4ff" : processing ? "#a78bfa" : "rgba(226,232,240,0.5)",
                animation: (listening || processing) ? "voice-pulse 1.5s ease infinite" : "none",
              }}>
                {listening ? "● Mendengarkan" : processing ? "⋯ Memproses" : "○ Standby"}
              </div>
              {transcript && (
                <div style={{
                  fontSize: "0.7rem", color: "rgba(0,212,255,0.7)", marginTop: 4,
                  fontStyle: "italic", maxWidth: 140, textAlign: "center",
                }}>
                  "{transcript}"
                </div>
              )}
            </div>

            {/* Mic button */}
            {srSupported && (
              <button
                onClick={handleVoiceBtn}
                disabled={processing}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  border: `2px solid ${listening ? "rgba(239,68,68,0.6)" : "rgba(0,212,255,0.4)"}`,
                  background: listening
                    ? "rgba(239,68,68,0.15)"
                    : "linear-gradient(135deg,rgba(0,212,255,0.12),rgba(124,58,237,0.12))",
                  color: listening ? "#ef4444" : "#00d4ff",
                  fontSize: "1.6rem", cursor: processing ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: listening ? "voice-glow 2s ease infinite" : "none",
                  transition: "all 0.3s", opacity: processing ? 0.5 : 1,
                  boxShadow: listening ? "0 0 32px rgba(239,68,68,0.4)" : "0 0 20px rgba(0,212,255,0.15)",
                }}
              >
                {listening ? "⏹" : "🎤"}
              </button>
            )}

            {!srSupported && (
              <div style={{
                fontSize: "0.65rem", color: "rgba(239,68,68,0.7)", textAlign: "center",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8, padding: "6px 10px",
              }}>
                Browser tidak mendukung<br />Web Speech API.<br />Gunakan input teks.
              </div>
            )}

            <div style={{ fontSize: "0.62rem", color: "rgba(226,232,240,0.2)", textAlign: "center" }}>
              {srSupported ? "Klik 🎤 untuk mulai\natau ketik di bawah" : "Gunakan input teks di bawah"}
            </div>
          </div>

          {/* Right: Chat */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
          }}>
            {/* Messages */}
            <div style={{
              flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12,
              background: "rgba(4,8,18,0.7)", borderRadius: 14, padding: 14,
              border: "1px solid rgba(0,212,255,0.07)",
              boxShadow: "inset 0 0 24px rgba(0,0,0,0.3)",
            }}>
              {messages.length === 0 && (
                <div style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 12,
                  color: "rgba(226,232,240,0.25)", textAlign: "center", padding: 20,
                }}>
                  <span style={{ fontSize: "2.5rem", opacity: 0.4 }}>🎙️</span>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 4 }}>
                      JARVIS Voice-to-Voice
                    </div>
                    <div style={{ fontSize: "0.72rem" }}>
                      Klik tombol mikrofon atau ketik untuk memulai percakapan.
                      <br />JARVIS akan merespons dengan teks dan suara.
                    </div>
                  </div>
                </div>
              )}
              {messages.map(msg => (
                <VoiceBubble key={msg.id} msg={msg} autoPlayAudio={autoPlay} />
              ))}
              {processing && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.7 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg,rgba(0,212,255,0.3),rgba(124,58,237,0.3))",
                    border: "1px solid rgba(0,212,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>🤖</div>
                  <div style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "16px 16px 16px 4px", padding: "10px 16px",
                    display: "flex", gap: 5,
                  }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: "rgba(0,212,255,0.7)",
                        display: "inline-block",
                        animation: `voice-pulse 1.2s ease ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Status bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: "0.68rem", color: "rgba(226,232,240,0.3)",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: listening ? "#ef4444" : processing ? "#a78bfa" : "rgba(16,185,129,0.6)",
                animation: (listening || processing) ? "voice-pulse 1.5s ease infinite" : "none",
              }}/>
              {status}
            </div>

            {/* Text input */}
            <div style={{
              display: "flex", gap: 8, alignItems: "flex-end",
              background: "rgba(4,8,18,0.9)",
              border: `1px solid rgba(0,212,255,${textInput.trim() ? "0.38" : "0.16"})`,
              borderRadius: 14, padding: "8px 12px",
              transition: "border-color 0.2s",
            }}>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }
                }}
                placeholder="Ketik perintah… atau klik 🎤 untuk bicara"
                rows={1}
                disabled={processing}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "#e2e8f0", fontSize: "0.88rem", resize: "none",
                  maxHeight: 100, lineHeight: 1.5, padding: "4px 0",
                  fontFamily: "inherit", caretColor: "#00d4ff",
                  opacity: processing ? 0.5 : 1,
                }}
              />
              {srSupported && (
                <button
                  onClick={handleVoiceBtn}
                  disabled={processing}
                  style={{
                    width: 36, height: 36, flexShrink: 0, borderRadius: "50%",
                    border: `1px solid ${listening ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                    background: listening ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                    color: listening ? "#ef4444" : "rgba(226,232,240,0.4)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1rem", transition: "all 0.2s",
                    animation: listening ? "voice-pulse 1.5s ease infinite" : "none",
                  }}
                >
                  {listening ? "⏹" : "🎤"}
                </button>
              )}
              <button
                onClick={handleSendText}
                disabled={processing || !textInput.trim()}
                style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: "50%",
                  border: `1px solid ${processing || !textInput.trim() ? "rgba(255,255,255,0.08)" : "rgba(0,212,255,0.38)"}`,
                  background: processing || !textInput.trim() ? "rgba(255,255,255,0.04)" : "rgba(0,212,255,0.14)",
                  color: processing || !textInput.trim() ? "rgba(226,232,240,0.2)" : "#00d4ff",
                  cursor: processing || !textInput.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.95rem", transition: "all 0.2s",
                }}
              >
                {processing
                  ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00d4ff", animation: "voice-spin 0.7s linear infinite" }} />
                  : "➤"}
              </button>
            </div>
            <p style={{ fontSize: "0.62rem", color: "rgba(226,232,240,0.18)", textAlign: "center", margin: 0 }}>
              Enter kirim · Shift+Enter baris baru · 🎤 bicara · TTS = respons suara otomatis
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
