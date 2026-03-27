"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiBase, getToken } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface VisionResult {
  ok:        boolean;
  analysis?: string;
  answer?:   string;
  error?:    string;
  model?:    string;
  timestamp: number;
}

interface ChatMessage {
  role:      "user" | "jarvis";
  text:      string;
  hasImage?: boolean;
  timestamp: number;
}

// ── Helper: api request ───────────────────────────────────────────────────────
async function apiReq(path: string, body: Record<string, unknown>, timeout = 30000) {
  const base    = getApiBase();
  const token   = getToken();
  const ctrl    = new AbortController();
  const timer   = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${base}${path}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── MiniBar ───────────────────────────────────────────────────────────────────
function PulseDot({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: active ? "#10b981" : "#ef4444",
      boxShadow:  active ? "0 0 8px #10b981" : "none",
      animation:  active ? "pulse-dot 1.5s infinite" : "none",
      marginRight: 6, flexShrink: 0,
    }} />
  );
}

// ── Main Vision Page ──────────────────────────────────────────────────────────
export default function VisionPage() {
  const router = useRouter();

  // Camera
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // State
  const [cameraOn,     setCameraOn]     = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [analyzing,    setAnalyzing]    = useState(false);
  const [autoAnalyze,  setAutoAnalyze]  = useState(false);
  const [autoInterval, setAutoInterval] = useState(5);
  const [watcherOn,    setWatcherOn]    = useState(false);

  const [question,     setQuestion]     = useState("");
  const [lastFrame,    setLastFrame]    = useState<string>("");
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [telegramSend, setTelegramSend] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Auth check ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getApiBase() || !getToken()) {
      router.replace("/");
    }
  }, [router]);

  // ── Scroll chat ──────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Camera control ───────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addMessage("jarvis", `⚠️ Kamera tidak bisa diakses: ${msg}`);
    }
  }, [cameraFacing]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    setAutoAnalyze(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Capture frame ────────────────────────────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    // JPEG at 0.75 quality — balaance quality vs speed
    return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
  }, []);

  // ── Analyze frame ────────────────────────────────────────────────────────
  const analyzeFrame = useCallback(async (customQuestion?: string) => {
    const frame = captureFrame() || lastFrame;
    if (!frame) {
      addMessage("jarvis", "❌ Tidak ada frame kamera. Aktifkan kamera terlebih dahulu.");
      return;
    }

    const q = (customQuestion || question || "Apa yang kamu lihat? Jelaskan secara detail.").trim();

    setLastFrame(frame);
    setAnalyzing(true);
    addMessage("user", q, true);

    try {
      const res = await apiReq("/api/vision/analyze", {
        image_b64:     frame,
        question:      q,
        send_telegram: telegramSend,
      }, 30000);

      const reply = res.analysis || res.answer || res.error || "Tidak ada respons";
      addMessage("jarvis", reply, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addMessage("jarvis", `❌ Error: ${msg}`);
    } finally {
      setAnalyzing(false);
      setQuestion("");
    }
  }, [captureFrame, lastFrame, question, telegramSend]);

  // ── Auto analyze ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    if (autoAnalyze && cameraOn) {
      captureTimerRef.current = setInterval(() => {
        if (!analyzing) {
          analyzeFrame("Apa yang kamu lihat sekarang?");
        }
      }, autoInterval * 1000);
    }
    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    };
  }, [autoAnalyze, cameraOn, autoInterval, analyzing, analyzeFrame]);

  // ── Watcher toggle ───────────────────────────────────────────────────────
  const toggleWatcher = async () => {
    try {
      if (watcherOn) {
        await apiReq("/api/vision/watcher/stop", {});
        setWatcherOn(false);
        addMessage("jarvis", "🔕 Proactive watcher dihentikan.");
      } else {
        await apiReq("/api/vision/watcher/start", {
          interval:      autoInterval,
          send_telegram: telegramSend,
        });
        setWatcherOn(true);
        addMessage("jarvis", `👁 Proactive watcher aktif — saya akan memberi tahu jika ada sesuatu yang penting setiap ${autoInterval} detik.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addMessage("jarvis", `❌ Watcher error: ${msg}`);
    }
  };

  // ── Screenshot & Send ────────────────────────────────────────────────────
  const screenshotAndSend = async () => {
    const frame = captureFrame();
    if (!frame) { addMessage("jarvis", "Kamera tidak aktif."); return; }
    try {
      const res = await apiReq("/api/telegram/photo", {
        image_b64: frame,
        caption:   "📸 Screenshot dari JARVIS Vision",
      });
      addMessage("jarvis", res.ok
        ? `✅ Foto terkirim ke Telegram (${res.sent_to} penerima)`
        : `⚠️ Gagal kirim: ${JSON.stringify(res.errors)}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addMessage("jarvis", `❌ ${msg}`);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  function addMessage(role: "user" | "jarvis", text: string, hasImage = false) {
    setMessages(prev => [
      ...prev,
      { role, text, hasImage, timestamp: Date.now() },
    ]);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#020812",
      display: "flex", flexDirection: "column",
      fontFamily: "'Outfit','Inter',monospace", color: "#e2e8f0",
    }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
        @keyframes fade-in    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes scan-line  { 0%{top:0} 100%{top:100%} }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-thumb { background:rgba(0,212,255,.15);border-radius:2px }
      `}</style>

      {/* Background grid */}
      <div style={{
        position:"fixed",inset:0,zIndex:0,pointerEvents:"none",
        backgroundImage:
          "linear-gradient(rgba(0,212,255,.02) 1px,transparent 1px)," +
          "linear-gradient(90deg,rgba(0,212,255,.02) 1px,transparent 1px)",
        backgroundSize:"48px 48px",
      }} />

      {/* ── HEADER */}
      <header style={{
        position:"relative",zIndex:10,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"10px 20px",
        background:"rgba(2,8,18,.97)",
        borderBottom:"1px solid rgba(0,212,255,.1)",
        backdropFilter:"blur(16px)",
        flexWrap:"wrap", gap:8,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={() => router.push("/hud")} style={navBtnStyle}>← HUD</button>
          <div>
            <div style={{
              fontSize:"1rem",fontWeight:900,letterSpacing:".2em",
              background:"linear-gradient(90deg,#00d4ff,#10b981)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
            }}>JARVIS VISION</div>
            <div style={{fontSize:".55rem",color:"rgba(0,212,255,.35)",letterSpacing:".2em"}}>
              GEMINI 2.0 · REAL-TIME ANALYSIS
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Camera toggle */}
          <button
            onClick={cameraOn ? stopCamera : startCamera}
            style={{
              ...actionBtnStyle,
              background: cameraOn ? "rgba(239,68,68,.1)"  : "rgba(16,185,129,.1)",
              border:     cameraOn ? "1px solid rgba(239,68,68,.3)" : "1px solid rgba(16,185,129,.3)",
              color:      cameraOn ? "#ef4444" : "#10b981",
            }}
          >
            {cameraOn ? "📷 Stop" : "📷 Start Camera"}
          </button>

          {/* Flip camera */}
          {cameraOn && (
            <button
              onClick={() => {
                stopCamera();
                setCameraFacing(f => f === "user" ? "environment" : "user");
                setTimeout(startCamera, 300);
              }}
              style={actionBtnStyle}
              title="Flip camera"
            >🔄</button>
          )}

          {/* Telegram toggle */}
          <button
            onClick={() => setTelegramSend(v => !v)}
            style={{
              ...actionBtnStyle,
              background: telegramSend ? "rgba(0,212,255,.1)" : "rgba(255,255,255,.03)",
              border:     telegramSend ? "1px solid rgba(0,212,255,.3)" : "1px solid rgba(255,255,255,.08)",
              color:      telegramSend ? "#00d4ff" : "rgba(226,232,240,.35)",
            }}
            title={telegramSend ? "Hasil akan dikirim ke Telegram" : "Klik untuk kirim hasil ke Telegram"}
          >
            ✈ {telegramSend ? "Telegram ON" : "Telegram"}
          </button>

          <button onClick={() => router.push("/hive")} style={navBtnStyle}>🌐 Hive</button>
          <button onClick={() => router.push("/dashboard")} style={navBtnStyle}>← Dashboard</button>
        </div>
      </header>

      {/* ── BODY */}
      <div style={{
        flex:1, display:"grid",
        gridTemplateColumns: "1fr 380px",
        gap:0, overflow:"hidden",
        position:"relative", zIndex:1,
        minHeight:0,
      }}>

        {/* ── LEFT: Camera + Controls */}
        <div style={{
          display:"flex",flexDirection:"column",
          background:"rgba(2,8,18,.5)",
          borderRight:"1px solid rgba(0,212,255,.07)",
          overflow:"hidden",
        }}>

          {/* Camera feed */}
          <div style={{
            position:"relative",flex:1,background:"#000",
            display:"flex",alignItems:"center",justifyContent:"center",
            minHeight:0,
          }}>
            <video
              ref={videoRef}
              playsInline muted autoPlay
              style={{
                width:"100%",height:"100%",objectFit:"contain",
                display: cameraOn ? "block" : "none",
              }}
            />
            <canvas ref={canvasRef} style={{display:"none"}} />

            {/* Overlay when off */}
            {!cameraOn && (
              <div style={{
                textAlign:"center",color:"rgba(226,232,240,.15)",
                display:"flex",flexDirection:"column",alignItems:"center",gap:12,
              }}>
                <div style={{fontSize:"4rem"}}>📷</div>
                <div style={{fontSize:"0.9rem"}}>Klik "Start Camera" untuk mengaktifkan</div>
                <div style={{fontSize:"0.65rem",color:"rgba(226,232,240,.08)"}}>
                  Kamera akan diakses untuk analisis real-time
                </div>
                <button
                  onClick={startCamera}
                  style={{
                    marginTop:8, padding:"10px 24px", borderRadius:10,
                    background:"rgba(16,185,129,.1)", border:"1px solid rgba(16,185,129,.3)",
                    color:"#10b981", fontFamily:"inherit", fontSize:"0.85rem",
                    cursor:"pointer", letterSpacing:".1em",
                  }}
                >
                  📷 AKTIFKAN KAMERA
                </button>
              </div>
            )}

            {/* Scan line overlay when camera on */}
            {cameraOn && (
              <>
                {/* Corner frames */}
                {["top-left","top-right","bottom-left","bottom-right"].map(pos => (
                  <div key={pos} style={{
                    position:"absolute",
                    ...(pos.includes("top")    ? {top:12}    : {bottom:12}),
                    ...(pos.includes("left")   ? {left:12}   : {right:12}),
                    width:24, height:24,
                    borderTop:    pos.includes("top")    ? "2px solid rgba(0,212,255,.6)" : "none",
                    borderBottom: pos.includes("bottom") ? "2px solid rgba(0,212,255,.6)" : "none",
                    borderLeft:   pos.includes("left")   ? "2px solid rgba(0,212,255,.6)" : "none",
                    borderRight:  pos.includes("right")  ? "2px solid rgba(0,212,255,.6)" : "none",
                  }} />
                ))}

                {/* Status badge */}
                <div style={{
                  position:"absolute",top:14,left:"50%",transform:"translateX(-50%)",
                  display:"flex",alignItems:"center",gap:6,
                  padding:"3px 10px",borderRadius:20,
                  background:"rgba(0,0,0,.6)",border:"1px solid rgba(0,212,255,.2)",
                  fontSize:".6rem",color:"rgba(0,212,255,.7)",letterSpacing:".1em",
                }}>
                  <PulseDot active={true} />
                  LIVE
                  {analyzing && <span style={{marginLeft:8,color:"#f59e0b"}}>● ANALYZING</span>}
                </div>

                {/* Auto-analyze badge */}
                {autoAnalyze && (
                  <div style={{
                    position:"absolute",top:40,left:"50%",transform:"translateX(-50%)",
                    padding:"2px 8px",borderRadius:20,
                    background:"rgba(245,158,11,.15)",border:"1px solid rgba(245,158,11,.3)",
                    fontSize:".55rem",color:"#f59e0b",letterSpacing:".1em",
                  }}>
                    AUTO-ANALYZE EVERY {autoInterval}s
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls bar */}
          <div style={{
            padding:"12px 16px",
            background:"rgba(2,8,18,.9)",
            borderTop:"1px solid rgba(0,212,255,.06)",
            display:"flex",flexDirection:"column",gap:10,
          }}>
            {/* Question input */}
            <div style={{display:"flex",gap:8}}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !analyzing && analyzeFrame()}
                placeholder="Tanyakan sesuatu tentang apa yang terlihat…"
                disabled={analyzing}
                style={{
                  flex:1,background:"rgba(0,0,0,.5)",
                  border:"1px solid rgba(0,212,255,.15)",borderRadius:8,
                  padding:"8px 12px",color:"#e2e8f0",fontSize:".85rem",
                  outline:"none",fontFamily:"inherit",
                  opacity: analyzing ? .5 : 1,
                }}
              />
              <button
                onClick={() => analyzeFrame()}
                disabled={analyzing || !cameraOn}
                style={{
                  padding:"0 18px",borderRadius:8,
                  background: analyzing ? "rgba(0,212,255,.05)" : "rgba(0,212,255,.12)",
                  border:"1px solid rgba(0,212,255,.25)",
                  color:"#00d4ff",fontWeight:700,fontSize:".85rem",
                  cursor: analyzing || !cameraOn ? "not-allowed" : "pointer",
                  minWidth:56,
                }}
              >
                {analyzing ? "⏳" : "👁"}
              </button>
            </div>

            {/* Quick actions */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[
                { label:"Siapa ini?",           q:"Siapa orang yang ada di gambar ini?" },
                { label:"Baca teks",             q:"Baca dan tuliskan semua teks yang ada di gambar ini." },
                { label:"Objek & lokasi",        q:"Sebutkan semua objek yang kamu lihat dan posisinya." },
                { label:"Apakah aman?",          q:"Apakah situasi ini aman? Ada bahaya terdeteksi?" },
                { label:"Deskripsikan",          q:"Deskripsikan gambar ini secara detail." },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => analyzeFrame(item.q)}
                  disabled={analyzing || !cameraOn}
                  style={{
                    padding:"4px 10px",borderRadius:6,
                    background:"rgba(255,255,255,.03)",
                    border:"1px solid rgba(255,255,255,.08)",
                    color:"rgba(226,232,240,.5)",fontSize:".65rem",
                    cursor: analyzing || !cameraOn ? "not-allowed" : "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Auto + watcher row */}
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              {/* Screenshot & send */}
              <button
                onClick={screenshotAndSend}
                disabled={!cameraOn}
                style={{
                  ...actionBtnStyle,
                  opacity: cameraOn ? 1 : .4,
                }}
              >
                📸 Kirim Telegram
              </button>

              {/* Auto analyze toggle */}
              <button
                onClick={() => setAutoAnalyze(v => !v)}
                disabled={!cameraOn}
                style={{
                  ...actionBtnStyle,
                  background: autoAnalyze ? "rgba(245,158,11,.1)" : "rgba(255,255,255,.03)",
                  border:     autoAnalyze ? "1px solid rgba(245,158,11,.3)" : "1px solid rgba(255,255,255,.08)",
                  color:      autoAnalyze ? "#f59e0b" : "rgba(226,232,240,.4)",
                  opacity:    cameraOn ? 1 : .4,
                }}
              >
                {autoAnalyze ? "🔁 Auto ON" : "🔁 Auto"}
              </button>

              {/* Interval */}
              <select
                value={autoInterval}
                onChange={e => setAutoInterval(Number(e.target.value))}
                style={{
                  background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.08)",
                  borderRadius:6,padding:"4px 8px",color:"rgba(226,232,240,.5)",
                  fontSize:".65rem",cursor:"pointer",
                }}
              >
                {[3,5,10,15,30].map(v => (
                  <option key={v} value={v}>{v}s</option>
                ))}
              </select>

              {/* Proactive watcher */}
              <button
                onClick={toggleWatcher}
                style={{
                  ...actionBtnStyle,
                  background: watcherOn ? "rgba(124,58,237,.12)" : "rgba(255,255,255,.03)",
                  border:     watcherOn ? "1px solid rgba(124,58,237,.3)" : "1px solid rgba(255,255,255,.08)",
                  color:      watcherOn ? "#a78bfa" : "rgba(226,232,240,.4)",
                }}
              >
                {watcherOn ? "👁 Watcher ON" : "👁 Watcher"}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Chat output */}
        <div style={{
          display:"flex",flexDirection:"column",
          background:"rgba(2,8,18,.7)",
          overflow:"hidden",
        }}>
          {/* Chat header */}
          <div style={{
            padding:"12px 16px 8px",
            borderBottom:"1px solid rgba(0,212,255,.06)",
            display:"flex",alignItems:"center",justifyContent:"space-between",
          }}>
            <div style={{fontSize:".6rem",letterSpacing:".2em",color:"rgba(0,212,255,.4)"}}>
              JARVIS VISION ANALYSIS
            </div>
            <button
              onClick={() => setMessages([])}
              style={{
                background:"none",border:"none",
                color:"rgba(226,232,240,.2)",cursor:"pointer",fontSize:".7rem",
              }}
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex:1,overflowY:"auto",
            padding:"12px 14px",
            display:"flex",flexDirection:"column",gap:10,
          }}>
            {messages.length === 0 && (
              <div style={{
                flex:1,display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center",
                color:"rgba(226,232,240,.15)",textAlign:"center",gap:10,padding:20,
              }}>
                <div style={{fontSize:"2.5rem"}}>👁</div>
                <div style={{fontSize:".8rem"}}>
                  Aktifkan kamera dan tanyakan sesuatu ke JARVIS.<br/>
                  <span style={{fontSize:".65rem",opacity:.6}}>
                    JARVIS akan menganalisis apa yang dilihat kamera.
                  </span>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display:"flex",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  gap:8,
                  animation:"fade-in .2s ease both",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width:28,height:28,borderRadius:"50%",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:".75rem",
                  background: msg.role === "user"
                    ? "rgba(0,212,255,.1)" : "rgba(124,58,237,.1)",
                  border: msg.role === "user"
                    ? "1px solid rgba(0,212,255,.2)" : "1px solid rgba(124,58,237,.2)",
                }}>
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth:"80%",
                  padding:"8px 12px",borderRadius:10,
                  background: msg.role === "user"
                    ? "rgba(0,212,255,.07)" : "rgba(124,58,237,.07)",
                  border: msg.role === "user"
                    ? "1px solid rgba(0,212,255,.12)" : "1px solid rgba(124,58,237,.12)",
                  fontSize:".8rem",lineHeight:1.6,
                  color: msg.role === "user"
                    ? "rgba(226,232,240,.8)" : "#e2e8f0",
                  whiteSpace:"pre-wrap",wordBreak:"break-word",
                }}>
                  {msg.hasImage && (
                    <div style={{
                      fontSize:".55rem",color:"rgba(0,212,255,.5)",
                      marginBottom:4,letterSpacing:".1em",
                    }}>
                      📸 + pertanyaan
                    </div>
                  )}
                  {msg.text}
                  <div style={{
                    fontSize:".5rem",
                    color:"rgba(226,232,240,.2)",
                    marginTop:4,textAlign:"right",
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString("id-ID")}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {analyzing && (
              <div style={{display:"flex",gap:8,animation:"fade-in .2s ease both"}}>
                <div style={{
                  width:28,height:28,borderRadius:"50%",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:"rgba(124,58,237,.1)",border:"1px solid rgba(124,58,237,.2)",
                  fontSize:".75rem",
                }}>🤖</div>
                <div style={{
                  padding:"10px 14px",borderRadius:10,
                  background:"rgba(124,58,237,.05)",border:"1px solid rgba(124,58,237,.1)",
                }}>
                  <div style={{display:"flex",gap:4}}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width:6,height:6,borderRadius:"50%",background:"#a78bfa",
                        animation:`pulse-dot 1.2s ${i*0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)",
  borderRadius:8, padding:"5px 12px", color:"rgba(226,232,240,.4)",
  cursor:"pointer", fontSize:".7rem", letterSpacing:".08em",
};

const actionBtnStyle: React.CSSProperties = {
  background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)",
  borderRadius:7, padding:"5px 12px", color:"rgba(226,232,240,.45)",
  cursor:"pointer", fontSize:".68rem", letterSpacing:".05em",
  transition:"all .15s", fontFamily:"inherit",
};
