"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getStatus, screenshot, control } from "@/lib/api";

interface SystemStatus {
  cpu_percent?: number;
  cpu?: number;
  ram_used_mb?: number;
  ram_used?: number;
  ram_total_mb?: number;
  ram_total?: number;
  ram_percent?: number;
  disk_used_gb?: number;
  disk_used?: number;
  disk_total_gb?: number;
  disk_total?: number;
  disk_percent?: number;
  battery_percent?: number | null;
  battery_plugged?: boolean;
  local_ip?: string;
  public_ip?: string;
  location?: {
    city?: string;
    country?: string;
    regionName?: string;
    isp?: string;
    lat?: number;
    lon?: number;
  };
}

interface QuickAction {
  label: string;
  icon: string;
  action: string;
  params?: Record<string, unknown>;
  variant: "primary" | "warning" | "danger" | "success";
  confirm?: boolean;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Screenshot", icon: "📸", action: "screenshot",  variant: "primary" },
  { label: "Webcam",     icon: "📷", action: "webcam",      variant: "primary" },
  { label: "Lock PC",    icon: "🔒", action: "lock",        variant: "warning" },
  { label: "Vol 50%",    icon: "🔊", action: "set_volume",  params: { level: 50 },  variant: "primary" },
  { label: "Mute",       icon: "🔇", action: "set_volume",  params: { level: 0 },   variant: "primary" },
  { label: "Vol Max",    icon: "🔈", action: "set_volume",  params: { level: 100 }, variant: "primary" },
  { label: "Shutdown",   icon: "⏻",  action: "shutdown",    params: { delay: 30 },  variant: "danger",  confirm: true },
  { label: "Restart",    icon: "🔄", action: "restart",     params: { delay: 30 },  variant: "danger",  confirm: true },
];

function cpuVal(s: SystemStatus)   { return s.cpu_percent  ?? s.cpu       ?? 0; }
function ramUsed(s: SystemStatus)  { return s.ram_used_mb  ?? s.ram_used  ?? 0; }
function ramTotal(s: SystemStatus) { return s.ram_total_mb ?? s.ram_total ?? 0; }
function diskUsed(s: SystemStatus) { return s.disk_used_gb ?? s.disk_used ?? 0; }
function diskTotal(s: SystemStatus){ return s.disk_total_gb ?? s.disk_total ?? 0; }

function statusColor(pct: number, danger: boolean) {
  if (!danger) return "var(--accent, #00d4ff)";
  if (pct > 85) return "#ef4444";
  if (pct > 65) return "#f59e0b";
  return "var(--accent, #00d4ff)";
}

function RadialGauge({ value, danger = false }: { value: number; danger?: boolean }) {
  const pct   = Math.min(100, Math.max(0, value));
  const color = statusColor(pct, danger);
  const r = 22, cx = 28, cy = 28, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={56} height={56} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1), stroke 0.5s" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fill="rgba(226,232,240,0.8)"
        style={{ fontSize: 12, fontWeight: 700, transform: "rotate(90deg)",
          transformOrigin: "center", fontFamily: "monospace" }}>
        {Math.round(pct)}
      </text>
    </svg>
  );
}

function Bar({ value, danger = false }: { value: number; danger?: boolean }) {
  const color = statusColor(value, danger);
  return (
    <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: 10 }}>
      <div style={{
        height: "100%", width: `${Math.min(100, value)}%`, background: color, borderRadius: 2,
        transition: "width 0.8s cubic-bezier(.4,0,.2,1), background 0.5s",
        boxShadow: `0 0 6px ${color}80`,
      }} />
    </div>
  );
}

function StatCard({ icon, label, value, sub, percent, danger = false, wide = false }: {
  icon: string; label: string; value: string;
  sub?: string; percent?: number; danger?: boolean; wide?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "rgba(0,212,255,0.04)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${hov ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12, padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 4,
        gridColumn: wide ? "span 2" : undefined,
        transition: "border-color 0.2s, background 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.4)", fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            {icon} {label}
          </div>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#e2e8f0",
            fontFamily: "'JetBrains Mono', 'Courier New', monospace", lineHeight: 1.1 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: "0.71rem", color: "rgba(226,232,240,0.33)", marginTop: 3 }}>
              {sub}
            </div>
          )}
        </div>
        {percent !== undefined && <RadialGauge value={percent} danger={danger} />}
      </div>
      {percent !== undefined && <Bar value={percent} danger={danger} />}
    </div>
  );
}

