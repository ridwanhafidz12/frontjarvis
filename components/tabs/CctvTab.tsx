"use client";
import { useState } from "react";
import { getApiBase, getToken } from "@/lib/api";

export default function CctvTab() {
  const [mode, setMode] = useState<"none" | "cctv" | "screen">("none");

  const base = typeof window !== "undefined" ? getApiBase() : "";
  const token = typeof window !== "undefined" ? getToken() : "";

  // The stream URLs
  const cctvUrl = `${base}/cctv?token=${token}`;
  const screenUrl = `${base}/stream?token=${token}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 }}>📹 Live Streams</h2>
        <p style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.4)" }}>
          CCTV: silent webcam stream (no LED indicator) · Screen Share: live desktop
        </p>
      </div>

      {/* Mode buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className={mode === "cctv" ? "btn-success" : "btn-primary"}
          onClick={() => setMode(mode === "cctv" ? "none" : "cctv")}
        >
          📹 {mode === "cctv" ? "Stop CCTV" : "Start CCTV"}
        </button>
        <button
          className={mode === "screen" ? "btn-success" : "btn-primary"}
          onClick={() => setMode(mode === "screen" ? "none" : "screen")}
        >
          🖥️ {mode === "screen" ? "Stop Screen Share" : "Screen Share"}
        </button>
      </div>

      {/* Stream display */}
      {mode !== "none" && (
        <div className="jarvis-card" style={{ padding: 16, position: "relative" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: "#ef4444",
                boxShadow: "0 0 6px #ef4444"
              }} className="pulse-dot" />
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ef4444" }}>
                {mode === "cctv" ? "🔴 LIVE — CCTV (Silent)" : "🔴 LIVE — Screen Share"}
              </span>
            </div>
            <button className="btn-danger" style={{ fontSize: "0.75rem", padding: "3px 10px" }}
              onClick={() => setMode("none")}>⬛ Stop</button>
          </div>

          {mode === "cctv" && (
            <img
              src={cctvUrl}
              alt="CCTV Stream"
              style={{ width: "100%", borderRadius: 8, background: "#000", minHeight: 360 }}
              onError={e => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}

          {mode === "screen" && (
            <img
              src={screenUrl}
              alt="Screen Share"
              style={{ width: "100%", borderRadius: 8, background: "#000", minHeight: 360 }}
              onError={e => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}

          {/* Note */}
          <div style={{
            marginTop: 10, padding: "8px 12px", background: "rgba(0,0,0,0.3)",
            borderRadius: 6, fontSize: "0.75rem", color: "rgba(226,232,240,0.4)"
          }}>
            {mode === "cctv"
              ? "⚠️ CCTV mode: webcam capture runs silently, no camera LED activation"
              : "📡 Screen share: live MJPEG stream of remote desktop"
            }
          </div>
        </div>
      )}

      {mode === "none" && (
        <div className="jarvis-card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📹</div>
          <div style={{ color: "rgba(226,232,240,0.5)", fontSize: "0.875rem" }}>
            Select a stream mode above to start monitoring
          </div>
        </div>
      )}

      {/* Direct links */}
      <div className="jarvis-card" style={{ padding: 16 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 8 }}>🔗 Direct Stream Links</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.5)", width: 80 }}>CCTV:</span>
            <code style={{ fontSize: "0.75rem", color: "#00d4ff", background: "rgba(0,212,255,0.05)", padding: "2px 8px", borderRadius: 4 }}>
              {base}/cctv
            </code>
            <a href={cctvUrl} target="_blank" rel="noopener" className="btn-primary" style={{ fontSize: "0.7rem", padding: "2px 8px", textDecoration: "none" }}>Open</a>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.5)", width: 80 }}>Screen:</span>
            <code style={{ fontSize: "0.75rem", color: "#00d4ff", background: "rgba(0,212,255,0.05)", padding: "2px 8px", borderRadius: 4 }}>
              {base}/stream
            </code>
            <a href={screenUrl} target="_blank" rel="noopener" className="btn-primary" style={{ fontSize: "0.7rem", padding: "2px 8px", textDecoration: "none" }}>Open</a>
          </div>
        </div>
      </div>
    </div>
  );
}
