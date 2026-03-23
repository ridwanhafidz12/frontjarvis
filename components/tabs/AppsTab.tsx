"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getApiBase, getToken } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface App {
  name:            string;
  version:         string;
  publisher:       string;
  install_date:    string;
  size_mb:         number;
  uninstall_str:   string;
  quiet_uninstall: string;
  key:             string;
}

function useWindowWidth() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const up = () => setW(window.innerWidth);
    up();
    window.addEventListener("resize", up);
    return () => window.removeEventListener("resize", up);
  }, []);
  return w;
}

async function apiRequest(path: string, opts: RequestInit = {}) {
  const base  = getApiBase();
  const token = getToken();
  const resp  = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
      ...opts.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ── App row ────────────────────────────────────────────────────────────────

function AppRow({ app, isMobile, onUninstall, uninstalling }: {
  app: App;
  isMobile: boolean;
  onUninstall: (app: App, quiet: boolean) => void;
  uninstalling: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUninstalling = uninstalling === app.key;

  return (
    <>
      <tr
        className="apps-row"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          cursor: isMobile ? "pointer" : "default",
        }}
        onClick={() => isMobile && setExpanded(v => !v)}
      >
        {/* Name */}
        <td style={{ padding: "9px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: "rgba(0,212,255,0.07)",
              border: "1px solid rgba(0,212,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem",
            }}>
              🖥️
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: "0.82rem", fontWeight: 600, color: "#e2e8f0",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {app.name}
              </div>
              {app.publisher && (
                <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.35)", marginTop: 1 }}>
                  {app.publisher}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Version — hidden on mobile */}
        {!isMobile && (
          <td style={{ padding: "9px 12px", fontSize: "0.75rem", color: "rgba(226,232,240,0.45)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
            {app.version || "—"}
          </td>
        )}

        {/* Size — hidden on mobile */}
        {!isMobile && (
          <td style={{ padding: "9px 12px", fontSize: "0.75rem", color: "rgba(226,232,240,0.45)", fontFamily: "monospace", textAlign: "right", whiteSpace: "nowrap" }}>
            {app.size_mb > 0 ? `${app.size_mb} MB` : "—"}
          </td>
        )}

        {/* Date — hidden on mobile */}
        {!isMobile && (
          <td style={{ padding: "9px 12px", fontSize: "0.72rem", color: "rgba(226,232,240,0.3)", whiteSpace: "nowrap" }}>
            {app.install_date
              ? `${app.install_date.slice(0,4)}-${app.install_date.slice(4,6)}-${app.install_date.slice(6,8)}`
              : "—"}
          </td>
        )}

        {/* Actions */}
        <td style={{ padding: "9px 8px", textAlign: "center" }}>
          {app.uninstall_str ? (
            <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "nowrap" }}>
              {app.quiet_uninstall && (
                <button
                  onClick={e => { e.stopPropagation(); onUninstall(app, true); }}
                  disabled={!!uninstalling}
                  title="Silent uninstall (no dialog)"
                  style={{
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    color: "#ef4444", borderRadius: 6, padding: "4px 8px",
                    fontSize: "0.7rem", cursor: uninstalling ? "not-allowed" : "pointer",
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3,
                    opacity: uninstalling && !isUninstalling ? 0.4 : 1,
                  }}
                >
                  {isUninstalling ? "⌛" : "🤫"} {!isMobile && "Silent"}
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onUninstall(app, false); }}
                disabled={!!uninstalling}
                style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  color: "#ef4444", borderRadius: 6, padding: "4px 10px",
                  fontSize: "0.72rem", fontWeight: 600, cursor: uninstalling ? "not-allowed" : "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3,
                  opacity: uninstalling && !isUninstalling ? 0.4 : 1,
                }}
              >
                {isUninstalling ? "⌛" : "🗑️"} {!isMobile && "Uninstall"}
              </button>
            </div>
          ) : (
            <span style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.2)" }}>—</span>
          )}
        </td>
      </tr>

      {/* Mobile expanded row */}
      {isMobile && expanded && (
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <td colSpan={2} style={{ padding: "8px 12px 14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "rgba(226,232,240,0.5)" }}>
              {app.version     && <div>Version: <span style={{ color: "#e2e8f0" }}>{app.version}</span></div>}
              {app.size_mb > 0 && <div>Size: <span style={{ color: "#e2e8f0" }}>{app.size_mb} MB</span></div>}
              {app.install_date && <div>Installed: <span style={{ color: "#e2e8f0" }}>{app.install_date}</span></div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AppsTab() {
  const winW    = useWindowWidth();
  const isMobile = winW > 0 && winW < 640;

  const [apps,         setApps]         = useState<App[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [debouncedQ,   setDebouncedQ]   = useState("");
  const [sortBy,       setSortBy]       = useState<"name" | "size" | "date" | "publisher">("name");
  const [sortAsc,      setSortAsc]      = useState(true);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; err: boolean } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, err = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, err });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchApps = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const url = q ? `/api/apps?q=${encodeURIComponent(q)}` : "/api/apps";
      const data = await apiRequest(url) as { apps: App[]; total: number };
      setApps(data.apps || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedQ(search);
      fetchApps(search);
    }, 500);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleUninstall = async (app: App, quiet: boolean) => {
    if (!confirm(`Hapus "${app.name}"?\n${quiet ? "Mode diam (tanpa dialog konfirmasi)" : "Dialog uninstaller akan muncul di PC target."}`)) return;
    setUninstalling(app.key);
    try {
      await apiRequest("/api/apps/uninstall", {
        method: "POST",
        body: JSON.stringify({
          name:            app.name,
          uninstall_str:   app.uninstall_str,
          quiet_uninstall: app.quiet_uninstall,
          quiet,
        }),
      });
      showToast(`✅ Uninstall "${app.name}" dimulai di PC target`);
      // Remove from list after a short delay
      setTimeout(() => setApps(prev => prev.filter(a => a.key !== app.key)), 2000);
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setUninstalling(null);
    }
  };

  const sorted = [...apps].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name")      cmp = a.name.localeCompare(b.name);
    else if (sortBy === "size") cmp = a.size_mb - b.size_mb;
    else if (sortBy === "date") cmp = (a.install_date || "").localeCompare(b.install_date || "");
    else                        cmp = (a.publisher || "").localeCompare(b.publisher || "");
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(v => !v);
    else { setSortBy(col); setSortAsc(true); }
  };

  const SortArr = ({ col }: { col: typeof sortBy }) =>
    sortBy === col
      ? <span style={{ fontSize: "0.6rem", marginLeft: 3 }}>{sortAsc ? "↑" : "↓"}</span>
      : <span style={{ opacity: 0.2, fontSize: "0.6rem", marginLeft: 3 }}>↕</span>;

  return (
    <>
      <style>{`
        @keyframes apps-fade { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        @keyframes apps-spin { to{transform:rotate(360deg);} }
        .apps-row:hover { background: rgba(0,212,255,0.02) !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, right: 16, zIndex: 9999,
          background: toast.err ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
          border: `1px solid ${toast.err ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
          color: toast.err ? "#fca5a5" : "#6ee7b7",
          borderRadius: 10, padding: "10px 16px",
          fontSize: "0.83rem", fontWeight: 600, backdropFilter: "blur(12px)",
          animation: "apps-fade 0.2s ease both", maxWidth: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "apps-fade 0.35s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
              🖥️ Installed Applications
            </h2>
            <p style={{ fontSize: "0.72rem", color: "rgba(226,232,240,0.35)", marginTop: 3 }}>
              {loading ? "Loading…" : `${total} apps terinstall di PC target`}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Cari aplikasi…"
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "8px 32px 8px 12px", color: "#e2e8f0",
                  fontSize: "0.82rem", outline: "none", fontFamily: "inherit",
                  width: isMobile ? "100%" : 220,
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "rgba(226,232,240,0.4)",
                    cursor: "pointer", fontSize: "0.85rem",
                  }}
                >✕</button>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchApps(debouncedQ)}
              disabled={loading}
              style={{
                background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
                color: "#00d4ff", borderRadius: 8, padding: "8px 14px",
                fontSize: "0.8rem", cursor: loading ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
              }}
            >
              <span style={{ display: "inline-block", animation: loading ? "apps-spin 0.7s linear infinite" : "none" }}>
                🔄
              </span>
              {!isMobile && "Refresh"}
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)",
          borderRadius: 10, padding: "10px 14px",
          fontSize: "0.78rem", color: "rgba(245,158,11,0.8)",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <span>
            <strong>Peringatan:</strong> Uninstall akan langsung dieksekusi di PC target.
            Mode <strong>Dialog</strong> membuka installer wizard. Mode <strong>Diam 🤫</strong> uninstall tanpa dialog (jika tersedia).
            Pastikan tidak sedang memakai aplikasi tersebut.
          </span>
        </div>

        {/* Table */}
        <div style={{
          background: "rgba(4,8,18,0.8)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 100px" : "1fr 110px 90px 100px 160px",
            padding: "9px 12px",
            background: "rgba(0,212,255,0.025)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(226,232,240,0.4)", textTransform: "uppercase",
          }}>
            <span
              onClick={() => toggleSort("name")}
              style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              Application <SortArr col="name" />
            </span>
            {!isMobile && (
              <span
                onClick={() => toggleSort("publisher")}
                style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                Publisher <SortArr col="publisher" />
              </span>
            )}
            {!isMobile && (
              <span
                onClick={() => toggleSort("size")}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-end" }}
              >
                Size <SortArr col="size" />
              </span>
            )}
            {!isMobile && (
              <span
                onClick={() => toggleSort("date")}
                style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                Installed <SortArr col="date" />
              </span>
            )}
            <span style={{ textAlign: "center" }}>Actions</span>
          </div>

          {/* Body */}
          <div style={{ maxHeight: 540, overflowY: "auto" }}>
            {loading ? (
              <div style={{
                display: "flex", justifyContent: "center", alignItems: "center",
                padding: 60, gap: 12, color: "rgba(226,232,240,0.35)", fontSize: "0.85rem",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00d4ff",
                  animation: "apps-spin 0.7s linear infinite",
                }} />
                Loading {total > 0 ? `${total} apps` : "installed apps"}…
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "rgba(226,232,240,0.3)" }}>
                <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>🔍</div>
                <div>{search ? `Tidak ada hasil untuk "${search}"` : "Tidak ada aplikasi ditemukan"}</div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {sorted.map(app => (
                    <AppRow
                      key={app.key}
                      app={app}
                      isMobile={isMobile}
                      onUninstall={handleUninstall}
                      uninstalling={uninstalling}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          fontSize: "0.7rem", color: "rgba(226,232,240,0.3)",
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6,
        }}>
          <span>{!loading && `Menampilkan ${sorted.length} dari ${total} aplikasi`}</span>
          {isMobile && <span>Tap baris untuk detail lengkap</span>}
        </div>
      </div>
    </>
  );
}
