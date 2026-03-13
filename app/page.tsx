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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ position: "relative", zIndex: 1 }}>
      {/* Background glow orbs */}
      <div style={{
        position: "fixed", top: "20%", left: "15%", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "fixed", bottom: "20%", right: "15%", width: 300, height: 300,
        background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)",
        pointerEvents: "none"
      }} />

      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))",
            border: "2px solid rgba(0,212,255,0.4)",
            marginBottom: 16,
            boxShadow: "0 0 30px rgba(0,212,255,0.2)"
          }}>
            <span style={{ fontSize: 32 }}>🤖</span>
          </div>
          <h1 style={{
            fontSize: "2rem", fontWeight: 800, letterSpacing: "0.1em",
            background: "linear-gradient(135deg, #00d4ff, #7c3aed)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 4
          }}>JARVIS</h1>
          <p style={{ color: "rgba(226,232,240,0.5)", fontSize: "0.875rem", letterSpacing: "0.15em" }}>
            PORTABLE AI CONTROL SYSTEM
          </p>
        </div>

        {/* Login card */}
        <div className="glass" style={{
          borderRadius: 16, padding: 32,
          boxShadow: "0 0 40px rgba(0,212,255,0.08), 0 25px 50px rgba(0,0,0,0.5)"
        }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#e2e8f0", marginBottom: 24 }}>
            🔐 Authentication
          </h2>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              color: "#ef4444", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 8
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.5)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                API URL (Cloudflare Tunnel)
              </label>
              <input
                id="api-url-input"
                className="jarvis-input"
                type="text"
                placeholder="https://xxxx.trycloudflare.com"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.5)", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Dashboard Password
              </label>
              <input
                id="password-input"
                className="jarvis-input"
                type="password"
                placeholder="jarvis123"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>

            <button
              id="login-btn"
              className="btn-primary"
              onClick={() => handleLogin()}
              disabled={loading}
              style={{
                width: "100%", justifyContent: "center", padding: "12px",
                fontSize: "1rem", fontWeight: 600, marginTop: 8,
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 18, height: 18 }} /> Connecting...</>
              ) : (
                <> <span>⚡</span> Connect to JARVIS</>
              )}
            </button>
          </div>

          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(0,212,255,0.1)",
            fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", textAlign: "center"
          }}>
            💡 Get the API URL from Telegram after starting JARVIS
          </div>
        </div>

        {/* Status info */}
        <div style={{
          marginTop: 24, display: "flex", gap: 8, justifyContent: "center",
          fontSize: "0.75rem", color: "rgba(226,232,240,0.3)"
        }}>
          <span>v2.0.0</span>
          <span>•</span>
          <span>Portable AI Control System</span>
          <span>•</span>
          <span>Secure</span>
        </div>
      </div>
    </div>
  );
}
