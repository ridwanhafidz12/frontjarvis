"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, setCredentials, getApiBase, getToken, ping } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  // Check if already logged in
  useEffect(() => {
    const check = async () => {
      const base = getApiBase();
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

    // Auto-fill from URL params or default to current origin
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url") || params.get("api");
    const pwParam = params.get("pw") || params.get("password");
    
    if (urlParam) {
      setApiUrl(urlParam);
    } else if (typeof window !== "undefined") {
      setApiUrl(window.location.origin);
    }
    
    if (pwParam) setPassword(pwParam);
    
    // Auto-login if both params provided
    if (urlParam && pwParam) {
      handleLogin(urlParam, pwParam);
    }
  }, []);

  const handleLogin = async (url?: string, pw?: string) => {
    const u = url || apiUrl;
    const p = pw || password;
    if (!u || !p) {
      setError("Please fill in API URL and password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await login(u, p);
      if (result.success) {
        setCredentials(u, p);
        router.push("/dashboard");
      } else {
        setError("Login failed");
      }
    } catch (e: any) {
      setError(e.message || "Connection failed. Check API URL.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ position: "relative", zIndex: 1, background: "radial-gradient(circle at center, #0a0f1e 0%, #020408 100%)" }}>
      {/* Background glow orbs */}
      <div style={{
        position: "fixed", top: "10%", left: "10%", width: "40vw", height: "40vw",
        background: "radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: -1
      }} />
      <div style={{
        position: "fixed", bottom: "10%", right: "10%", width: "35vw", height: "35vw",
        background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: -1
      }} />

      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 90, height: 90, borderRadius: "24px",
            background: "linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.1))",
            border: "1px solid rgba(0,212,255,0.3)",
            marginBottom: 20,
            boxShadow: "0 0 40px rgba(0,212,255,0.15)",
            transform: "rotate(-5deg)"
          }}>
            <span style={{ fontSize: 40 }}>🤖</span>
          </div>
          <h1 style={{
            fontSize: "2.5rem", fontWeight: 900, letterSpacing: "0.15em",
            background: "linear-gradient(135deg, #00d4ff 0%, #7c3aed 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 8, filter: "drop-shadow(0 0 10px rgba(0,212,255,0.3))"
          }}>JARVIS</h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ height: 1, width: 20, background: "rgba(0,212,255,0.3)" }} />
            <p style={{ color: "rgba(226,232,240,0.4)", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.3em", textTransform: "uppercase" }}>
              AI Control System
            </p>
            <div style={{ height: 1, width: 20, background: "rgba(0,212,255,0.3)" }} />
          </div>
        </div>

        {/* Login card */}
        <div className="glass" style={{
          borderRadius: 24, padding: "40px 32px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)",
          position: "relative", overflow: "hidden"
        }}>
          {/* Decorative corner accent */}
          <div style={{
            position: "absolute", top: 0, right: 0, width: 60, height: 60,
            background: "linear-gradient(225deg, rgba(0,212,255,0.2) 0%, transparent 70%)",
            pointerEvents: "none"
          }} />

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", marginBottom: 32, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#00d4ff" }}>🔐</span> Secure Login
          </h2>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12, padding: "12px 16px", marginBottom: 24,
              color: "#ef4444", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 10,
              animation: "shake 0.5s cubic-bezier(.36,.07,.19,.97) both"
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="input-group">
              <label style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.5)", marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                API Endpoint
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(0,212,255,0.5)", fontSize: "1rem" }}>🔗</span>
                <input
                  id="api-url-input"
                  className="jarvis-input"
                  type="text"
                  placeholder="https://xxxx.trycloudflare.com"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  style={{ paddingLeft: 40, height: 48, background: "rgba(0,0,0,0.2)" }}
                />
              </div>
            </div>

            <div className="input-group">
              <label style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.5)", marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
                Access Key
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(0,212,255,0.5)", fontSize: "1rem" }}>🔑</span>
                <input
                  id="password-input"
                  className="jarvis-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  style={{ paddingLeft: 40, height: 48, background: "rgba(0,0,0,0.2)" }}
                />
              </div>
            </div>

            <button
              id="login-btn"
              className="btn-primary"
              onClick={() => handleLogin()}
              disabled={loading}
              style={{
                width: "100%", justifyContent: "center", padding: "14px",
                fontSize: "1rem", fontWeight: 700, marginTop: 8,
                opacity: loading ? 0.7 : 1, borderRadius: 12,
                background: "linear-gradient(135deg, #00d4ff 0%, #0088ff 100%)",
                color: "#000", border: "none", boxShadow: "0 10px 20px rgba(0,212,255,0.2)"
              }}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 18, height: 18, borderTopColor: "#000" }} /> Connecting...</>
              ) : (
                <>Establish Connection ⚡</>
              )}
            </button>
          </div>

          <div style={{
            marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)",
            fontSize: "0.75rem", color: "rgba(226,232,240,0.3)", textAlign: "center", lineHeight: 1.5
          }}>
            Please ensure the JARVIS backend is running and <br/> Cloudflare Tunnel is active.
          </div>
        </div>

        {/* Footer info */}
        <div style={{
          marginTop: 32, display: "flex", gap: 16, justifyContent: "center",
          fontSize: "0.7rem", color: "rgba(226,232,240,0.25)", fontWeight: 500, letterSpacing: "0.05em"
        }}>
          <span>v2.0.0-Stable</span>
          <span>•</span>
          <span>Encrypted Session</span>
          <span>•</span>
          <span>System Ready</span>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
}
