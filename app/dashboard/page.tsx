"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getApiBase, getToken, clearCredentials, ping } from "@/lib/api";

// Tab imports
import DashboardHome from "@/components/tabs/DashboardHome";
import ControlTab from "@/components/tabs/ControlTab";
import FilesTab from "@/components/tabs/FilesTab";
import TerminalTab from "@/components/tabs/TerminalTab";
import AIChat from "@/components/tabs/AIChat";
import CctvTab from "@/components/tabs/CctvTab";
import KeyloggerTab from "@/components/tabs/KeyloggerTab";
import PrankTab from "@/components/tabs/PrankTab";
import ConfigTab from "@/components/tabs/ConfigTab";
import LogsTab from "@/components/tabs/LogsTab";

const NAV_ITEMS = [
  { id: "home",       icon: "🏠", label: "Dashboard",   component: DashboardHome },
  { id: "control",   icon: "🎮", label: "Control",     component: ControlTab },
  { id: "terminal",  icon: "💻", label: "Shell",       component: TerminalTab },
  { id: "files",     icon: "📁", label: "Files",       component: FilesTab },
  { id: "ai",        icon: "🧠", label: "AI Chat",     component: AIChat },
  { id: "cctv",      icon: "📹", label: "CCTV / Share",component: CctvTab },
  { id: "keylogger", icon: "⌨️", label: "Keylogger",   component: KeyloggerTab },
  { id: "prank",     icon: "🎭", label: "Prank",       component: PrankTab },
  { id: "config",    icon: "⚙️", label: "Config",      component: ConfigTab },
  { id: "logs",      icon: "📋", label: "Logs",        component: LogsTab },
];

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("home");
  const [online, setOnline] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [windowWidth, setWindowWidth] = useState(0);

  // Auth check & window initialization
  useEffect(() => {
    const base = getApiBase();
    const token = getToken();
    if (!base || !token) {
      router.replace("/");
    }
    
    // Set initial window width
    setWindowWidth(window.innerWidth);
    
    // Auto-close sidebar on small screens
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Ping for status
  const checkOnline = useCallback(async () => {
    try {
      await ping();
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    checkOnline();
    const iv = setInterval(checkOnline, 15000);
    return () => clearInterval(iv);
  }, [checkOnline]);

  const handleLogout = () => {
    clearCredentials();
    router.replace("/");
  };

  const ActiveComponent = NAV_ITEMS.find(n => n.id === activeTab)?.component || DashboardHome;

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", 
            backdropFilter: "blur(4px)", zIndex: 90,
          }} 
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : (windowWidth < 768 ? 0 : 70),
        minHeight: "100vh",
        background: "rgba(10,15,30,0.98)",
        borderRight: "1px solid rgba(0,212,255,0.15)",
        display: "flex", flexDirection: "column",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        flexShrink: 0,
        position: windowWidth < 768 ? "fixed" : "sticky", 
        top: 0, height: "100vh",
        left: windowWidth < 768 && !mobileMenuOpen ? -240 : 0,
        zIndex: 100,
        backdropFilter: "blur(20px)",
        overflowY: "auto", overflowX: "hidden",
        boxShadow: mobileMenuOpen ? "10px 0 30px rgba(0,0,0,0.5)" : "none"
      }}>
        {/* Logo */}
        <div style={{
          padding: "24px 20px", borderBottom: "1px solid rgba(0,212,255,0.1)",
          display: "flex", alignItems: "center", gap: 12
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(0,212,255,0.4), rgba(124,58,237,0.4))",
            border: "1px solid rgba(0,212,255,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
            boxShadow: "0 0 15px rgba(0,212,255,0.2)"
          }}>🤖</div>
          {(sidebarOpen || (windowWidth < 768 && mobileMenuOpen)) && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#00d4ff", letterSpacing: "0.15em", textShadow: "0 0 10px rgba(0,212,255,0.3)" }}>JARVIS</div>
              <div style={{ fontSize: "0.6rem", color: "rgba(226,232,240,0.4)", letterSpacing: "0.15em", fontWeight: 600 }}>SYSTEM CONTROL</div>
            </div>
          )}
        </div>

        {/* Status */}
        {(sidebarOpen || (windowWidth < 768 && mobileMenuOpen)) && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,212,255,0.07)", background: "rgba(0,212,255,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: online === null ? "#f59e0b" : online ? "#10b981" : "#ef4444",
                boxShadow: `0 0 8px ${online === null ? "#f59e0b" : online ? "#10b981" : "#ef4444"}`,
                animation: online ? "pulse 2s infinite" : "none"
              }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: online ? "#10b981" : online === false ? "#ef4444" : "#f59e0b" }}>
                {online === null ? "Initializing..." : online ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => {
                setActiveTab(item.id);
                if (windowWidth < 768) setMobileMenuOpen(false);
              }}
              style={{ 
                width: "100%", border: "none", background: "none", textAlign: "left",
                padding: "10px 14px", borderRadius: 10, display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", transition: "all 0.2s ease"
              }}
              title={!sidebarOpen && windowWidth >= 768 ? item.label : undefined}
            >
              <span style={{ fontSize: "1.2rem", flexShrink: 0, width: 24, textAlign: "center" }}>{item.icon}</span>
              {(sidebarOpen || (windowWidth < 768 && mobileMenuOpen)) && (
                <span style={{ fontSize: "0.9rem", fontWeight: activeTab === item.id ? 600 : 400 }}>{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(0,212,255,0.07)", display: "flex", flexDirection: "column", gap: 4 }}>
          {windowWidth >= 768 && (
            <button
              className="nav-item"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ width: "100%", border: "none", background: "none", textAlign: "left", padding: "10px 14px", borderRadius: 10 }}
            >
              <span>{sidebarOpen ? "◀" : "▶"}</span>
              {sidebarOpen && <span style={{ marginLeft: 12 }}>Collapse</span>}
            </button>
          )}
          <button
            id="logout-btn"
            className="nav-item"
            onClick={handleLogout}
            style={{ 
              width: "100%", border: "none", background: "none", textAlign: "left", 
              color: "#ef4444", padding: "10px 14px", borderRadius: 10 
            }}
          >
            <span>🚪</span>
            {(sidebarOpen || (windowWidth < 768 && mobileMenuOpen)) && <span style={{ marginLeft: 12 }}>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "var(--jarvis-bg)" }}>
        {/* Header */}
        <header style={{
          padding: "16px 24px",
          borderBottom: "1px solid rgba(0,212,255,0.12)",
          background: "rgba(10,15,30,0.85)",
          backdropFilter: "blur(15px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 80
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {windowWidth < 768 && (
              <button 
                onClick={() => setMobileMenuOpen(true)}
                style={{ 
                  background: "none", border: "none", color: "#00d4ff", fontSize: "1.5rem", 
                  cursor: "pointer", display: "flex", alignItems: "center" 
                }}
              >
                ☰
              </button>
            )}
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.3rem" }}>{NAV_ITEMS.find(n => n.id === activeTab)?.icon}</span>
              <span style={{ display: windowWidth < 480 ? "none" : "inline" }}>{NAV_ITEMS.find(n => n.id === activeTab)?.label}</span>
            </h1>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ 
              display: "flex", alignItems: "center", gap: 8, 
              padding: "6px 12px", borderRadius: 20, 
              background: online ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${online ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: online ? "#10b981" : "#ef4444"
              }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: online ? "#10b981" : "#ef4444" }}>
                {online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <span style={{ 
              fontSize: "0.8rem", color: "rgba(226,232,240,0.5)", 
              fontFamily: "monospace", background: "rgba(0,0,0,0.3)", 
              padding: "4px 10px", borderRadius: 6,
              display: windowWidth < 640 ? "none" : "block"
            }}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <div style={{ 
          flex: 1, 
          padding: windowWidth < 640 ? "16px" : "24px", 
          overflowY: "auto", overflowX: "hidden",
          maxWidth: "100%"
        }} className="fade-in" key={activeTab}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <ActiveComponent />
          </div>
        </div>
      </main>
    </div>
  );
}
