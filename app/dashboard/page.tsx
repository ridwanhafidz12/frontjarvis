"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { getApiBase, getToken, clearCredentials, ping, logout } from "@/lib/api";

import DashboardHome from "@/components/tabs/DashboardHome";
import ControlTab    from "@/components/tabs/ControlTab";
import FilesTab      from "@/components/tabs/FilesTab";
import TerminalTab   from "@/components/tabs/TerminalTab";
import AIChat        from "@/components/tabs/AIChat";
import CctvTab       from "@/components/tabs/CctvTab";
import KeyloggerTab  from "@/components/tabs/KeyloggerTab";
import PrankTab      from "@/components/tabs/PrankTab";
import ConfigTab     from "@/components/tabs/ConfigTab";
import LogsTab       from "@/components/tabs/LogsTab";
import VaultTab      from "@/components/tabs/VaultTab";
import ProcessTab    from "@/components/tabs/ProcessTab";
import VoiceTab      from "@/components/tabs/VoiceTab";
import BrowserTab    from "@/components/tabs/BrowserTab";
import AppsTab       from "@/components/tabs/AppsTab";
import StartupTab    from "@/components/tabs/StartupTab";
import ClipboardTab  from "@/components/tabs/ClipboardTab";

// ── Types ──────────────────────────────────────────────────────────────────

type TabId =
  | "home" | "control" | "terminal" | "files"
  | "ai" | "voice" | "browser" | "cctv" | "keylogger" | "prank"
  | "config" | "logs" | "vault" | "processes"
  | "apps" | "startup" | "clipboard";

interface NavItem {
  id:        TabId;
  icon:      string;
  label:     string;
  component: React.ComponentType;
  pinMobile?: boolean;   // show in bottom nav on mobile
}

// ── Nav items ──────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: "home",      icon: "🏠", label: "Dashboard",  component: DashboardHome, pinMobile: true },
  { id: "control",   icon: "🎮", label: "Control",    component: ControlTab,    pinMobile: true },
  { id: "terminal",  icon: "💻", label: "Shell",      component: TerminalTab,   pinMobile: true },
  { id: "files",     icon: "📁", label: "Files",      component: FilesTab,      pinMobile: true },
  { id: "ai",        icon: "🧠", label: "AI Chat",    component: AIChat,        pinMobile: true },
  { id: "voice",     icon: "🎙️", label: "Voice AI",   component: VoiceTab,      pinMobile: false },
  { id: "browser",   icon: "🌐", label: "Browser",    component: BrowserTab,    pinMobile: false },
  { id: "cctv",      icon: "📹", label: "CCTV",       component: CctvTab   },
  { id: "processes", icon: "⚙️", label: "Processes",  component: ProcessTab },
  { id: "apps",      icon: "🖥️", label: "Apps",       component: AppsTab },
  { id: "startup",   icon: "🚀", label: "Startup",    component: StartupTab },
  { id: "clipboard", icon: "📋", label: "Clipboard",  component: ClipboardTab },
  { id: "keylogger", icon: "⌨️", label: "Keylogger",  component: KeyloggerTab  },
  { id: "prank",     icon: "🎭", label: "Prank",      component: PrankTab  },
  { id: "config",    icon: "🔧", label: "Config",     component: ConfigTab },
  { id: "logs",      icon: "📝", label: "Logs",       component: LogsTab   },
  { id: "vault",     icon: "🔐", label: "Vault",      component: VaultTab  },
];

// Mobile bottom nav shows first 5 pinned items
const MOBILE_NAV = NAV_ITEMS.filter(n => n.pinMobile);

// ── Hooks ──────────────────────────────────────────────────────────────────

function useWindowWidth() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const update = () => setW(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return w;
}

// ── Status dot ─────────────────────────────────────────────────────────────

function StatusDot({ online }: { online: boolean | null }) {
  const color =
    online === null ? "#f59e0b" :
    online          ? "#10b981" : "#ef4444";
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
      {online && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: color, opacity: 0.3,
          animation: "dash-ping 2s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}
    </span>
  );
}

// ── Sidebar Nav Button ─────────────────────────────────────────────────────

