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
  const [time, setTime] = useState(new Date());

  // Auth check
  useEffect(() => {
    const base = getApiBase();
    const token = getToken();
    if (!base || !token) {
      router.replace("/");
    }
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
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 220 : 60,
        minHeight: "100vh",
        background: "rgba(10,15,30,0.95)",
        borderRight: "1px solid rgba(0,212,255,0.1)",
        display: "flex", flexDirection: "column",
        transition: "width 0.3s ease",
        flexShrink: 0,
        position: "sticky", top: 0, height: "100vh",
        backdropFilter: "blur(20px)",
        overflowY: "auto", overflowX: "hidden"
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 16px", borderBottom: "1px solid rgba(0,212,255,0.1)",
          display: "flex", alignItems: "center", gap: 10
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(0,212,255,0.3), rgba(124,58,237,0.3))",
            border: "1px solid rgba(0,212,255,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0
          }}>🤖</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#00d4ff", letterSpacing: "0.1em" }}>JARVIS</div>
              <div style={{ fontSize: "0.6rem", color: "rgba(226,232,240,0.4)", letterSpacing: "0.1em" }}>AI CONTROL</div>
            </div>
          )}
        </div>

        {/* Status */}
        {sidebarOpen && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,212,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: online === null ? "#f59e0b" : online ? "#10b981" : "#ef4444",
                boxShadow: `0 0 6px ${online === null ? "#f59e0b" : online ? "#10b981" : "#ef4444"}`
              }} className="pulse-dot" />
              <span style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.5)" }}>
                {online === null ? "Checking..." : online ? "System Online" : "⚠️ Offline"}
              </span>
            </div>
            <div style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.3)", marginTop: 4 }}>
              {time.toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
              style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span style={{ fontSize: "1rem", flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid rgba(0,212,255,0.07)", display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            className="nav-item"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
            title="Toggle sidebar"
          >
            <span>{sidebarOpen ? "◀" : "▶"}</span>
            {sidebarOpen && <span>Collapse</span>}
          </button>
          <button
            id="logout-btn"
            className="nav-item"
            onClick={handleLogout}
            style={{ width: "100%", border: "none", background: "none", textAlign: "left", color: "rgba(239,68,68,0.7)" }}
          >
            <span>🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header style={{
          padding: "14px 24px",
          borderBottom: "1px solid rgba(0,212,255,0.1)",
          background: "rgba(10,15,30,0.8)",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0" }}>
              {NAV_ITEMS.find(n => n.id === activeTab)?.icon}{" "}
              {NAV_ITEMS.find(n => n.id === activeTab)?.label}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={`badge ${online ? "badge-online" : "badge-offline"}`}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: online ? "#10b981" : "#ef4444"
              }} />
              {online ? "Online" : "Offline"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", fontFamily: "monospace" }}>
              {time.toLocaleTimeString()}
            </span>
          </div>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: 24, overflow: "auto" }} className="fade-in" key={activeTab}>
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
