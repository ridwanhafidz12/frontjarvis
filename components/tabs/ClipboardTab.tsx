"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getApiBase, getToken } from "@/lib/api";

async function apiRequest(path: string, opts: RequestInit = {}) {
  const base  = getApiBase();
  const token = getToken();
  const resp  = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
      ...opts.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

interface ClipboardHistory {
  id:      number;
  content: string;
  ts:      string;
}

export default function ClipboardTab() {
  const [content,   setContent]   = useState("");
  const [length,    setLength]    = useState(0);
  const [reading,   setReading]   = useState(false);
  const [writing,   setWriting]   = useState(false);
  const [sendText,  setSendText]  = useState("");
  const [history,   setHistory]   = useState<ClipboardHistory[]>([]);
  const [toast,     setToast]     = useState<{ msg: string; err: boolean } | null>(null);
  const [autoRead,  setAutoRead]  = useState(false);
  const [urlInput,  setUrlInput]  = useState("");
  const [openingUrl, setOpeningUrl] = useState(false);
  const toastRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyId   = useRef(0);

  const showToast = useCallback((msg: string, err = false) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, err });
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const readClipboard = useCallback(async (silent = false) => {
    if (!silent) setReading(true);
    try {
      const data = await apiRequest("/api/clipboard") as { content: string; length: number };
      setContent(data.content ?? "");
      setLength(data.length ?? 0);
      // Add to history if different from last entry
      setHistory(prev => {
        if (prev.length > 0 && prev[0].content === data.content) return prev;
        const entry: ClipboardHistory = {
          id:      ++historyId.current,
          content: data.content,
          ts:      new Date().toLocaleTimeString(),
        };
        return [entry, ...prev].slice(0, 20);  // keep last 20
      });
      if (!silent) showToast("📋 Clipboard berhasil dibaca");
    } catch (e: unknown) {
      if (!silent) showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      if (!silent) setReading(false);
    }
  }, [showToast]);

  useEffect(() => { readClipboard(true); }, [readClipboard]);

  // Auto-read every 5s
  useEffect(() => {
    if (!autoRead) return;
    const iv = setInterval(() => readClipboard(true), 5000);
    return () => clearInterval(iv);
  }, [autoRead, readClipboard]);

  const writeClipboard = async (text: string) => {
    if (!text.trim()) {
      showToast("⚠️ Teks tidak boleh kosong", true);
      return;
    }
    setWriting(true);
    try {
      await apiRequest("/api/clipboard", {
        method: "POST",
        body:   JSON.stringify({ text }),
      });
      showToast("✅ Teks berhasil dikirim ke clipboard PC target");
      setSendText("");
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setWriting(false);
    }
  };

  const openUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      showToast("⚠️ URL harus dimulai dengan http:// atau https://", true);
      return;
    }
    setOpeningUrl(true);
    try {
      await apiRequest("/api/open-url", {
        method: "POST",
        body:   JSON.stringify({ url }),
      });
      showToast(`🌐 URL dibuka di browser PC target: ${url.slice(0, 50)}`);
      setUrlInput("");
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setOpeningUrl(false);
    }
  };

  const isUrl = (text: string) => /^https?:\/\//i.test(text.trim());

  const truncate = (s: string, n = 120) => s.length > n ? s.slice(0, n) + "…" : s;

  return (
    <>
      <style>{`
        @keyframes cb-fade { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        @keyframes cb-spin { to{transform:rotate(360deg);} }
      `}</style>

      {toast && (
        <div style={{
          position: "fixed", bottom: 80, right: 16, zIndex: 9999,
          background: toast.err ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
          border: `1px solid ${toast.err ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
          color: toast.err ? "#fca5a5" : "#6ee7b7",
          borderRadius: 10, padding: "10px 16px",
          fontSize: "0.83rem", fontWeight: 600, backdropFilter: "blur(12px)",
          animation: "cb-fade 0.2s ease both", maxWidth: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "cb-fade 0.35s ease both" }}>

        {/* Header */}
        <div>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 4px" }}>
            📋 Clipboard & Remote Open
          </h2>
          <p style={{ fontSize: "0.72rem", color: "rgba(226,232,240,0.35)", margin: 0 }}>
            Baca / tulis clipboard PC target · buka URL di browser target
          </p>
        </div>

        {/* ── Read Clipboard ───────────────────────────────────────────────── */}
        <div style={{
          background: "rgba(6,10,22,0.6)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "18px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 35, height: 35, borderRadius: 10, flexShrink: 0,
                background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
              }}>📋</div>
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#e2e8f0" }}>Clipboard PC Target</div>
                <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.35)" }}>
                  {length > 0 ? `${length} karakter` : "Kosong"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              {/* Auto-read toggle */}
              <div
                onClick={() => setAutoRead(v => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                  background: autoRead ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${autoRead ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 8, padding: "5px 10px",
                }}
              >
                <div style={{
                  width: 28, height: 16, borderRadius: 8,
                  background: autoRead ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.1)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: autoRead ? 14 : 2,
                    width: 12, height: 12, borderRadius: "50%",
                    background: autoRead ? "#00d4ff" : "rgba(255,255,255,0.35)",
                    transition: "left 0.2s",
                  }} />
                </div>
                <span style={{ fontSize: "0.72rem", color: autoRead ? "#00d4ff" : "rgba(226,232,240,0.4)" }}>
                  Auto (5s)
                </span>
              </div>

              <button
                onClick={() => readClipboard(false)}
                disabled={reading}
                style={{
                  background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                  color: "#00d4ff", borderRadius: 8, padding: "7px 14px",
                  fontSize: "0.8rem", fontWeight: 600, cursor: reading ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                }}
              >
                <span style={{ animation: reading ? "cb-spin 0.7s linear infinite" : "none", display: "inline-block" }}>
                  🔄
                </span>
                Baca
              </button>
            </div>
          </div>

          {/* Content display */}
          <div style={{
            background: "#010408", border: "1px solid rgba(0,212,255,0.1)",
            borderRadius: 8, padding: "12px 14px",
            fontFamily: "monospace", fontSize: "0.82rem",
            color: content ? "#e2e8f0" : "rgba(226,232,240,0.2)",
            minHeight: 80, maxHeight: 200, overflowY: "auto",
            whiteSpace: "pre-wrap", wordBreak: "break-all",
            lineHeight: 1.6,
          }}>
            {content || "— clipboard kosong —"}
          </div>

          {/* Quick actions on content */}
          {content && (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <button
                onClick={() => navigator.clipboard.writeText(content)}
                style={{
                  background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.18)",
                  color: "#00d4ff", borderRadius: 7, padding: "5px 12px",
                  fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                📥 Salin ke clipboard lokal
              </button>
              {isUrl(content) && (
                <button
                  onClick={() => window.open(content.trim(), "_blank")}
                  style={{
                    background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
                    color: "#a78bfa", borderRadius: 7, padding: "5px 12px",
                    fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  🔗 Buka URL ini di browser lokal
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Send to Clipboard ────────────────────────────────────────────── */}
        <div style={{
          background: "rgba(6,10,22,0.6)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "18px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 35, height: 35, borderRadius: 10, flexShrink: 0,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
            }}>📤</div>
            <div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#e2e8f0" }}>Kirim ke Clipboard</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.35)" }}>
                Teks akan masuk clipboard PC target — bisa langsung Ctrl+V
              </div>
            </div>
          </div>

          <textarea
            value={sendText}
            onChange={e => setSendText(e.target.value)}
            placeholder="Ketik teks yang ingin dikirim ke clipboard PC target…"
            rows={3}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 8, padding: "10px 12px", color: "#e2e8f0",
              fontSize: "0.85rem", fontFamily: "inherit", outline: "none",
              resize: "vertical", width: "100%", boxSizing: "border-box",
            }}
          />

          {/* Quick templates */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["cmd /c \"\"", "powershell -WindowStyle Hidden -Command ", "https://", "Hello from JARVIS!"] as string[]).map(t => (
              <button key={t} onClick={() => setSendText(t)} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(226,232,240,0.5)", borderRadius: 6, padding: "3px 9px",
                fontSize: "0.7rem", cursor: "pointer", fontFamily: "monospace",
              }}>
                {t.length > 28 ? t.slice(0, 28) + "…" : t}
              </button>
            ))}
          </div>

          <button
            onClick={() => writeClipboard(sendText)}
            disabled={writing || !sendText.trim()}
            style={{
              background: writing ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#22c55e", borderRadius: 8, padding: "10px",
              fontSize: "0.85rem", fontWeight: 700, cursor: writing || !sendText.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: "inherit", transition: "all 0.2s",
              opacity: !sendText.trim() ? 0.5 : 1,
            }}
          >
            {writing ? (
              <><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #22c55e", borderTopColor: "transparent", animation: "cb-spin 0.7s linear infinite", display: "inline-block" }} /> Mengirim…</>
            ) : "📤 Kirim ke Clipboard PC Target"}
          </button>
        </div>

        {/* ── Open URL ────────────────────────────────────────────────────── */}
        <div style={{
          background: "rgba(6,10,22,0.6)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "18px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 35, height: 35, borderRadius: 10, flexShrink: 0,
              background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
            }}>🌐</div>
            <div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#e2e8f0" }}>Buka URL di PC Target</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.35)" }}>
                URL akan dibuka di browser default PC target sekarang
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && openUrl()}
              placeholder="https://example.com"
              type="url"
              style={{
                flex: 1, minWidth: 0,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 8, padding: "9px 12px", color: "#e2e8f0",
                fontSize: "0.85rem", fontFamily: "inherit", outline: "none",
              }}
            />
            <button
              onClick={openUrl}
              disabled={openingUrl || !urlInput.trim()}
              style={{
                background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)",
                color: "#a78bfa", borderRadius: 8, padding: "9px 16px",
                fontSize: "0.85rem", fontWeight: 700, cursor: openingUrl || !urlInput.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                opacity: !urlInput.trim() ? 0.5 : 1,
              }}
            >
              {openingUrl ? (
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #a78bfa", borderTopColor: "transparent", animation: "cb-spin 0.7s linear infinite", display: "inline-block" }} />
              ) : "🌐"} Open
            </button>
          </div>

          {/* Quick URLs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["https://google.com", "https://youtube.com", "https://github.com"].map(u => (
              <button key={u} onClick={() => setUrlInput(u)} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(226,232,240,0.45)", borderRadius: 6, padding: "3px 9px",
                fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit",
              }}>
                {u.replace("https://", "")}
              </button>
            ))}
          </div>
        </div>

        {/* ── History ─────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div style={{
            background: "rgba(6,10,22,0.6)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: "16px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e2e8f0" }}>
                📝 Riwayat Clipboard ({history.length})
              </div>
              <button onClick={() => setHistory([])} style={{
                background: "none", border: "none", color: "rgba(226,232,240,0.3)",
                cursor: "pointer", fontSize: "0.72rem",
              }}>Hapus Riwayat</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
              {history.map(h => (
                <div
                  key={h.id}
                  onClick={() => setSendText(h.content)}
                  style={{
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8, padding: "8px 12px",
                    cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(0,212,255,0.04)"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.025)"}
                >
                  <span style={{ fontSize: "0.78rem", color: "rgba(226,232,240,0.6)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                    {truncate(h.content) || "—"}
                  </span>
                  <span style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.25)", flexShrink: 0 }}>{h.ts}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.25)", textAlign: "center" }}>
              Klik untuk memilih sebagai teks yang dikirim
            </div>
          </div>
        )}
      </div>
    </>
  );
}
