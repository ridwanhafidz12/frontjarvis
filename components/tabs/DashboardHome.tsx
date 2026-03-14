"use client";
import { useState, useEffect, useCallback } from "react";
import { getStatus, screenshot, control } from "@/lib/api";

interface SystemStatus {
  cpu?: number;
  ram_used?: number;
  ram_total?: number;
  ram_percent?: number;
  disk_used?: number;
  disk_total?: number;
  disk_percent?: number;
  battery_percent?: number;
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

export default function DashboardHome() {
  const [status, setStatus] = useState<SystemStatus>({});
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shotLoading, setShotLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getStatus();
      setStatus(data);
      setLastUpdate(new Date());
    } catch (e) {
      console.error("Status fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 10000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  const takeScreenshot = async () => {
    setShotLoading(true);
    try {
      const data = await screenshot();
      setScreenshotData(data.image);
    } catch (e) {
      console.error("Screenshot failed:", e);
    } finally {
      setShotLoading(false);
    }
  };

  const StatCard = ({ icon, label, value, sub, percent, danger }: any) => (
    <div className="stat-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="stat-label">{icon} {label}</div>
          <div className="stat-value" style={{ color: danger && percent > 80 ? "#ef4444" : undefined }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)", marginTop: 2 }}>{sub}</div>}
        </div>
        {percent !== undefined && (
          <div style={{
            width: 48, height: 48,
            borderRadius: "50%",
            background: `conic-gradient(${danger && percent > 80 ? "#ef4444" : "#00d4ff"} ${percent * 3.6}deg, rgba(0,212,255,0.1) 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.65rem", fontWeight: 700, color: "rgba(226,232,240,0.7)"
          }}>
            {Math.round(percent)}%
          </div>
        )}
      </div>
      {percent !== undefined && (
        <div className="progress-bar" style={{ marginTop: 8 }}>
          <div className={`progress-fill ${danger && percent > 80 ? "danger" : ""}`}
            style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#e2e8f0" }}>System Overview</h2>
          <p style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.4)", marginTop: 2 }}>
            {lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : "Loading..."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" onClick={fetchStatus} disabled={loading}>
            🔄 Refresh
          </button>
          <button className="btn-primary" onClick={takeScreenshot} disabled={shotLoading}>
            {shotLoading ? <><div className="spinner" style={{width:14,height:14}}/>...</> : "📸 Screenshot"}
          </button>
        </div>
      </div>

      {/* Stat grid */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          <StatCard icon="🖥️" label="CPU" value={`${status.cpu?.toFixed(1) ?? 0}%`}
            percent={status.cpu} danger />
          <StatCard icon="🧠" label="RAM"
            value={`${status.ram_used ?? 0} MB`}
            sub={`/ ${status.ram_total ?? 0} MB`}
            percent={status.ram_percent} danger />
          <StatCard icon="💾" label="Disk"
            value={`${status.disk_used ?? 0} GB`}
            sub={`/ ${status.disk_total ?? 0} GB`}
            percent={status.disk_percent} danger />
          <StatCard icon={status.battery_plugged ? "⚡" : "🔋"} label="Battery"
            value={status.battery_percent !== null && status.battery_percent !== undefined
              ? `${Math.round(status.battery_percent)}%` : "N/A"}
            percent={status.battery_percent} />
          <StatCard icon="🏠" label="Local IP" value={status.local_ip ?? "Unknown"} />
          <StatCard icon="🌍" label="Public IP" value={status.public_ip ?? "Unknown"} />
          {status.location && (
            <StatCard 
              icon="📍" 
              label="Location" 
              value={`${status.location.city ?? ""}, ${status.location.country ?? ""}`} 
              sub={`${status.location.regionName ?? ""} · ${status.location.isp ?? ""}`}
            />
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="jarvis-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>
          ⚡ Quick Actions
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { label: "🔒 Lock PC", action: "lock", cls: "btn-warning" },
            { label: "📸 Screenshot", action: "screenshot", cls: "btn-primary" },
            { label: "📷 Webcam", action: "webcam", cls: "btn-primary" },
            { label: "🔊 Vol 50%", action: "set_volume", params: { level: 50 }, cls: "btn-primary" },
            { label: "🔇 Mute", action: "set_volume", params: { level: 0 }, cls: "btn-primary" },
            { label: "⏻ Shutdown", action: "shutdown", params: { delay: 30 }, cls: "btn-danger" },
            { label: "🔄 Restart", action: "restart", params: { delay: 30 }, cls: "btn-danger" },
          ].map(item => (
            <button key={item.label} className={item.cls as any}
              onClick={() => control(item.action, item.params ?? {})}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Screenshot display */}
      {screenshotData && (
        <div className="jarvis-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 600 }}>📸 Latest Screenshot</h3>
            <button className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
              onClick={() => setScreenshotData(null)}>✕ Close</button>
          </div>
          <img src={screenshotData} alt="Screenshot" style={{
            width: "100%", borderRadius: 8, border: "1px solid rgba(0,212,255,0.2)"
          }} />
        </div>
      )}
    </div>
  );
}
