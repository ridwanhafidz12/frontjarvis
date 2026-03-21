"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getProcesses, killProcess } from "@/lib/api";

interface Process {
  pid:     number;
  name:    string;
  cpu:     number;
  ram_mb:  number;
  status:  string;
  user:    string;
  started: string;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span style={{ opacity: 0.2, fontSize: "0.7rem" }}>↕</span>;
  return <span style={{ color: "#00d4ff", fontSize: "0.7rem" }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function ProcessTab() {
  const [processes,    setProcesses]    = useState<Process[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [sort,         setSort]         = useState<"cpu" | "ram" | "name" | "pid">("cpu");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("desc");
  const [total,        setTotal]        = useState(0);
  const [killing,      setKilling]      = useState<number | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; err: boolean } | null>(null);
  const [autoRefresh,  setAutoRefresh]  = useState(true);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, err = false) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, err });
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchProcesses = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await getProcesses(sort, 100, search) as any;
      setProcesses(data.processes || []);
      setTotal(data.total || 0);
    } catch {
      if (!silent) showToast("Failed to fetch processes", true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sort, search, showToast]);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => fetchProcesses(true), 4000);
    return () => clearInterval(iv);
  }, [autoRefresh, fetchProcesses]);

  const handleSort = (col: typeof sort) => {
    if (sort === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSort(col); setSortDir("desc"); }
  };

  const handleKill = async (pid: number, name: string) => {
    if (!confirm(`Kill process "${name}" (PID ${pid})?`)) return;
    setKilling(pid);
    try {
      await killProcess(pid);
      showToast(`✅ Killed "${name}" (PID ${pid})`);
      setProcesses(ps => ps.filter(p => p.pid !== pid));
    } catch (e: any) {
      showToast(`❌ ${e.message || "Kill failed"}`, true);
    } finally {
      setKilling(null);
    }
  };

  const sorted = [...processes].sort((a, b) => {
    const key = sort === "ram" ? "ram_mb" : sort;
    const av = (a as any)[key];
    const bv = (b as any)[key];
    const cmp = typeof av === "string" ? av.localeCompare(bv) : (av - bv);
    return sortDir === "desc" ? -cmp : cmp;
  });

  const cpuColor = (cpu: number) =>
    cpu > 80 ? "#ef4444" : cpu > 50 ? "#f59e0b" : cpu > 20 ? "#00d4ff" : "rgba(226,232,240,0.4)";

  const ramColor = (mb: number) =>
    mb > 1000 ? "#ef4444" : mb > 500 ? "#f59e0b" : "rgba(226,232,240,0.5)";

  return (
    <>
      <style>{`
        @keyframes proc-fade { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        @keyframes proc-spin { to{transform:rotate(360deg);} }
        .proc-row { transition: background 0.12s; }
        .proc-row:hover { background: rgba(255,255,255,0.025) !important; }
        .proc-kill:hover { background: rgba(239,68,68,0.2) !important; border-color: rgba(239,68,68,0.5) !important; }
        .col-btn { cursor: pointer; user-select: none; display: flex; align-items: center; gap: 4px; }
        .col-btn:hover { color: #00d4ff; }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", gap:16, animation:"proc-fade 0.35s ease both" }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position:"fixed", bottom:80, right:24, zIndex:999,
            background: toast.err ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
            border: `1px solid ${toast.err ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)"}`,
            color: toast.err ? "#fca5a5" : "#6ee7b7",
            borderRadius:10, padding:"10px 16px",
            fontSize:"0.83rem", fontWeight:600, backdropFilter:"blur(12px)",
            animation:"proc-fade 0.2s ease both", maxWidth:320,
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
          <div>
            <h2 style={{ fontSize:"1.05rem", fontWeight:700, color:"#e2e8f0", margin:0 }}>
              ⚙️ Process Manager
            </h2>
            <p style={{ fontSize:"0.72rem", color:"rgba(226,232,240,0.35)", marginTop:3 }}>
              {total} processes total · showing {sorted.length}
            </p>
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {/* Search */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Filter name…"
              style={{
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:8, padding:"7px 12px", color:"#e2e8f0",
                fontSize:"0.82rem", outline:"none", fontFamily:"inherit", width:180,
              }}
            />

            {/* Auto refresh toggle */}
            <div
              onClick={() => setAutoRefresh(v => !v)}
              style={{
                width:36, height:20, borderRadius:10, cursor:"pointer",
                background: autoRefresh ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.1)",
                border:`1px solid ${autoRefresh ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.15)"}`,
                position:"relative", transition:"background 0.2s", flexShrink:0,
              }}
              title={autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
            >
              <div style={{
                position:"absolute", top:2, left: autoRefresh ? 17 : 2,
                width:14, height:14, borderRadius:"50%",
                background: autoRefresh ? "#00d4ff" : "rgba(255,255,255,0.35)",
                transition:"left 0.2s",
              }} />
            </div>
            <span style={{ fontSize:"0.72rem", color:"rgba(226,232,240,0.4)" }}>
              {autoRefresh ? "Live" : "Paused"}
            </span>

            {/* Refresh button */}
            <button onClick={() => fetchProcesses()} disabled={refreshing} style={{
              background:"rgba(0,212,255,0.08)", border:"1px solid rgba(0,212,255,0.2)",
              color:"#00d4ff", borderRadius:8, padding:"7px 13px",
              fontSize:"0.8rem", cursor: refreshing ? "wait" : "pointer",
              display:"flex", alignItems:"center", gap:6, fontFamily:"inherit",
            }}>
              <span style={{ display:"inline-block", animation: refreshing ? "proc-spin 0.7s linear infinite" : "none" }}>🔄</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{
          background:"rgba(4,8,18,0.8)", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:12, overflow:"hidden",
        }}>
          {/* Table header */}
          <div style={{
            display:"grid",
            gridTemplateColumns:"60px 1fr 80px 90px 70px 60px 50px",
            gap:0, padding:"9px 14px",
            background:"rgba(0,212,255,0.025)",
            borderBottom:"1px solid rgba(255,255,255,0.06)",
            fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.08em",
            color:"rgba(226,232,240,0.4)", textTransform:"uppercase",
          }}>
            <span className="col-btn" onClick={() => handleSort("pid")}>
              PID <SortIcon active={sort==="pid"} dir={sortDir} />
            </span>
            <span className="col-btn" onClick={() => handleSort("name")}>
              NAME <SortIcon active={sort==="name"} dir={sortDir} />
            </span>
            <span className="col-btn" onClick={() => handleSort("cpu")}>
              CPU <SortIcon active={sort==="cpu"} dir={sortDir} />
            </span>
            <span className="col-btn" onClick={() => handleSort("ram")}>
              RAM <SortIcon active={sort==="ram"} dir={sortDir} />
            </span>
            <span>STATUS</span>
            <span>START</span>
            <span></span>
          </div>

          {/* Body */}
          <div style={{ maxHeight:520, overflowY:"auto", overflowX:"auto" }}>
            {loading ? (
              <div style={{ padding:40, textAlign:"center", color:"rgba(226,232,240,0.3)", fontSize:"0.875rem" }}>
                <span style={{ display:"inline-block", width:20, height:20, borderRadius:"50%",
                  border:"2px solid rgba(0,212,255,0.3)", borderTopColor:"#00d4ff",
                  animation:"proc-spin 0.7s linear infinite" }} />{" "}
                Loading processes…
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ padding:40, textAlign:"center", color:"rgba(226,232,240,0.3)", fontSize:"0.875rem" }}>
                {search ? `No processes matching "${search}"` : "No processes found"}
              </div>
            ) : sorted.map((proc, i) => (
              <div key={proc.pid} className="proc-row" style={{
                display:"grid",
                gridTemplateColumns:"60px 1fr 80px 90px 70px 60px 50px",
                gap:0, padding:"8px 14px",
                borderBottom:"1px solid rgba(255,255,255,0.035)",
                alignItems:"center",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.008)",
              }}>
                {/* PID */}
                <span style={{ fontSize:"0.75rem", color:"rgba(226,232,240,0.4)", fontFamily:"monospace" }}>
                  {proc.pid}
                </span>

                {/* Name */}
                <span style={{
                  fontSize:"0.82rem", color:"#e2e8f0", fontWeight:500,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }} title={proc.name}>
                  {proc.name}
                </span>

                {/* CPU */}
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:"0.8rem", fontWeight:700, color:cpuColor(proc.cpu), fontFamily:"monospace", minWidth:36 }}>
                    {proc.cpu.toFixed(1)}%
                  </span>
                </div>

                {/* RAM */}
                <span style={{ fontSize:"0.78rem", color:ramColor(proc.ram_mb), fontFamily:"monospace" }}>
                  {proc.ram_mb >= 1024
                    ? `${(proc.ram_mb/1024).toFixed(1)} GB`
                    : `${Math.round(proc.ram_mb)} MB`}
                </span>

                {/* Status */}
                <span style={{
                  fontSize:"0.7rem", fontWeight:600,
                  color: proc.status === "running" ? "#10b981" : "rgba(226,232,240,0.35)",
                }}>
                  {proc.status}
                </span>

                {/* Start */}
                <span style={{ fontSize:"0.7rem", color:"rgba(226,232,240,0.3)", fontFamily:"monospace" }}>
                  {proc.started}
                </span>

                {/* Kill */}
                <button
                  className="proc-kill"
                  disabled={killing === proc.pid}
                  onClick={() => handleKill(proc.pid, proc.name)}
                  style={{
                    background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)",
                    color:"#ef4444", borderRadius:6, padding:"3px 8px",
                    fontSize:"0.7rem", cursor: killing === proc.pid ? "not-allowed" : "pointer",
                    fontFamily:"inherit", transition:"all 0.15s",
                    display:"flex", alignItems:"center", gap:4,
                  }}
                >
                  {killing === proc.pid
                    ? <span style={{ width:10, height:10, borderRadius:"50%", border:"1.5px solid #ef4444",
                        borderTopColor:"transparent", display:"inline-block", animation:"proc-spin 0.6s linear infinite" }} />
                    : "⊗"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer legend */}
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:"0.7rem", color:"rgba(226,232,240,0.3)" }}>
          <span style={{ color:"#ef4444" }}>● CPU &gt;80% or RAM &gt;1GB</span>
          <span style={{ color:"#f59e0b" }}>● CPU &gt;50% or RAM &gt;500MB</span>
          <span style={{ color:"#00d4ff" }}>● CPU &gt;20%</span>
          <span style={{ marginLeft:"auto" }}>Auto-refresh: {autoRefresh ? "4s" : "OFF"}</span>
        </div>
      </div>
    </>
  );
}
