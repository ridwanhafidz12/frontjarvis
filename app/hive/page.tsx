"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getApiBase, getToken,
  hiveFleet, hiveStatus, hiveSendCommand, hiveAskAI, hiveGetResult, hiveUpdateConfig,
  getAIAgents, switchAIAgent,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HiveNode {
  node_id:     string;
  node_name:   string;
  hostname:    string;
  os:          string;
  ip_local:    string;
  tunnel_url:  string;
  api_port:    number;
  status:      "online" | "offline";
  cpu_pct:     number;
  ram_pct:     number;
  battery_pct: number | null;
  disk_pct:    number;
  version:     string;
  last_seen:   string;
  is_self:     boolean;
}

interface AIAgent {
  name:   string;
  model:  string;
  active: boolean;
  role:   string;
  speed:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeSince(isoStr: string): string {
  if (!isoStr) return "?";
  try {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 5)   return "just now";
    if (diff < 60)  return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  } catch { return "?"; }
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.min(pct, 100)}%`,
        background: color, borderRadius: 2, transition: "width 0.5s ease",
        boxShadow: `0 0 4px ${color}80`,
      }} />
    </div>
  );
}

// ── NodeCard ──────────────────────────────────────────────────────────────────
function NodeCard({
  node, selected, onSelect, onCommand, selfId,
}: {
  node: HiveNode; selected: boolean; selfId: string;
  onSelect: (id: string) => void;
  onCommand: (nodeId: string, action: string) => void;
}) {
  const [hov, setHov] = useState(false);
  const online = node.status === "online";

  return (
    <div
      onClick={() => onSelect(node.node_id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 14,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.2s",
        background: selected
          ? "rgba(0,212,255,0.08)"
          : hov ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
        border: selected
          ? "1px solid rgba(0,212,255,0.4)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: selected ? "0 0 20px rgba(0,212,255,0.1)" : "none",
        position: "relative",
        userSelect: "none",
      }}
    >
      {/* Self badge */}
      {node.is_self && (
        <div style={{
          position: "absolute", top: 10, right: 12,
          fontSize: "0.52rem", padding: "2px 6px",
          background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: 4, color: "#10b981", letterSpacing: "0.1em",
        }}>
          THIS PC
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: online ? "#10b981" : "#ef4444",
          boxShadow: online ? "0 0 8px #10b981" : "0 0 6px #ef4444",
          animation: online ? "hive-pulse 2s infinite" : "none",
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "0.85rem", fontWeight: 700,
            color: selected ? "#00d4ff" : "#e2e8f0",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {node.node_name || node.hostname}
          </div>
          <div style={{ fontSize: "0.6rem", color: "rgba(226,232,240,0.3)", letterSpacing: "0.08em" }}>
            {node.hostname} · {node.os.slice(0, 20)}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {online && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
          {[
            { label: "CPU", val: node.cpu_pct, color: "#00d4ff" },
            { label: "RAM", val: node.ram_pct, color: "#7c3aed" },
            { label: "DSK", val: node.disk_pct, color: "#10b981" },
          ].map(m => (
            <div key={m.label}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "0.58rem", color: "rgba(226,232,240,0.4)",
                marginBottom: 2,
              }}>
                <span>{m.label}</span>
                <span style={{ color: m.color }}>{m.val.toFixed(0)}%</span>
              </div>
              <MiniBar pct={m.val} color={m.color} />
            </div>
          ))}
          {node.battery_pct != null && (
            <div style={{
              fontSize: "0.58rem", color: "rgba(226,232,240,0.35)",
              marginTop: 2,
            }}>
              🔋 {node.battery_pct.toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {/* IP + last seen */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "0.58rem", color: "rgba(226,232,240,0.25)",
        letterSpacing: "0.05em",
      }}>
        <span>{node.ip_local || "—"}</span>
        <span>{timeSince(node.last_seen)}</span>
      </div>

      {/* Quick control buttons (visible on hover/select and online) */}
      {(hov || selected) && online && !node.is_self && (
        <div style={{
          display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap",
        }}>
          {[
            { icon: "📸", action: "screenshot", title: "Screenshot" },
            { icon: "🔒", action: "lock",       title: "Lock" },
            { icon: "📊", action: "status",     title: "Status" },
          ].map(btn => (
            <button
              key={btn.action}
              onClick={e => { e.stopPropagation(); onCommand(node.node_id, btn.action); }}
              title={btn.title}
              style={{
                background: "rgba(0,212,255,0.07)",
                border: "1px solid rgba(0,212,255,0.18)",
                borderRadius: 6, padding: "3px 8px",
                color: "#00d4ff", fontSize: "0.7rem",
                cursor: "pointer",
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HivePage() {
  const router = useRouter();

  const [checking,     setChecking]     = useState(true);
  const [authed,       setAuthed]       = useState(false);
  const [fleet,        setFleet]        = useState<HiveNode[]>([]);
  const [selfNodeId,   setSelfNodeId]   = useState("");
  const [hiveEnabled,  setHiveEnabled]  = useState(false);
  const [hiveReady,    setHiveReady]    = useState(false);
  const [selectedNode, setSelectedNode] = useState<string>("");
  const [aiAgents,     setAiAgents]     = useState<Record<string, AIAgent>>({});
  const [primaryAgent, setPrimaryAgent] = useState("groq");

  // Command panel
  const [cmdLoading,   setCmdLoading]   = useState(false);
  const [cmdResult,    setCmdResult]    = useState<string>("");
  const [cmdAction,    setCmdAction]    = useState("screenshot");
  const [cmdTarget,    setCmdTarget]    = useState<"node" | "all" | "others">("node");

  // AI Ask panel
  const [askQuestion,  setAskQuestion]  = useState("");
  const [askResult,    setAskResult]    = useState<string>("");
  const [askLoading,   setAskLoading]   = useState(false);
  const [pendingCmdId, setPendingCmdId] = useState<string | null>(null);

  // Config panel
  const [showConfig,   setShowConfig]   = useState(false);
  const [cfgName,      setCfgName]      = useState("");
  const [cfgUrl,       setCfgUrl]       = useState("");
  const [cfgKey,       setCfgKey]       = useState("");
  const [cfgSaving,    setCfgSaving]    = useState(false);

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!getApiBase() || !getToken()) {
      router.replace("/");
      return;
    }
    setAuthed(true);
    setChecking(false);
  }, [router]);

  // ── Load fleet ──────────────────────────────────────────────────────────────
  const loadFleet = useCallback(async () => {
    try {
      const [fleetRes, statusRes] = await Promise.allSettled([
        hiveFleet(), hiveStatus(),
      ]);

      if (fleetRes.status === "fulfilled") {
        setFleet(fleetRes.value.nodes || []);
        setSelfNodeId(fleetRes.value.self_node_id || "");
        if (!selectedNode && fleetRes.value.self_node_id) {
          setSelectedNode(fleetRes.value.self_node_id);
        }
      }

      if (statusRes.status === "fulfilled") {
        setHiveEnabled(statusRes.value.enabled || false);
        setHiveReady(statusRes.value.ready || false);
        setSelfNodeId(statusRes.value.node_id || "");
      }
    } catch (err) {
      console.error("Load fleet error:", err);
    }
  }, [selectedNode]);

  // Load AI agents
  const loadAgents = useCallback(async () => {
    try {
      const res = await getAIAgents();
      setAiAgents(res.agents || {});
      setPrimaryAgent(res.primary || "groq");
    } catch {}
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadFleet();
    loadAgents();
    pollRef.current = setInterval(loadFleet, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [authed, loadFleet, loadAgents]);

  // ── Poll for pending command result ─────────────────────────────────────────
  useEffect(() => {
    if (!pendingCmdId) return;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await hiveGetResult(pendingCmdId);
        if (res?.status === "done") {
          clearInterval(poll);
          setPendingCmdId(null);
          try {
            const parsed = JSON.parse(res.result || "{}");
            setAskResult(parsed.answer || JSON.stringify(parsed, null, 2));
          } catch {
            setAskResult(res.result || "Done.");
          }
          setAskLoading(false);
        } else if (res?.status === "error" || attempts > 30) {
          clearInterval(poll);
          setPendingCmdId(null);
          setAskResult("⚠️ Timeout atau error saat menunggu respons.");
          setAskLoading(false);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [pendingCmdId]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleCommand = async (nodeId: string, action: string) => {
    const target = cmdTarget === "node" ? nodeId : cmdTarget;
    setCmdLoading(true);
    setCmdResult("");
    try {
      const res = await hiveSendCommand(target, action);
      setCmdResult(
        res.success
          ? `✅ Perintah "${action}" dikirim ke ${res.sent_to ?? 1} PC`
          : `⚠️ ${res.error || "Unknown error"}`
      );
    } catch (err: any) {
      setCmdResult(`❌ Error: ${err.message}`);
    } finally {
      setCmdLoading(false);
      setTimeout(() => setCmdResult(""), 4000);
    }
  };

  const handleBroadcast = async (action: string) => {
    setCmdLoading(true);
    setCmdResult("");
    try {
      const res = await hiveSendCommand("all", action, {});
      setCmdResult(`✅ "${action}" disiarkan ke ${res.sent_to} PC`);
    } catch (err: any) {
      setCmdResult(`❌ ${err.message}`);
    } finally {
      setCmdLoading(false);
      setTimeout(() => setCmdResult(""), 4000);
    }
  };

  const handleAskAI = async () => {
    if (!askQuestion.trim() || !selectedNode) return;
    setAskLoading(true);
    setAskResult("");
    try {
      const res = await hiveAskAI(selectedNode, askQuestion);
      if (res.direct) {
        setAskResult(res.answer || "");
        setAskLoading(false);
      } else if (res.cmd_id) {
        setPendingCmdId(res.cmd_id);
        setAskResult("⏳ Menunggu respons dari PC…");
      }
    } catch (err: any) {
      setAskResult(`❌ Error: ${err.message}`);
      setAskLoading(false);
    }
  };

  const handleSwitchAgent = async (agent: "groq" | "gemini" | "openrouter") => {
    try {
      await switchAIAgent(agent);
      setPrimaryAgent(agent);
    } catch {}
  };

  const handleSaveConfig = async () => {
    setCfgSaving(true);
    try {
      await hiveUpdateConfig({
        hive_pc_name: cfgName || undefined,
        supabase_url: cfgUrl || undefined,
        supabase_key: cfgKey || undefined,
      });
      setShowConfig(false);
      loadFleet();
    } catch {}
    setCfgSaving(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const onlineCount  = fleet.filter(n => n.status === "online").length;
  const selectedInfo = fleet.find(n => n.node_id === selectedNode);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#020812",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 16px",
            borderRadius: "50%", border: "2px solid rgba(0,212,255,0.15)",
            borderTopColor: "#00d4ff", animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ color: "rgba(0,212,255,0.4)", fontSize: "0.75rem", letterSpacing: "0.2em" }}>
            SCANNING FLEET…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#020812",
      display: "flex", flexDirection: "column",
      fontFamily: "'Outfit', 'Inter', monospace",
      color: "#e2e8f0",
    }}>
      <style>{`
        @keyframes hive-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.15)} }
        @keyframes spin        { to{transform:rotate(360deg)} }
        @keyframes fade-in     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes slide-right { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:none} }
        ::-webkit-scrollbar       { width:4px }
        ::-webkit-scrollbar-track { background:transparent }
        ::-webkit-scrollbar-thumb { background:rgba(0,212,255,0.15);border-radius:2px }
      `}</style>

      {/* ── Background effects */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }} />
      <div style={{
        position: "fixed", top: "-15%", right: "-10%",
        width: "60vw", height: "60vh",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* ── HEADER */}
      <header style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px",
        background: "rgba(2,8,18,0.95)",
        borderBottom: "1px solid rgba(0,212,255,0.1)",
        backdropFilter: "blur(16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => router.push("/hud")}
            style={{
              background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: 8, padding: "5px 12px", color: "rgba(0,212,255,0.6)",
              cursor: "pointer", fontSize: "0.7rem", letterSpacing: "0.1em",
            }}
          >
            ← HUD
          </button>
          <div>
            <div style={{
              fontSize: "1rem", fontWeight: 900, letterSpacing: "0.2em",
              background: "linear-gradient(90deg, #00d4ff, #7c3aed)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              HIVE MIND
            </div>
            <div style={{ fontSize: "0.55rem", color: "rgba(0,212,255,0.35)", letterSpacing: "0.2em" }}>
              FLEET CONTROL · SUPABASE REALTIME
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20,
            background: hiveReady ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${hiveReady ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
            fontSize: "0.65rem", color: hiveReady ? "#10b981" : "#ef4444",
            letterSpacing: "0.08em",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: hiveReady ? "#10b981" : "#ef4444",
              boxShadow: hiveReady ? "0 0 8px #10b981" : "none",
            }} />
            {hiveReady ? "SUPABASE CONNECTED" : "SUPABASE OFFLINE"}
          </div>

          <div style={{
            padding: "4px 12px", borderRadius: 20,
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.15)",
            fontSize: "0.65rem", color: "#00d4ff",
            letterSpacing: "0.08em",
            fontWeight: 700,
          }}>
            {onlineCount} / {fleet.length} ONLINE
          </div>

          <button
            onClick={() => setShowConfig(true)}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "5px 12px", color: "rgba(226,232,240,0.5)",
              cursor: "pointer", fontSize: "0.7rem",
            }}
          >
            ⚙ Config
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "5px 12px", color: "rgba(226,232,240,0.3)",
              cursor: "pointer", fontSize: "0.7rem",
            }}
          >
            ← Dashboard
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 0, position: "relative", zIndex: 1,
        overflow: "hidden",
        minHeight: 0,
      }}>

        {/* ── LEFT: Fleet list */}
        <div style={{
          borderRight: "1px solid rgba(0,212,255,0.08)",
          background: "rgba(2,8,18,0.6)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Fleet header */}
          <div style={{
            padding: "14px 16px 10px",
            borderBottom: "1px solid rgba(0,212,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{
              fontSize: "0.6rem", letterSpacing: "0.2em",
              color: "rgba(0,212,255,0.4)",
            }}>
              FLEET NODES
            </div>
            <button
              onClick={loadFleet}
              style={{
                background: "none", border: "none",
                color: "rgba(0,212,255,0.35)", cursor: "pointer",
                fontSize: "0.75rem",
              }}
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {/* Broadcast quick actions */}
          <div style={{
            padding: "10px 12px",
            borderBottom: "1px solid rgba(0,212,255,0.04)",
            display: "flex", gap: 6, flexWrap: "wrap",
          }}>
            {[
              { label: "📸 All Screenshot", action: "screenshot" },
              { label: "🔒 Lock All",        action: "lock" },
            ].map(btn => (
              <button
                key={btn.action}
                onClick={() => handleBroadcast(btn.action)}
                disabled={cmdLoading}
                style={{
                  background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.12)",
                  borderRadius: 6, padding: "4px 8px",
                  color: "rgba(226,232,240,0.5)", fontSize: "0.65rem",
                  cursor: cmdLoading ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Node list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            {fleet.length === 0 ? (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "rgba(226,232,240,0.2)", fontSize: "0.75rem",
                textAlign: "center", gap: 8, padding: 20,
              }}>
                <div style={{ fontSize: "2rem" }}>🌐</div>
                {hiveReady
                  ? "Belum ada PC yang bergabung.\nJalankan JARVIS di PC lain."
                  : "Supabase belum dikonfigurasi.\nKlik ⚙ Config untuk setup."}
              </div>
            ) : (
              fleet.map(node => (
                <NodeCard
                  key={node.node_id}
                  node={node}
                  selected={selectedNode === node.node_id}
                  selfId={selfNodeId}
                  onSelect={setSelectedNode}
                  onCommand={handleCommand}
                />
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Detail panel */}
        <div style={{
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          background: "rgba(2,8,18,0.3)",
        }}>
          {!selectedInfo ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(226,232,240,0.2)", fontSize: "0.8rem",
              flexDirection: "column", gap: 10,
            }}>
              <div style={{ fontSize: "3rem" }}>🤖</div>
              <div>Pilih PC dari daftar untuk melihat detail dan mengirim perintah</div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

              {/* PC Info header */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 16,
                animation: "slide-right 0.2s ease both",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: selectedInfo.status === "online"
                    ? "rgba(0,212,255,0.1)" : "rgba(239,68,68,0.08)",
                  border: `2px solid ${selectedInfo.status === "online" ? "rgba(0,212,255,0.3)" : "rgba(239,68,68,0.2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24,
                }}>
                  🖥
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: "1.2rem", fontWeight: 800, color: "#e2e8f0",
                    letterSpacing: "0.05em",
                  }}>
                    {selectedInfo.node_name || selectedInfo.hostname}
                    {selectedInfo.is_self && (
                      <span style={{
                        marginLeft: 10, fontSize: "0.6rem",
                        background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
                        borderRadius: 4, padding: "2px 7px", color: "#10b981",
                      }}>THIS PC</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.35)", marginTop: 2 }}>
                    {selectedInfo.hostname} · {selectedInfo.os}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    {[
                      { val: selectedInfo.ip_local,  label: "🌐 IP" },
                      { val: `v${selectedInfo.version}`, label: "📦" },
                      { val: `Port ${selectedInfo.api_port}`, label: "🔌" },
                    ].filter(p => p.val && p.val !== "🌐 IP undefined").map(p => (
                      <span key={p.label} style={{
                        fontSize: "0.62rem", padding: "2px 8px",
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 5, color: "rgba(226,232,240,0.45)",
                      }}>
                        {p.label} {p.val}
                      </span>
                    ))}
                    {selectedInfo.tunnel_url && (
                      <a href={selectedInfo.tunnel_url} target="_blank" rel="noreferrer" style={{
                        fontSize: "0.62rem", padding: "2px 8px",
                        background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
                        borderRadius: 5, color: "#00d4ff", textDecoration: "none",
                      }}>
                        🔗 Tunnel
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{
                    fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em",
                    color: selectedInfo.status === "online" ? "#10b981" : "#ef4444",
                    padding: "4px 10px", borderRadius: 8,
                    background: selectedInfo.status === "online"
                      ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${selectedInfo.status === "online"
                      ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`,
                  }}>
                    {selectedInfo.status.toUpperCase()}
                  </div>
                  <div style={{ fontSize: "0.58rem", color: "rgba(226,232,240,0.2)", marginTop: 5 }}>
                    {timeSince(selectedInfo.last_seen)}
                  </div>
                </div>
              </div>

              {/* Live metrics */}
              {selectedInfo.status === "online" && (
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                }}>
                  {[
                    { label: "CPU",  val: selectedInfo.cpu_pct,  color: "#00d4ff",  unit: "%" },
                    { label: "RAM",  val: selectedInfo.ram_pct,  color: "#7c3aed",  unit: "%" },
                    { label: "DISK", val: selectedInfo.disk_pct, color: "#10b981",  unit: "%" },
                  ].map(m => (
                    <div key={m.label} style={{
                      padding: "12px 14px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                    }}>
                      <div style={{ fontSize: "0.6rem", color: "rgba(226,232,240,0.3)", letterSpacing: "0.15em", marginBottom: 6 }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: m.color }}>
                        {m.val.toFixed(0)}<span style={{ fontSize: "0.8rem" }}>{m.unit}</span>
                      </div>
                      <MiniBar pct={m.val} color={m.color} />
                    </div>
                  ))}
                </div>
              )}

              {/* Command sender */}
              {selectedInfo.status === "online" && (
                <div style={{
                  padding: 16, borderRadius: 12,
                  background: "rgba(0,212,255,0.03)",
                  border: "1px solid rgba(0,212,255,0.1)",
                }}>
                  <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", color: "rgba(0,212,255,0.4)", marginBottom: 12 }}>
                    KIRIM PERINTAH
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    {/* Target selector */}
                    <select
                      value={cmdTarget}
                      onChange={e => setCmdTarget(e.target.value as any)}
                      style={{
                        background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,212,255,0.2)",
                        borderRadius: 8, padding: "6px 10px", color: "#e2e8f0",
                        fontSize: "0.75rem", cursor: "pointer",
                      }}
                    >
                      <option value="node">PC ini saja</option>
                      <option value="others">Semua lainnya</option>
                      <option value="all">Semua PC</option>
                    </select>

                    {/* Action buttons */}
                    {[
                      { icon: "📸", action: "screenshot", label: "Screenshot" },
                      { icon: "🔒", action: "lock",       label: "Lock" },
                      { icon: "🔊", action: "set_volume", label: "Mute",    params: { level: 0 } },
                      { icon: "📊", action: "status",     label: "Status" },
                      { icon: "🖥", action: "popup",      label: "Popup",
                        params: { title: "JARVIS", message: "Hello from Hive Mind!" } },
                    ].map(btn => (
                      <button
                        key={btn.action}
                        onClick={() => {
                          const t = cmdTarget === "node" ? selectedNode : cmdTarget;
                          handleCommand(t, btn.action);
                        }}
                        disabled={cmdLoading}
                        style={{
                          background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)",
                          borderRadius: 8, padding: "6px 12px",
                          color: "rgba(226,232,240,0.7)", fontSize: "0.72rem",
                          cursor: cmdLoading ? "not-allowed" : "pointer",
                          transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5,
                        }}
                      >
                        {btn.icon} {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Command result */}
                  {cmdResult && (
                    <div style={{
                      padding: "6px 10px", borderRadius: 8,
                      background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.1)",
                      fontSize: "0.75rem", color: "#00d4ff",
                      animation: "fade-in 0.2s ease both",
                    }}>
                      {cmdResult}
                    </div>
                  )}
                </div>
              )}

              {/* Ask AI on this node */}
              <div style={{
                padding: 16, borderRadius: 12,
                background: "rgba(124,58,237,0.04)",
                border: "1px solid rgba(124,58,237,0.12)",
              }}>
                <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", color: "rgba(124,58,237,0.6)", marginBottom: 10 }}>
                  🧠 TANYA AI DI PC INI
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={askQuestion}
                    onChange={e => setAskQuestion(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAskAI()}
                    placeholder={`Tanya ${selectedInfo.node_name} tentang apa?`}
                    style={{
                      flex: 1, background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(124,58,237,0.2)", borderRadius: 8,
                      padding: "8px 12px", color: "#e2e8f0", fontSize: "0.85rem",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={handleAskAI}
                    disabled={askLoading || !askQuestion.trim()}
                    style={{
                      padding: "0 18px", borderRadius: 8,
                      background: askLoading ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.2)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      color: "#a78bfa", fontWeight: 700, fontSize: "0.8rem",
                      cursor: askLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {askLoading ? "⏳" : "→"}
                  </button>
                </div>
                {askResult && (
                  <div style={{
                    marginTop: 10, padding: "10px 14px", borderRadius: 8,
                    background: "rgba(0,0,0,0.35)", border: "1px solid rgba(124,58,237,0.15)",
                    fontSize: "0.85rem", color: "#c4b5fd", lineHeight: 1.6,
                    whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
                    animation: "fade-in 0.2s ease both",
                  }}>
                    {askResult}
                  </div>
                )}
              </div>

              {/* AI Agent panel */}
              <div style={{
                padding: 16, borderRadius: 12,
                background: "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{
                  fontSize: "0.6rem", letterSpacing: "0.2em",
                  color: "rgba(226,232,240,0.3)", marginBottom: 12,
                }}>
                  ⚡ AI AGENTS (GLOBAL)
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(aiAgents).map(([key, agent]) => (
                    <button
                      key={key}
                      onClick={() => handleSwitchAgent(key as any)}
                      style={{
                        padding: "8px 12px", borderRadius: 10,
                        background: primaryAgent === key
                          ? key === "groq"       ? "rgba(245,158,11,0.12)"
                          : key === "gemini"     ? "rgba(0,212,255,0.1)"
                          :                        "rgba(167,139,250,0.1)"
                          : "rgba(255,255,255,0.02)",
                        border: primaryAgent === key
                          ? key === "groq"       ? "1px solid rgba(245,158,11,0.3)"
                          : key === "gemini"     ? "1px solid rgba(0,212,255,0.25)"
                          :                        "1px solid rgba(167,139,250,0.25)"
                          : "1px solid rgba(255,255,255,0.05)",
                        cursor: "pointer", textAlign: "left",
                        transition: "all 0.2s",
                        opacity: agent.active ? 1 : 0.4,
                      }}
                    >
                      <div style={{
                        fontSize: "0.7rem", fontWeight: 700,
                        color: primaryAgent === key
                          ? key === "groq" ? "#f59e0b" : key === "gemini" ? "#00d4ff" : "#a78bfa"
                          : "rgba(226,232,240,0.5)",
                      }}>
                        {key === "groq" ? "⚡" : key === "gemini" ? "🔵" : "🟣"} {agent.name}
                        {primaryAgent === key && (
                          <span style={{ marginLeft: 5, fontSize: "0.55rem", opacity: 0.7 }}>
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: "0.58rem", color: "rgba(226,232,240,0.25)",
                        marginTop: 2,
                      }}>
                        {agent.model.slice(0, 28)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── Config Modal */}
      {showConfig && (
        <>
          <div
            onClick={() => setShowConfig(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            zIndex: 101, width: 480, maxWidth: "95vw",
            background: "rgba(5,10,22,0.98)", border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: 16, padding: 28, boxShadow: "0 0 60px rgba(0,212,255,0.08)",
            animation: "fade-in 0.2s ease both",
          }}>
            <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", color: "rgba(0,212,255,0.5)", marginBottom: 20 }}>
              ⚙ HIVE MIND CONFIGURATION
            </div>

            {[
              { label: "Nama PC ini", value: cfgName, set: setCfgName, placeholder: "Contoh: PC-Gaming, Laptop-Kantor" },
              { label: "Supabase URL", value: cfgUrl, set: setCfgUrl, placeholder: "https://xxxxx.supabase.co" },
              { label: "Supabase Service Key", value: cfgKey, set: setCfgKey, placeholder: "eyJhbGciOi..." },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.4)", marginBottom: 6 }}>
                  {f.label}
                </div>
                <input
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,212,255,0.15)",
                    borderRadius: 8, padding: "9px 12px",
                    color: "#e2e8f0", fontSize: "0.85rem", outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            ))}

            <div style={{
              marginBottom: 14, padding: "10px 12px", borderRadius: 8,
              background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
              fontSize: "0.7rem", color: "rgba(245,158,11,0.8)",
              lineHeight: 1.5,
            }}>
              ⚠️ Gunakan <b>service_role</b> key (bukan anon key) agar JARVIS bisa baca/tulis ke Supabase.
              Buat tabel terlebih dahulu dengan script <code>HIVE_MIND_SETUP.sql</code>.
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleSaveConfig}
                disabled={cfgSaving}
                style={{
                  flex: 1, padding: "10px", borderRadius: 9,
                  background: cfgSaving ? "rgba(0,212,255,0.05)" : "rgba(0,212,255,0.12)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  color: "#00d4ff", fontWeight: 700, fontSize: "0.8rem",
                  cursor: cfgSaving ? "not-allowed" : "pointer",
                  letterSpacing: "0.1em",
                }}
              >
                {cfgSaving ? "SAVING…" : "SIMPAN"}
              </button>
              <button
                onClick={() => setShowConfig(false)}
                style={{
                  flex: 1, padding: "10px", borderRadius: 9,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(226,232,240,0.4)", fontSize: "0.8rem", cursor: "pointer",
                }}
              >
                BATAL
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
