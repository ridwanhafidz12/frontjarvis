"use client";
import { useState, useEffect, useCallback } from "react";
import { getApiBase, getToken } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface ChromeProfile {
  directory: string;
  name: string;
  email: string;
  path?: string;
}

interface FirefoxProfile {
  directory: string;
  path: string;
}

interface Password {
  url: string;
  username: string;
  password: string;
}

interface BrowserProfiles {
  chrome: {
    profiles: ChromeProfile[];
    executable: string | null;
    count: number;
  };
  firefox: {
    profiles: FirefoxProfile[];
    executable: string | null;
    count: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function maskPw(pw: string, show: boolean) {
  if (show) return pw;
  return "•".repeat(Math.min(pw.length, 12));
}

function BrowserBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    chrome: "#4285f4", firefox: "#ff6d00", default: "#10b981",
  };
  return (
    <span style={{
      padding: "1px 7px", borderRadius: 12, fontSize: "0.6rem", fontWeight: 700,
      background: `${colors[name] || "#667"}22`,
      border: `1px solid ${colors[name] || "#667"}44`,
      color: colors[name] || "#667",
      letterSpacing: "0.04em", textTransform: "uppercase",
    }}>
      {name}
    </span>
  );
}

// ── Password Row ───────────────────────────────────────────────────────────
function PasswordRow({ pw }: { pw: Password }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<"url"|"user"|"pw"|null>(null);

  const copy = (text: string, key: "url"|"user"|"pw") => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 1.5fr 1.5fr auto",
      gap: 8, alignItems: "center",
      padding: "8px 12px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)",
      borderRadius: 8, fontSize: "0.78rem",
      transition: "background 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"}
    >
      {/* URL */}
      <button onClick={() => copy(pw.url, "url")} style={{
        background: "none", border: "none", color: copied === "url" ? "#22c55e" : "#00d4ff",
        cursor: "pointer", textAlign: "left", fontSize: "0.75rem",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace",
      }} title={pw.url}>
        {copied === "url" ? "✓ Copied" : (pw.url || "—").replace(/^https?:\/\//, "").slice(0, 35)}
      </button>
      {/* Username */}
      <button onClick={() => copy(pw.username, "user")} style={{
        background: "none", border: "none",
        color: copied === "user" ? "#22c55e" : "rgba(226,232,240,0.7)",
        cursor: "pointer", textAlign: "left", fontSize: "0.75rem",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace",
      }} title={pw.username}>
        {copied === "user" ? "✓ Copied" : pw.username || "—"}
      </button>
      {/* Password */}
      <button onClick={() => copy(pw.password, "pw")} style={{
        background: "none", border: "none",
        color: copied === "pw" ? "#22c55e" : "rgba(226,232,240,0.5)",
        cursor: "pointer", textAlign: "left", fontSize: "0.75rem",
        fontFamily: "monospace",
      }}>
        {copied === "pw" ? "✓ Copied" : maskPw(pw.password, show)}
      </button>
      {/* Toggle show */}
      <button onClick={() => setShow(v => !v)} style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 5, padding: "2px 7px", fontSize: "0.65rem",
        color: "rgba(226,232,240,0.4)", cursor: "pointer", flexShrink: 0, fontFamily: "inherit",
      }}>
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function BrowserTab() {
  const [profiles,      setProfiles]      = useState<BrowserProfiles | null>(null);
  const [passwords,     setPasswords]     = useState<Password[]>([]);
  const [pwBrowser,     setPwBrowser]     = useState<"chrome"|"firefox">("chrome");
  const [pwProfile,     setPwProfile]     = useState("Default");
  const [loadingProfs,  setLoadingProfs]  = useState(false);
  const [loadingPws,    setLoadingPws]    = useState(false);
  const [openUrl,       setOpenUrl]       = useState("");
  const [openBrowser,   setOpenBrowser]   = useState<"chrome"|"firefox"|"default">("chrome");
  const [openProfile,   setOpenProfile]   = useState("");
  const [toast,         setToast]         = useState<{msg: string; type: "success"|"error"|"info"} | null>(null);
  const [pwFilter,      setPwFilter]      = useState("");
  const [closing,       setClosing]       = useState(false);
  const [closeTarget,   setCloseTarget]   = useState("");
  const [activeTab,     setActiveTab]     = useState<"profiles"|"passwords"|"open"|"tab">("profiles");

  const showToast = (msg: string, type: "success"|"error"|"info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const api = useCallback(async (path: string, opts: RequestInit = {}) => {
    const base  = getApiBase();
    const token = getToken();
    const resp  = await fetch(`${base}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts.headers },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || resp.statusText);
    }
    return resp.json();
  }, []);

  const loadProfiles = useCallback(async () => {
    setLoadingProfs(true);
    try {
      const data = await api("/api/browser/profiles");
      setProfiles(data);
    } catch (e: unknown) {
      showToast(`Gagal load profiles: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setLoadingProfs(false);
    }
  }, [api]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const loadPasswords = useCallback(async () => {
    setLoadingPws(true);
    setPasswords([]);
    try {
      const data = await api(`/api/browser/passwords?browser=${pwBrowser}&profile=${encodeURIComponent(pwProfile)}`);
      setPasswords(data.passwords || []);
      showToast(`✅ Loaded ${data.count} passwords dari ${pwBrowser}`, "success");
    } catch (e: unknown) {
      showToast(`Gagal load passwords: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setLoadingPws(false);
    }
  }, [api, pwBrowser, pwProfile]);

  const openBrowserFn = async () => {
    try {
      const data = await api("/api/browser/open", {
        method: "POST",
        body: JSON.stringify({ browser: openBrowser, profile: openProfile || undefined, url: openUrl }),
      });
      showToast(`✅ ${data.browser} opened${openProfile ? ` (${openProfile})` : ""}`, "success");
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`, "error");
    }
  };

  const openTabFn = async (url: string, browser: string) => {
    if (!url.trim()) return;
    try {
      await api("/api/browser/tab", {
        method: "POST",
        body: JSON.stringify({ action: "open", url: url.trim(), browser }),
      });
      showToast(`✅ Opened: ${url}`, "success");
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`, "error");
    }
  };

  const closeTabFn = async () => {
    if (!closeTarget.trim()) return;
    setClosing(true);
    try {
      const data = await api("/api/browser/tab", {
        method: "POST",
        body: JSON.stringify({ action: "close", domain: closeTarget.trim() }),
      });
      showToast(`✅ Closed ${data.closed} tab(s) for: ${closeTarget}`, "success");
    } catch (e: unknown) {
      showToast(`Error: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setClosing(false);
    }
  };

  const filteredPws = passwords.filter(p =>
    !pwFilter || p.url?.includes(pwFilter) || p.username?.includes(pwFilter)
  );

  const chromeProfiles = profiles?.chrome?.profiles || [];
  const ffProfiles     = profiles?.firefox?.profiles || [];

  const TAB_STYLE = (active: boolean) => ({
    padding: "6px 14px", borderRadius: 8, fontSize: "0.74rem", fontWeight: 600,
    border: `1px solid ${active ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.07)"}`,
    background: active ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)",
    color: active ? "#00d4ff" : "rgba(226,232,240,0.45)",
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
  });

  return (
    <>
      <style>{`
        @keyframes brow-up { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        @keyframes brow-sp { to{transform:rotate(360deg);} }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, right: 16, zIndex: 9999,
          background: toast.type === "error" ? "rgba(239,68,68,0.15)" : toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(0,212,255,0.1)",
          border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,0.3)" : toast.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(0,212,255,0.2)"}`,
          color: toast.type === "error" ? "#fca5a5" : toast.type === "success" ? "#6ee7b7" : "#7dd3fc",
          borderRadius: 10, padding: "10px 16px", fontSize: "0.83rem", fontWeight: 600,
          backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "brow-up 0.25s ease both",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 2px" }}>
              🌐 Browser Manager
            </h2>
            <p style={{ fontSize: "0.67rem", color: "rgba(226,232,240,0.3)", margin: 0 }}>
              Kelola Chrome/Firefox · Profil · Password · Tab
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{
              fontSize: "0.68rem", color: "rgba(226,232,240,0.3)",
              display: "flex", gap: 10,
            }}>
              <span>Chrome: <b style={{ color: "#4285f4" }}>{profiles?.chrome.count ?? "…"}</b></span>
              <span>Firefox: <b style={{ color: "#ff6d00" }}>{profiles?.firefox.count ?? "…"}</b></span>
            </div>
            <button onClick={loadProfiles} disabled={loadingProfs} style={{
              background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)",
              color: "#00d4ff", borderRadius: 7, padding: "5px 10px",
              fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
            }}>
              {loadingProfs
                ? <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00d4ff", animation: "brow-sp 0.7s linear infinite" }} />
                : "🔄 Refresh"}
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([
            ["profiles", "👤 Profil"],
            ["passwords", "🔑 Password"],
            ["open", "🚀 Buka Browser"],
            ["tab", "🗂 Tab Kontrol"],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={TAB_STYLE(activeTab === id)}>
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILES ─────────────────────────────────────────────── */}
        {activeTab === "profiles" && (
          <div style={{ animation: "brow-up 0.2s ease both" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Chrome profiles */}
              <div style={{
                background: "rgba(4,8,18,0.7)", border: "1px solid rgba(66,133,244,0.2)",
                borderRadius: 12, padding: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <BrowserBadge name="chrome" />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e2e8f0" }}>Chrome</span>
                  <span style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.3)", marginLeft: "auto" }}>
                    {chromeProfiles.length} profil
                  </span>
                </div>
                {loadingProfs ? (
                  <div style={{ textAlign: "center", padding: 20, color: "rgba(226,232,240,0.3)", fontSize: "0.78rem" }}>Loading…</div>
                ) : chromeProfiles.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "rgba(226,232,240,0.2)", fontSize: "0.76rem" }}>
                    Tidak ada profil Chrome ditemukan
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {chromeProfiles.map(p => (
                      <div key={p.directory} style={{
                        background: "rgba(66,133,244,0.05)", border: "1px solid rgba(66,133,244,0.12)",
                        borderRadius: 8, padding: "8px 10px",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>
                            {p.name || p.directory}
                          </div>
                          {p.email && (
                            <div style={{ fontSize: "0.65rem", color: "rgba(66,133,244,0.7)", fontFamily: "monospace" }}>
                              📧 {p.email}
                            </div>
                          )}
                          <div style={{ fontSize: "0.6rem", color: "rgba(226,232,240,0.2)", fontFamily: "monospace" }}>
                            {p.directory}
                          </div>
                        </div>
                        <button onClick={() => {
                          setOpenBrowser("chrome");
                          setOpenProfile(p.directory);
                          setActiveTab("open");
                        }} style={{
                          background: "rgba(66,133,244,0.1)", border: "1px solid rgba(66,133,244,0.2)",
                          color: "#4285f4", borderRadius: 6, padding: "3px 9px",
                          fontSize: "0.65rem", fontWeight: 600, cursor: "pointer", flexShrink: 0,
                          fontFamily: "inherit",
                        }}>
                          ▶ Buka
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Firefox profiles */}
              <div style={{
                background: "rgba(4,8,18,0.7)", border: "1px solid rgba(255,109,0,0.2)",
                borderRadius: 12, padding: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <BrowserBadge name="firefox" />
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#e2e8f0" }}>Firefox</span>
                  <span style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.3)", marginLeft: "auto" }}>
                    {ffProfiles.length} profil
                  </span>
                </div>
                {ffProfiles.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "rgba(226,232,240,0.2)", fontSize: "0.76rem" }}>
                    Tidak ada profil Firefox ditemukan
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ffProfiles.map(p => (
                      <div key={p.directory} style={{
                        background: "rgba(255,109,0,0.05)", border: "1px solid rgba(255,109,0,0.12)",
                        borderRadius: 8, padding: "8px 10px",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                      }}>
                        <div>
                          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#e2e8f0", fontFamily: "monospace" }}>
                            {p.directory}
                          </div>
                        </div>
                        <button onClick={() => {
                          setOpenBrowser("firefox");
                          setActiveTab("open");
                        }} style={{
                          background: "rgba(255,109,0,0.1)", border: "1px solid rgba(255,109,0,0.2)",
                          color: "#ff6d00", borderRadius: 6, padding: "3px 9px",
                          fontSize: "0.65rem", fontWeight: 600, cursor: "pointer", flexShrink: 0,
                          fontFamily: "inherit",
                        }}>
                          ▶ Buka
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Firefox executable path */}
                {profiles?.firefox.executable && (
                  <div style={{ marginTop: 10, fontSize: "0.62rem", fontFamily: "monospace", color: "rgba(226,232,240,0.2)", wordBreak: "break-all" }}>
                    📂 {profiles.firefox.executable}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PASSWORDS ─────────────────────────────────────────────── */}
        {activeTab === "passwords" && (
          <div style={{ animation: "brow-up 0.2s ease both", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Controls */}
            <div style={{
              background: "rgba(4,8,18,0.7)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
            }}>
              {/* Browser selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.4)" }}>Browser</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["chrome", "firefox"] as const).map(b => (
                    <button key={b} onClick={() => setPwBrowser(b)} style={{
                      padding: "5px 12px", borderRadius: 7, fontSize: "0.74rem", fontWeight: 600,
                      border: `1px solid ${pwBrowser === b ? (b === "chrome" ? "rgba(66,133,244,0.5)" : "rgba(255,109,0,0.5)") : "rgba(255,255,255,0.08)"}`,
                      background: pwBrowser === b ? (b === "chrome" ? "rgba(66,133,244,0.12)" : "rgba(255,109,0,0.12)") : "rgba(255,255,255,0.03)",
                      color: pwBrowser === b ? (b === "chrome" ? "#4285f4" : "#ff6d00") : "rgba(226,232,240,0.4)",
                      cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
                    }}>{b}</button>
                  ))}
                </div>
              </div>

              {/* Profile (Chrome only) */}
              {pwBrowser === "chrome" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.4)" }}>Profile Chrome</span>
                  <select
                    value={pwProfile}
                    onChange={e => setPwProfile(e.target.value)}
                    style={{
                      background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 7, padding: "6px 10px", color: "#e2e8f0",
                      fontSize: "0.76rem", fontFamily: "inherit", cursor: "pointer",
                    }}
                  >
                    <option value="Default">Default</option>
                    {chromeProfiles.map(p => (
                      <option key={p.directory} value={p.directory}>
                        {p.name || p.directory} {p.email ? `(${p.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button onClick={loadPasswords} disabled={loadingPws} style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171", borderRadius: 8, padding: "8px 16px",
                fontSize: "0.78rem", fontWeight: 700, cursor: loadingPws ? "not-allowed" : "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
              }}>
                {loadingPws
                  ? <><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(239,68,68,0.3)", borderTopColor: "#f87171", animation: "brow-sp 0.7s linear infinite" }} /> Loading…</>
                  : "🔓 Ambil Password"}
              </button>

              {passwords.length > 0 && (
                <input
                  value={pwFilter} onChange={e => setPwFilter(e.target.value)}
                  placeholder="🔍 Filter URL / username..."
                  style={{
                    flex: 1, minWidth: 120, background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 7, padding: "7px 10px", color: "#e2e8f0",
                    fontSize: "0.76rem", fontFamily: "inherit", outline: "none",
                  }}
                />
              )}
            </div>

            {/* Warning */}
            <div style={{
              background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 8, padding: "8px 12px",
              fontSize: "0.68rem", color: "rgba(245,158,11,0.8)",
            }}>
              ⚠️ Data password sensitif. Pastikan hanya diakses di lingkungan yang aman.
              Klik nilai untuk menyalinnya ke clipboard.
            </div>

            {/* Password list */}
            {passwords.length > 0 && (
              <>
                <div style={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr auto",
                  gap: 8, padding: "4px 12px",
                  fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "rgba(226,232,240,0.25)",
                }}>
                  <span>URL</span><span>Username</span><span>Password</span><span>Show</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
                  {(pwFilter ? filteredPws : passwords).map((pw, i) => (
                    <PasswordRow key={i} pw={pw} />
                  ))}
                  {filteredPws.length === 0 && pwFilter && (
                    <div style={{ textAlign: "center", padding: 20, color: "rgba(226,232,240,0.2)", fontSize: "0.76rem" }}>
                      Tidak ada hasil untuk: "{pwFilter}"
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.2)" }}>
                  Menampilkan {filteredPws.length} dari {passwords.length} password
                </div>
              </>
            )}
          </div>
        )}

        {/* ── OPEN BROWSER ──────────────────────────────────────────── */}
        {activeTab === "open" && (
          <div style={{ animation: "brow-up 0.2s ease both", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              background: "rgba(4,8,18,0.7)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14,
            }}>
              {/* Browser */}
              <div>
                <div style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.4)", marginBottom: 6 }}>Browser</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["chrome", "firefox", "default"] as const).map(b => (
                    <button key={b} onClick={() => setOpenBrowser(b)} style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: "0.76rem", fontWeight: 600,
                      border: `1px solid ${openBrowser === b ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                      background: openBrowser === b ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.03)",
                      color: openBrowser === b ? "#00d4ff" : "rgba(226,232,240,0.45)",
                      cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
                    }}>{b}</button>
                  ))}
                </div>
              </div>

              {/* Profile (Chrome only) */}
              {openBrowser === "chrome" && (
                <div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.4)", marginBottom: 6 }}>
                    Profil Chrome <span style={{ color: "rgba(226,232,240,0.25)" }}>(Kosong = default)</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setOpenProfile("")} style={{
                      padding: "5px 12px", borderRadius: 7, fontSize: "0.72rem",
                      border: `1px solid ${!openProfile ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                      background: !openProfile ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)",
                      color: !openProfile ? "#00d4ff" : "rgba(226,232,240,0.4)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}>Default</button>
                    {chromeProfiles.map(p => (
                      <button key={p.directory} onClick={() => setOpenProfile(p.directory)} style={{
                        padding: "5px 12px", borderRadius: 7, fontSize: "0.72rem",
                        border: `1px solid ${openProfile === p.directory ? "rgba(66,133,244,0.45)" : "rgba(255,255,255,0.07)"}`,
                        background: openProfile === p.directory ? "rgba(66,133,244,0.12)" : "rgba(255,255,255,0.03)",
                        color: openProfile === p.directory ? "#4285f4" : "rgba(226,232,240,0.4)",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                        {p.name || p.directory}
                        {p.email && <span style={{ display: "block", fontSize: "0.58rem", color: "rgba(66,133,244,0.6)", marginTop: 1 }}>{p.email}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* URL */}
              <div>
                <div style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.4)", marginBottom: 6 }}>
                  URL <span style={{ color: "rgba(226,232,240,0.25)" }}>(Kosong = new tab)</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={openUrl} onChange={e => setOpenUrl(e.target.value)}
                    placeholder="https://google.com"
                    onKeyDown={e => e.key === "Enter" && openBrowserFn()}
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                      padding: "8px 12px", color: "#e2e8f0", fontSize: "0.82rem",
                      fontFamily: "monospace", outline: "none",
                    }}
                  />
                  <button onClick={openBrowserFn} style={{
                    background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
                    color: "#00d4ff", borderRadius: 8, padding: "8px 18px",
                    fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    🚀 Buka
                  </button>
                </div>
              </div>

              {/* Quick URLs */}
              <div>
                <div style={{ fontSize: "0.62rem", color: "rgba(226,232,240,0.25)", marginBottom: 6 }}>Quick URLs</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {["https://google.com", "https://youtube.com", "https://github.com", "https://chat.openai.com", "https://gemini.google.com"].map(url => (
                    <button key={url} onClick={() => setOpenUrl(url)} style={{
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                      color: "rgba(226,232,240,0.5)", borderRadius: 20, padding: "3px 10px",
                      fontSize: "0.65rem", cursor: "pointer", fontFamily: "monospace",
                    }}>
                      {url.replace("https://", "")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB CONTROL ───────────────────────────────────────────── */}
        {activeTab === "tab" && (
          <div style={{ animation: "brow-up 0.2s ease both", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Quick Open Tab */}
            <div style={{
              background: "rgba(4,8,18,0.7)", border: "1px solid rgba(34,197,94,0.15)",
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#22c55e", marginBottom: 10 }}>🗂 Buka Tab Baru</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["chrome", "firefox", "default"].map(b => (
                  <div key={b} style={{ display: "flex", gap: 6, flex: "1 1 200px" }}>
                    <input
                      placeholder={`URL untuk ${b}…`}
                      onKeyDown={e => e.key === "Enter" && openTabFn((e.target as HTMLInputElement).value, b)}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7,
                        padding: "6px 10px", color: "#e2e8f0", fontSize: "0.76rem",
                        fontFamily: "monospace", outline: "none",
                      }}
                    />
                    <button onClick={e => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      openTabFn(input.value, b);
                      input.value = "";
                    }} style={{
                      background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                      color: "#22c55e", borderRadius: 7, padding: "6px 10px",
                      fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
                      textTransform: "capitalize", fontWeight: 600,
                    }}>{b} ▶</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Close Tab */}
            <div style={{
              background: "rgba(4,8,18,0.7)", border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f87171", marginBottom: 10 }}>❌ Tutup Tab</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={closeTarget} onChange={e => setCloseTarget(e.target.value)}
                  placeholder="Domain, e.g.: youtube.com"
                  onKeyDown={e => e.key === "Enter" && closeTabFn()}
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(239,68,68,0.15)", borderRadius: 7,
                    padding: "7px 12px", color: "#e2e8f0", fontSize: "0.78rem",
                    fontFamily: "monospace", outline: "none",
                  }}
                />
                <button onClick={closeTabFn} disabled={closing || !closeTarget.trim()} style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171", borderRadius: 7, padding: "7px 14px",
                  fontSize: "0.78rem", fontWeight: 700, cursor: (closing || !closeTarget.trim()) ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: (!closeTarget.trim()) ? 0.5 : 1,
                }}>
                  {closing ? "Menutup…" : "🔴 Tutup"}
                </button>
              </div>
              <p style={{ fontSize: "0.62rem", color: "rgba(226,232,240,0.2)", marginTop: 6 }}>
                Menutup semua tab browser yang cocok dengan domain tersebut
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