function NavButton({ item, active, collapsed, onClick }: {
  item: NavItem; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      style={{
        width: "100%", border: "none", textAlign: "left",
        padding: collapsed ? "10px 0" : "10px 14px",
        borderRadius: 10,
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: collapsed ? 0 : 12,
        cursor: "pointer",
        transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
        background: active
          ? "rgba(0,212,255,0.1)"
          : hov ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? "#00d4ff" : hov ? "rgba(226,232,240,0.85)" : "rgba(226,232,240,0.55)",
        borderLeft: active ? "2px solid #00d4ff" : "2px solid transparent",
        fontFamily: "inherit",
        minHeight: 40,
      }}
    >
      <span style={{ fontSize: "1.1rem", flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
      {!collapsed && (
        <span style={{
          fontSize: "0.86rem", fontWeight: active ? 600 : 400,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          animation: "dash-fadein 0.2s ease both",
        }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

// ── Mobile Bottom Nav Button ────────────────────────────────────────────────

function MobileNavBtn({ item, active, onClick }: {
  item: NavItem; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, border: "none", background: "none",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 3, padding: "8px 4px",
        cursor: "pointer", fontFamily: "inherit",
        color: active ? "#00d4ff" : "rgba(226,232,240,0.45)",
        transition: "color 0.15s",
        minHeight: 56,
      }}
      aria-current={active ? "page" : undefined}
    >
      <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>{item.icon}</span>
      <span style={{ fontSize: "0.58rem", fontWeight: active ? 700 : 400, letterSpacing: "0.02em" }}>
        {item.label}
      </span>
      {active && (
        <span style={{
          position: "absolute", bottom: 0, width: 20, height: 2,
          background: "#00d4ff", borderRadius: 1,
        }} />
      )}
    </button>
  );
}

// ── Toast notification ─────────────────────────────────────────────────────

function ToastContainer({ toasts }: { toasts: { id: number; msg: string; type: "success"|"error"|"info" }[] }) {
  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16, zIndex: 9900,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none", maxWidth: 360,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          pointerEvents: "auto",
          background: t.type === "error" ? "rgba(239,68,68,0.15)" : t.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(0,212,255,0.1)",
          border: `1px solid ${t.type === "error" ? "rgba(239,68,68,0.3)" : t.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(0,212,255,0.2)"}`,
          color: t.type === "error" ? "#fca5a5" : t.type === "success" ? "#6ee7b7" : "#7dd3fc",
          borderRadius: 10, padding: "10px 16px",
          fontSize: "0.83rem", fontWeight: 600,
          backdropFilter: "blur(16px)",
          animation: "dash-up 0.25s ease both",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router  = useRouter();
  const winW    = useWindowWidth();

  const isMobile = winW > 0 && winW < 768;
  const isTablet = winW >= 768 && winW < 1024;

  const [activeTab,    setActiveTab]    = useState<TabId>("home");
  const [online,       setOnline]       = useState<boolean | null>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [time,         setTime]         = useState(new Date());
  const [toasts,       setToasts]       = useState<{ id: number; msg: string; type: "success"|"error"|"info" }[]>([]);
  const toastCounter = useRef(0);

  // More nav items in sidebar drawer (mobile)
  const [drawerPage, setDrawerPage] = useState<"more" | null>(null);

  const collapsed = !isMobile && !isTablet && !sidebarOpen;

  const showToast = useCallback((msg: string, type: "success"|"error"|"info" = "info") => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!getApiBase() || !getToken()) router.replace("/");
  }, [router]);

  // Responsive sidebar
  useEffect(() => {
    if (winW === 0) return;
    if (winW < 1024) {
      setSidebarOpen(false);
      setMobileDrawer(false);
    } else {
      setSidebarOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winW < 1024]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Ping
  const checkOnline = useCallback(async () => {
    try { await ping(); setOnline(true); }
    catch { setOnline(false); }
  }, []);

  useEffect(() => {
    checkOnline();
    const iv = setInterval(checkOnline, 15_000);
    return () => clearInterval(iv);
  }, [checkOnline]);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    clearCredentials();
    router.replace("/");
  };

  const ActiveComponent = useMemo(
    () => NAV_ITEMS.find(n => n.id === activeTab)?.component ?? DashboardHome,
    [activeTab],
  );

  const activeItem = NAV_ITEMS.find(n => n.id === activeTab)!;

  const handleNav = (id: TabId) => {
    setActiveTab(id);
    setMobileDrawer(false);
    setDrawerPage(null);
  };

  const sidebarW = collapsed ? 64 : 240;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes dash-ping   { 75%,100%{transform:scale(2.5);opacity:0;} }
        @keyframes dash-fadein { from{opacity:0;transform:translateX(-5px);}to{opacity:1;transform:none;} }
        @keyframes dash-up     { from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;} }
        @keyframes dash-content{ from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        @keyframes dash-spin   { to{transform:rotate(360deg);} }
      `}</style>

      {/* Toasts */}
      <ToastContainer toasts={toasts} />

      {/* Root wrapper */}
      <div style={{
        display: "flex", minHeight: "100vh",
        background: "#02040a",
        color: "#e2e8f0",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        position: "relative",
      }}>

        {/* Backdrop (mobile overlay) */}
        {mobileDrawer && (isMobile || isTablet) && (
          <div
            onClick={() => setMobileDrawer(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 120,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
            }}
          />
        )}

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <aside style={{
          ...(isMobile || isTablet ? {
            position:   "fixed" as const,
            top:        0, left: 0,
            height:     "100vh",
            width:      280,
            zIndex:     130,
            transform:  mobileDrawer ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
            boxShadow:  mobileDrawer ? "4px 0 40px rgba(0,0,0,0.8)" : "none",
          } : {
            position:   "sticky" as const,
            top:        0,
            height:     "100vh",
            width:      sidebarW,
            transition: "width 0.28s cubic-bezier(.4,0,.2,1)",
          }),
          flexShrink:    0,
          display:       "flex",
          flexDirection: "column",
          background:    "rgba(5, 9, 20, 0.97)",
          borderRight:   "1px solid rgba(0,212,255,0.1)",
          backdropFilter: "blur(24px)",
          overflowX:     "hidden",
          overflowY:     "auto",
        }}>

          {/* Logo & Close */}
          <div style={{
            padding: collapsed ? "18px 0" : "18px 16px",
            borderBottom: "1px solid rgba(0,212,255,0.08)",
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            gap: 12, flexShrink: 0,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              justifyContent: collapsed ? "center" : "flex-start",
              flex: 1,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "10px", flexShrink: 0,
                background: "linear-gradient(135deg,rgba(0,212,255,0.3),rgba(124,58,237,0.3))",
                border: "1px solid rgba(0,212,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, boxShadow: "0 0 16px rgba(0,212,255,0.15)",
              }}>
                🤖
              </div>
              {!collapsed && (
                <div style={{ animation: "dash-fadein 0.2s ease both" }}>
                  <div style={{
                    fontSize: "1rem", fontWeight: 900, color: "#00d4ff",
                    letterSpacing: "0.2em", fontFamily: "'Outfit', 'Inter', sans-serif",
                  }}>
                    JARVIS
                  </div>
                  <div style={{
                    fontSize: "0.55rem", color: "rgba(226,232,240,0.3)",
                    letterSpacing: "0.2em", textTransform: "uppercase",
                  }}>
                    Control System
                  </div>
                </div>
              )}
            </div>
            {(isMobile || isTablet) && mobileDrawer && (
              <button
                onClick={() => setMobileDrawer(false)}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "50%", width: 30, height: 30, color: "#e2e8f0",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: "0.85rem",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Status bar */}
          {!collapsed && (
            <div style={{
              padding: "10px 16px", flexShrink: 0,
              borderBottom: "1px solid rgba(0,212,255,0.05)",
              background: "rgba(0,212,255,0.015)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <StatusDot online={online} />
              <span style={{
                fontSize: "0.75rem", fontWeight: 500,
                color: online === null ? "#f59e0b" : online ? "#10b981" : "#ef4444",
              }}>
                {online === null ? "Initializing…" : online ? "Connected" : "Disconnected"}
              </span>
              <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "rgba(226,232,240,0.25)", fontFamily: "monospace" }}>
                {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}

          {/* Nav */}
          <nav
            style={{
              flex: 1,
              padding: collapsed ? "10px 8px" : "10px 8px",
              display: "flex", flexDirection: "column", gap: 2,
              overflowY: "auto",
            }}
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map(item => (
              <NavButton
                key={item.id}
                item={item}
                active={activeTab === item.id}
                collapsed={collapsed}
                onClick={() => handleNav(item.id)}
              />
            ))}
          </nav>

          {/* Footer */}
          <div style={{
            padding: collapsed ? "10px 8px" : "10px 8px",
            borderTop: "1px solid rgba(0,212,255,0.06)",
            display: "flex", flexDirection: "column", gap: 2, flexShrink: 0,
          }}>
            {/* Collapse toggle — desktop only */}
            {!isMobile && !isTablet && (
              <button
                onClick={() => setSidebarOpen(v => !v)}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                style={{
                  width: "100%", border: "none", textAlign: "left",
                  padding: collapsed ? "9px 0" : "9px 14px",
                  borderRadius: 8,
                  display: "flex", alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: collapsed ? 0 : 10,
                  cursor: "pointer",
                  background: "transparent",
                  color: "rgba(226,232,240,0.3)",
                  fontFamily: "inherit", fontSize: "0.8rem",
                  minHeight: 36,
                }}
              >
                <span style={{ fontSize: "0.85rem" }}>{collapsed ? "▶" : "◀"}</span>
                {!collapsed && (
                  <span style={{ animation: "dash-fadein 0.2s ease both" }}>Collapse</span>
                )}
              </button>
            )}

            {/* HUD Mode button */}
            <button
              onClick={() => router.push("/hud")}
              title={collapsed ? "JARVIS HUD" : undefined}
              style={{
                width: "100%", textAlign: "left",
                padding: collapsed ? "9px 0" : "9px 14px",
                borderRadius: 8,
                display: "flex", alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 10,
                cursor: "pointer",
                background: "rgba(0,212,255,0.06)",
                border: "1px solid rgba(0,212,255,0.15)",
                color: "#00d4ff",
                fontFamily: "inherit", fontSize: "0.85rem",
                minHeight: 40,
                transition: "all 0.15s",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: "1rem" }}>🎙</span>
              {!collapsed && (
                <span style={{ fontWeight: 600, animation: "dash-fadein 0.2s ease both", letterSpacing: "0.05em" }}>
                  VOICE HUD
                </span>
              )}
            </button>

            {/* Hive Mind button */}
            <button
              onClick={() => router.push("/hive")}
              title={collapsed ? "Hive Mind" : undefined}
              style={{
                width: "100%", textAlign: "left",
                padding: collapsed ? "9px 0" : "9px 14px",
                borderRadius: 8,
                display: "flex", alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 10,
                cursor: "pointer",
                background: "rgba(124,58,237,0.06)",
                border: "1px solid rgba(124,58,237,0.15)",
                color: "#a78bfa",
                fontFamily: "inherit", fontSize: "0.85rem",
                minHeight: 40,
                transition: "all 0.15s",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: "1rem" }}>🌐</span>
              {!collapsed && (
                <span style={{ fontWeight: 600, animation: "dash-fadein 0.2s ease both", letterSpacing: "0.05em" }}>
                  HIVE MIND
                </span>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title={collapsed ? "Logout" : undefined}
              style={{
                width: "100%", border: "none", textAlign: "left",
                padding: collapsed ? "9px 0" : "9px 14px",
                borderRadius: 8,
                display: "flex", alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 10,
                cursor: "pointer",
                background: "transparent",
                color: "#ef4444",
                fontFamily: "inherit", fontSize: "0.85rem",
                minHeight: 40,
                transition: "background 0.15s",
              }}
            >
              <span style={{ fontSize: "1rem" }}>🚪</span>
              {!collapsed && (
                <span style={{ fontWeight: 500, animation: "dash-fadein 0.2s ease both" }}>Logout</span>
              )}
            </button>
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────── */}
        <main style={{
          flex: 1, display: "flex", flexDirection: "column",
          minWidth: 0,
          minHeight: "100vh",
          // On mobile: allow height for bottom nav
          paddingBottom: isMobile ? 60 : 0,
        }}>

          {/* Header */}
          <header style={{
            padding: isMobile ? "0 12px" : "0 20px",
            height: isMobile ? 50 : 56,
            flexShrink: 0,
            borderBottom: "1px solid rgba(0,212,255,0.08)",
            background: "rgba(5, 9, 20, 0.9)",
            backdropFilter: "blur(20px)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "sticky", top: 0, zIndex: 80, gap: 10,
          }}>

            {/* Left: hamburger + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {/* Hamburger (mobile + tablet) */}
              {winW > 0 && winW < 1024 && (
                <button
                  onClick={() => setMobileDrawer(v => !v)}
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileDrawer}
                  style={{
                    background: "rgba(0,212,255,0.07)",
                    border: "1px solid rgba(0,212,255,0.18)",
                    borderRadius: 8, color: "#00d4ff", fontSize: "1.1rem",
                    cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 34, height: 34, padding: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {mobileDrawer ? "✕" : "☰"}
                </button>
              )}
              <h1 style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: isMobile ? "0.88rem" : "0.95rem",
                fontWeight: 700, color: "#e2e8f0",
                margin: 0, minWidth: 0,
              }}>
                <span style={{ fontSize: isMobile ? "1.05rem" : "1.15rem", flexShrink: 0 }}>
                  {activeItem.icon}
                </span>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeItem.label}
                </span>
              </h1>
            </div>

            {/* Right: status + time */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: isMobile ? "3px 7px" : "4px 10px",
                borderRadius: 20,
                background: online === null
                  ? "rgba(245,158,11,0.08)"
                  : online ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${online === null ? "rgba(245,158,11,0.2)" : online ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>
                <StatusDot online={online} />
                <span style={{
                  fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.06em",
                  color: online === null ? "#f59e0b" : online ? "#10b981" : "#ef4444",
                  display: winW < 360 ? "none" : "inline",
                }}>
                  {online === null ? "INIT" : online ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              {winW >= 640 && (
                <span style={{
                  fontSize: "0.75rem", color: "rgba(226,232,240,0.4)",
                  fontFamily: "'JetBrains Mono', monospace",
                  background: "rgba(0,0,0,0.25)", padding: "3px 9px", borderRadius: 6,
                }}>
                  {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
          </header>

          {/* Content */}
          <div style={{
            flex: 1,
            padding: isMobile ? "14px" : winW < 1024 ? "18px" : "24px",
            overflowY: "auto", overflowX: "hidden",
          }}>
            <div
              key={activeTab}
              style={{
                maxWidth: 1400, margin: "0 auto",
                animation: "dash-content 0.28s ease both",
              }}
            >
              <ActiveComponent />
            </div>
          </div>
        </main>

        {/* ── Mobile bottom navigation ─────────────────────────────── */}
        {isMobile && (
          <nav
            aria-label="Bottom navigation"
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0,
              height: 60, zIndex: 100,
              background: "rgba(5, 9, 20, 0.97)",
              borderTop: "1px solid rgba(0,212,255,0.1)",
              backdropFilter: "blur(20px)",
              display: "flex", alignItems: "center",
            }}
          >
            {MOBILE_NAV.map(item => (
              <MobileNavBtn
                key={item.id}
                item={item}
                active={activeTab === item.id}
                onClick={() => handleNav(item.id)}
              />
            ))}
            {/* "More" button */}
            <button
              onClick={() => setMobileDrawer(v => !v)}
              style={{
                flex: 1, border: "none", background: "none",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3, padding: "8px 4px",
                cursor: "pointer", fontFamily: "inherit",
                color: mobileDrawer ? "#00d4ff" : "rgba(226,232,240,0.45)",
                minHeight: 56,
              }}
            >
              <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>⋯</span>
              <span style={{ fontSize: "0.58rem", fontWeight: 400 }}>More</span>
            </button>
          </nav>
        )}
      </div>
    </>
  );
}