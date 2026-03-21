"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login, setCredentials, getApiBase, getToken, ping } from "@/lib/api";

export default function HomePage() {
  const router   = useRouter();
  const [apiUrl,   setApiUrl]   = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [checking, setChecking] = useState(true);
  const [showPw,   setShowPw]   = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  // Check if already logged in
  useEffect(() => {
    const check = async () => {
      const base  = getApiBase();
      const token = getToken();
      if (base && token) {
        try {
          await ping();
          router.replace("/dashboard");
          return;
        } catch {}
      }
      setChecking(false);
    };
    check();

    // Auto-fill from URL params or current origin
    const params   = new URLSearchParams(window.location.search);
    const urlParam = params.get("url") || params.get("api");
    const pwParam  = params.get("pw") || params.get("password");

    if (urlParam) {
      setApiUrl(urlParam);
    } else if (typeof window !== "undefined") {
      setApiUrl(window.location.origin);
    }
    if (pwParam) setPassword(pwParam);

    if (urlParam && pwParam) {
      handleLogin(urlParam, pwParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (url?: string, pw?: string) => {
    const u = url || apiUrl;
    const p = pw  || password;
    if (!u || !p) {
      setError("Please fill in API URL and access key");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await login(u, p);
      if (result.success) {
        setCredentials(u, p, result.token);
        router.push("/dashboard");
      } else {
        setError("Login failed — check your access key");
      }
    } catch (e: any) {
      setError(e.message || "Connection failed. Check API URL and ensure JARVIS is running.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(circle at 30% 40%, #040c1c 0%, #02040a 100%)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "2px solid rgba(0,212,255,0.15)", borderTopColor: "#00d4ff",
            animation: "log-spin 0.8s linear infinite",
          }} />
          <p style={{ color: "rgba(226,232,240,0.3)", fontSize: "0.8rem" }}>Checking session…</p>
        </div>
        <style>{`@keyframes log-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
      background: "radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.04) 0%, transparent 50%),radial-gradient(ellipse at 70% 70%, rgba(124,58,237,0.04) 0%, transparent 50%), #02040a",
      position: "relative",
    }}>

      {/* Animated bg dots */}
      <div style={{
        position: "fixed", top: "5%", left: "5%", width: "40vw", height: "40vw", maxWidth: 500,
        background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "5%", right: "5%", width: "35vw", height: "35vw", maxWidth: 400,
        background: "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div style={{ width: "100%", maxWidth: 440, zIndex: 1, animation: "lp-up 0.45s cubic-bezier(0.4,0,0.2,1) both" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 80, height: 80, borderRadius: "22px",
            background: "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(124,58,237,0.12))",
            border: "1px solid rgba(0,212,255,0.25)",
            marginBottom: 18,
            boxShadow: "0 0 40px rgba(0,212,255,0.1), 0 0 80px rgba(0,212,255,0.05)",
          }}>
            <span style={{ fontSize: 36 }}>🤖</span>
          </div>
          <h1 style={{
            fontSize: "clamp(2rem, 8vw, 2.8rem)", fontWeight: 900, letterSpacing: "0.18em",
            background: "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 8, fontFamily: "'Outfit', 'Inter', sans-serif",
            filter: "drop-shadow(0 0 20px rgba(0,212,255,0.2))",
          }}>JARVIS</h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ height: 1, width: 24, background: "rgba(0,212,255,0.25)" }} />
            <p style={{ color: "rgba(226,232,240,0.35)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase" }}>
              AI Control System
            </p>
            <div style={{ height: 1, width: 24, background: "rgba(0,212,255,0.25)" }} />
          </div>
        </div>

        {/* Login card */}
        <div style={{
          background: "rgba(8,13,26,0.9)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(0,212,255,0.1)",
          borderRadius: 20,
          padding: "clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)",
          position: "relative", overflow: "hidden",
        }}>

          {/* Corner gradient accents */}
          <div style={{
            position: "absolute", top: 0, right: 0, width: 80, height: 80,
            background: "linear-gradient(225deg, rgba(0,212,255,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, width: 60, height: 60,
            background: "linear-gradient(45deg, rgba(124,58,237,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#00d4ff" }}>🔐</span> Secure Login
          </h2>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: "11px 16px", marginBottom: 22,
              color: "#fca5a5", fontSize: "0.83rem",
              display: "flex", alignItems: "flex-start", gap: 10,
              animation: "lp-shake 0.4s cubic-bezier(.36,.07,.19,.97) both",
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* API Endpoint field */}
            <div>
              <label style={{
                fontSize: "0.68rem", color: "rgba(226,232,240,0.45)", marginBottom: 8, display: "block",
                textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
              }}>
                API Endpoint
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.95rem" }}>
                  🔗
                </span>
                <input
                  id="api-url-input"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://xxxx.trycloudflare.com"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && pwRef.current?.focus()}
                  disabled={loading}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                    color: "#e2e8f0", padding: "11px 14px 11px 38px",
                    fontSize: "0.875rem", fontFamily: "inherit",
                    outline: "none", transition: "all 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#00d4ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label style={{
                fontSize: "0.68rem", color: "rgba(226,232,240,0.45)", marginBottom: 8, display: "block",
                textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
              }}>
                Access Key
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.95rem" }}>
                  🔑
                </span>
                <input
                  id="password-input"
                  ref={pwRef}
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  disabled={loading}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                    color: "#e2e8f0", padding: "11px 44px 11px 38px",
                    fontSize: "0.875rem", fontFamily: "inherit",
                    outline: "none", transition: "all 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#00d4ff"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                />
                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(226,232,240,0.4)", fontSize: "0.85rem", padding: 4,
                  }}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "👁️" : "🙈"}
                </button>
              </div>
            </div>

            {/* Login button */}
            <button
              id="login-btn"
              onClick={() => handleLogin()}
              disabled={loading}
              style={{
                width: "100%", justifyContent: "center",
                padding: "13px 20px", fontSize: "0.95rem", fontWeight: 700,
                marginTop: 4, borderRadius: 12,
                background: loading
                  ? "rgba(0,212,255,0.3)"
                  : "linear-gradient(135deg, #00d4ff 0%, #0088ff 100%)",
                color: "#000", border: "none",
                boxShadow: loading ? "none" : "0 8px 24px rgba(0,212,255,0.25)",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 10,
                transition: "all 0.2s",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => {
                if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = "none";
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#000",
                    animation: "lp-spin 0.7s linear infinite", flexShrink: 0,
                  }} />
                  Connecting…
                </>
              ) : (
                <>Establish Connection ⚡</>
              )}
            </button>
          </div>

          {/* Tips */}
          <div style={{
            marginTop: 28, paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            fontSize: "0.725rem", color: "rgba(226,232,240,0.28)",
            textAlign: "center", lineHeight: 1.6,
          }}>
            JARVIS backend must be running on the target PC.<br/>
            Connect via Cloudflare Tunnel or local network.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap",
          fontSize: "0.68rem", color: "rgba(226,232,240,0.2)", fontWeight: 500, letterSpacing: "0.05em",
        }}>
          <span>v2.1.0</span>
          <span>•</span>
          <span>Session Tokens</span>
          <span>•</span>
          <span>Rate Limited</span>
          <span>•</span>
          <span>End-to-End</span>
        </div>
      </div>

      <style>{`
        @keyframes lp-up    { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;} }
        @keyframes lp-spin  { to{transform:rotate(360deg);} }
        @keyframes lp-shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