function ActionBtn({ action, onResult }: {
  action: QuickAction;
  onResult: (msg: string, err?: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "rgba(0,212,255,0.1)",  border: "1px solid rgba(0,212,255,0.25)",  color: "#00d4ff" },
    warning: { background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" },
    danger:  { background: "rgba(239,68,68,0.1)",  border: "1px solid rgba(239,68,68,0.25)",  color: "#ef4444" },
    success: { background: "rgba(34,197,94,0.1)",  border: "1px solid rgba(34,197,94,0.25)",  color: "#22c55e" },
  };
  const handleClick = async () => {
    if (action.confirm && !window.confirm(`Yakin mau ${action.label}?`)) return;
    setLoading(true);
    try {
      const r = await control(action.action, action.params ?? {});
      if (r?.image) onResult(`__img__${r.image}`);
      else onResult(`✅ ${action.label} berhasil`);
    } catch (e: unknown) {
      onResult(`❌ ${action.label} gagal: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button onClick={handleClick} disabled={loading} style={{
      ...styles[action.variant], borderRadius: 8, padding: "8px 14px",
      fontSize: "0.79rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", gap: 6,
      opacity: loading ? 0.6 : 1, transition: "all 0.15s", fontFamily: "inherit",
    }}>
      {loading
        ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid currentColor",
            borderTopColor: "transparent", display: "inline-block",
            animation: "jarvis-spin 0.7s linear infinite" }} />
        : action.icon}
      {action.label}
    </button>
  );
}

function PulsingDot({ active }: { active: boolean }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%",
        background: active ? "#22c55e" : "#ef4444", display: "block",
        margin: "auto", position: "absolute", inset: 0 }} />
      {active && (
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%",
          background: "#22c55e", opacity: 0.35,
          animation: "jarvis-ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
      )}
    </span>
  );
}

export default function DashboardHome() {
  const [status,         setStatus]         = useState<SystemStatus>({});
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [shotLoading,    setShotLoading]    = useState(false);
  const [lastUpdate,     setLastUpdate]     = useState<Date | null>(null);
  const [online,         setOnline]         = useState(true);
  const [toast,          setToast]          = useState<{ msg: string; err: boolean } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, err = false) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    if (msg.startsWith("__img__")) { setScreenshotData(msg.slice(7)); return; }
    setToast({ msg, err });
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchStatus = useCallback(async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    try {
      const data = await getStatus();
      setStatus(data);
      setLastUpdate(new Date());
      setOnline(true);
    } catch { setOnline(false); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(() => fetchStatus(), 10_000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  const takeScreenshot = async () => {
    setShotLoading(true);
    try {
      const d = await screenshot();
      setScreenshotData(d.image);
    } catch (e: unknown) {
      showToast(`❌ Screenshot gagal: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally { setShotLoading(false); }
  };

  const cpu = cpuVal(status);

  return (
    <>
      <style>{`
        @keyframes jarvis-spin { to { transform: rotate(360deg); } }
        @keyframes jarvis-ping { 75%,100% { transform: scale(2.2); opacity: 0; } }
        @keyframes jarvis-up   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        @keyframes jarvis-in   { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:none; } }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", gap:20, animation:"jarvis-up 0.4s ease both" }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position:"fixed", bottom:24, right:24, zIndex:999,
            background: toast.err ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
            border: `1px solid ${toast.err ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
            color: toast.err ? "#fca5a5" : "#86efac",
            borderRadius:10, padding:"10px 16px",
            fontSize:"0.82rem", fontWeight:600, backdropFilter:"blur(12px)",
            animation:"jarvis-in 0.25s ease both", maxWidth:320,
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <h2 style={{ fontSize:"1.1rem", fontWeight:700, color:"#e2e8f0", margin:0 }}>
                System Overview
              </h2>
              <PulsingDot active={online} />
            </div>
            <p style={{ fontSize:"0.73rem", color:"rgba(226,232,240,0.35)", marginTop:3 }}>
              {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()} · auto-refresh 10s` : "Connecting…"}
            </p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => fetchStatus(true)} disabled={refreshing} style={{
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
              color:"rgba(226,232,240,0.7)", borderRadius:8, padding:"7px 13px",
              fontSize:"0.78rem", fontWeight:600, cursor: refreshing ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", gap:6, fontFamily:"inherit",
            }}>
              <span style={{ display:"inline-block", animation: refreshing ? "jarvis-spin 0.7s linear infinite" : "none" }}>🔄</span>
              Refresh
            </button>
            <button onClick={takeScreenshot} disabled={shotLoading} style={{
              background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.25)",
              color:"#00d4ff", borderRadius:8, padding:"7px 14px",
              fontSize:"0.78rem", fontWeight:600, cursor: shotLoading ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", gap:6, opacity: shotLoading ? 0.6 : 1,
              fontFamily:"inherit",
            }}>
              {shotLoading
                ? <span style={{ width:12, height:12, borderRadius:"50%", border:"2px solid #00d4ff",
                    borderTopColor:"transparent", display:"inline-block",
                    animation:"jarvis-spin 0.7s linear infinite" }} />
                : "📸"}
              Screenshot
            </button>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:60, gap:12,
            color:"rgba(226,232,240,0.3)", fontSize:"0.85rem" }}>
            <span style={{ width:24, height:24, borderRadius:"50%",
              border:"2px solid rgba(0,212,255,0.3)", borderTopColor:"#00d4ff",
              display:"inline-block", animation:"jarvis-spin 0.7s linear infinite" }} />
            Loading system data…
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(185px, 1fr))", gap:12 }}>
            <StatCard icon="🖥️" label="CPU"
              value={`${cpu.toFixed(1)}%`} percent={cpu} danger />
            <StatCard icon="🧠" label="RAM"
              value={`${ramUsed(status)} MB`} sub={`of ${ramTotal(status)} MB`}
              percent={status.ram_percent} danger />
            <StatCard icon="💾" label="Disk"
              value={`${diskUsed(status)} GB`} sub={`of ${diskTotal(status)} GB`}
              percent={status.disk_percent} danger />
            {status.battery_percent !== null && status.battery_percent !== undefined ? (
              <StatCard
                icon={status.battery_plugged ? "⚡" : "🔋"}
                label={status.battery_plugged ? "Battery (Charging)" : "Battery"}
                value={`${Math.round(status.battery_percent)}%`}
                percent={status.battery_percent}
                danger={!status.battery_plugged}
              />
            ) : (
              <StatCard icon="🔌" label="Power" value="Desktop" sub="No battery" />
            )}
            <StatCard icon="🏠" label="Local IP"  value={status.local_ip  ?? "—"} sub="LAN" />
            <StatCard icon="🌍" label="Public IP" value={status.public_ip ?? "—"} sub="WAN" />
            {status.location && (
              <StatCard icon="📍" label="Location"
                value={[status.location.city, status.location.country].filter(Boolean).join(", ") || "—"}
                sub={[status.location.regionName, status.location.isp].filter(Boolean).join(" · ")}
                wide />
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div style={{
          background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:12, padding:"16px 18px",
        }}>
          <div style={{ fontSize:"0.68rem", color:"rgba(226,232,240,0.4)", fontWeight:600,
            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>
            ⚡ Quick Actions
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {QUICK_ACTIONS.map(a => (
              <ActionBtn key={a.label} action={a} onResult={showToast} />
            ))}
          </div>
        </div>

        {/* Screenshot */}
        {screenshotData && (
          <div style={{
            background:"rgba(255,255,255,0.02)", border:"1px solid rgba(0,212,255,0.15)",
            borderRadius:12, padding:16, animation:"jarvis-up 0.35s ease both",
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:"0.8rem", fontWeight:600, color:"#e2e8f0" }}>
                📸 Latest Screenshot
              </span>
              <div style={{ display:"flex", gap:8 }}>
                <a href={screenshotData} download={`jarvis_${Date.now()}.png`} style={{
                  background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.25)",
                  color:"#00d4ff", borderRadius:6, padding:"3px 12px",
                  fontSize:"0.74rem", fontWeight:600, textDecoration:"none",
                }}>⬇ Download</a>
                <button onClick={() => setScreenshotData(null)} style={{
                  background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)",
                  color:"#ef4444", borderRadius:6, padding:"3px 10px",
                  fontSize:"0.74rem", cursor:"pointer", fontFamily:"inherit",
                }}>✕ Close</button>
              </div>
            </div>
            <img src={screenshotData} alt="Screenshot" style={{
              width:"100%", borderRadius:8,
              border:"1px solid rgba(0,212,255,0.15)", display:"block",
            }} />
          </div>
        )}
      </div>
    </>
  );
}