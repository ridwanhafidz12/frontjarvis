"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { listFiles, getDrives, getDownloadUrl, uploadFile, deleteFile, renameFile, control } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface FileItem {
  name:      string;
  path:      string;
  is_dir:    boolean;
  size?:     number;
  modified?: string;
  error?:    string;
}

interface Drive {
  drive:    string;
  total?:   number;
  used?:    number;
  free?:    number;
  percent?: number;
  error?:   string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 ** 2)      return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)      return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "📕", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
    ppt: "📊", pptx: "📊", txt: "📄", md: "📄",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
    mp4: "🎬", mkv: "🎬", avi: "🎬", mov: "🎬",
    mp3: "🎵", wav: "🎵", flac: "🎵",
    zip: "🗜️", rar: "🗜️", "7z": "🗜️", tar: "🗜️", gz: "🗜️",
    exe: "⚙️", msi: "⚙️", bat: "⚙️", ps1: "⚙️",
    py:  "🐍", js: "🟨", ts: "🔷", json: "📋", xml: "📋", csv: "📋",
    html: "🌐", css: "🎨",
    iso: "💿", dll: "🔧", sys: "🔧",
  };
  return map[ext] ?? "📄";
}

function parentPath(path: string): string {
  const norm = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx  = norm.lastIndexOf("/");
  if (idx <= 0) return path;
  const parent = norm.slice(0, idx);
  return parent.endsWith(":") ? parent + "\\" : parent;
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

// ── Drive card ─────────────────────────────────────────────────────────────

function DriveCard({ drive, active, onClick }: {
  drive: Drive; active: boolean; onClick: () => void;
}) {
  const pct   = drive.percent ?? 0;
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#00d4ff";
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 10, padding: "9px 13px",
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", flexDirection: "column", gap: 5, minWidth: 90,
        transition: "all 0.15s", flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: "1rem" }}>💽</span>
        <span style={{
          fontSize: "0.82rem", fontWeight: 700,
          color: active ? "#00d4ff" : "#e2e8f0", fontFamily: "monospace",
        }}>
          {drive.drive}
        </span>
      </div>
      {drive.percent !== undefined && (
        <>
          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: "0.62rem", color: "rgba(226,232,240,0.4)", whiteSpace: "nowrap" }}>
            {formatSize(drive.free)} free
          </span>
        </>
      )}
    </button>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function Breadcrumb({ path, onNavigate }: {
  path: string; onNavigate: (p: string) => void;
}) {
  const parts  = path.replace(/\\/g, "/").replace(/\/+$/, "").split("/").filter(Boolean);
  const crumbs = parts.map((part, i) => {
    const fullPath = parts.slice(0, i + 1).join("\\") + (i === 0 ? "\\" : "");
    return { label: part, path: fullPath };
  });

  return (
    <div style={{
      display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2,
      fontSize: "0.75rem", color: "rgba(226,232,240,0.4)",
      overflowX: "auto", paddingBottom: 2,
    }}>
      {crumbs.map((c, i) => (
        <span key={c.path} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {i > 0 && <span style={{ opacity: 0.4, margin: "0 1px" }}>›</span>}
          <button
            onClick={() => onNavigate(c.path)}
            style={{
              background: "none", border: "none", padding: "3px 5px",
              color: i === crumbs.length - 1 ? "#e2e8f0" : "#00d4ff",
              cursor: i === crumbs.length - 1 ? "default" : "pointer",
              fontFamily: "monospace", fontSize: "0.75rem",
              fontWeight: i === crumbs.length - 1 ? 700 : 400,
              borderRadius: 4, whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ msg, onClose }: { msg: { ok: boolean; text: string }; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16, zIndex: 9900,
      background: msg.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
      border: `1px solid ${msg.ok ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
      color: msg.ok ? "#6ee7b7" : "#fca5a5",
      borderRadius: 10, padding: "10px 16px",
      fontSize: "0.83rem", fontWeight: 600,
      backdropFilter: "blur(12px)",
      animation: "ft-up 0.2s ease both",
      maxWidth: 320, display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <span style={{ flex: 1 }}>{msg.text}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}>✕</button>
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────

function RenameModal({ item, onConfirm, onClose }: {
  item: FileItem;
  onConfirm: (newName: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(item.name);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9500,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#0d1526", border: "1px solid rgba(0,212,255,0.2)",
        borderRadius: 14, padding: "24px 28px", width: "100%", maxWidth: 380,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: "0.95rem", fontWeight: 700 }}>✏️ Rename</h3>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirm(value); if (e.key === "Escape") onClose(); }}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, padding: "9px 12px", color: "#e2e8f0",
            fontSize: "0.875rem", fontFamily: "inherit", outline: "none", width: "100%",
          }}
          onFocus={e => e.currentTarget.select()}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(226,232,240,0.6)", borderRadius: 8, padding: "8px 16px",
            fontSize: "0.83rem", cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={() => onConfirm(value)} style={{
            background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
            color: "#00d4ff", borderRadius: 8, padding: "8px 16px",
            fontSize: "0.83rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>Rename</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function FilesTab() {
  const winW = useWindowWidth();
  const isMobile = winW > 0 && winW < 640;
  const isXS     = winW > 0 && winW < 420;

  const [items,        setItems]        = useState<FileItem[]>([]);
  const [drives,       setDrives]       = useState<Drive[]>([]);
  const [currentPath,  setCurrentPath]  = useState("C:\\");
  const [pathInput,    setPathInput]    = useState("C:\\");
  const [history,      setHistory]      = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [toast,        setToast]        = useState<{ ok: boolean; text: string } | null>(null);
  const [searchMode,   setSearchMode]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [searching,    setSearching]    = useState(false);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [sortBy,       setSortBy]       = useState<"name" | "size" | "modified">("name");
  const [sortAsc,      setSortAsc]      = useState(true);
  const [renameItem,   setRenameItem]   = useState<FileItem | null>(null);
  const [pathFocused,  setPathFocused]  = useState(false);
  const [showPath,     setShowPath]     = useState(false);  // mobile: show path input bar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ ok, text });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const navigate = useCallback(async (path: string, pushHistory = true) => {
    setLoading(true);
    setError("");
    setSelected(new Set());
    setSearchMode(false);
    try {
      const data = await listFiles(path) as { error?: string; items?: FileItem[] };
      if (data.error) throw new Error(data.error);
      setItems(data.items ?? []);
      if (pushHistory && path !== currentPath) {
        setHistory(prev => [...prev, currentPath]);
      }
      setCurrentPath(path);
      setPathInput(path);
      setShowPath(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDrives() as Drive[];
        setDrives(data);
      } catch { /**/ }
    })();
    navigate("C:\\", false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goBack = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    navigate(prev, false);
  };

  const goUp = () => {
    const parent = parentPath(currentPath);
    if (parent !== currentPath) navigate(parent);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadFile(file, currentPath);
      showToast(`✅ ${file.name} uploaded`);
      await navigate(currentPath, false);
    } catch (err: unknown) {
      showToast(`❌ ${err instanceof Error ? err.message : String(err)}`, false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) { navigate(currentPath, false); return; }
    setSearching(true);
    try {
      const res = await control("search_files", { query: q, dir: currentPath }) as { results?: FileItem[] };
      setItems((res?.results ?? []) as FileItem[]);
      setSearchMode(true);
      setSearchQuery(q);
      setSelected(new Set());
    } catch { /**/ }
    finally { setSearching(false); }
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Hapus "${item.name}"? Tidak bisa dibatalkan.`)) return;
    try {
      await deleteFile(item.path);
      showToast(`🗑️ "${item.name}" dihapus`);
      await navigate(currentPath, false);
    } catch (e: unknown) {
      showToast(`❌ Gagal: ${e instanceof Error ? e.message : String(e)}`, false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!renameItem || !newName.trim() || newName === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      await renameFile(renameItem.path, newName.trim());
      showToast(`✅ Renamed to "${newName}"`);
      await navigate(currentPath, false);
    } catch (e: unknown) {
      showToast(`❌ Gagal: ${e instanceof Error ? e.message : String(e)}`, false);
    } finally {
      setRenameItem(null);
    }
  };

  const sorted = [...items].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    if (sortBy === "name")     cmp = a.name.localeCompare(b.name);
    else if (sortBy === "size") cmp = (a.size ?? 0) - (b.size ?? 0);
    else cmp = (a.modified ?? "").localeCompare(b.modified ?? "");
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(v => !v);
    else { setSortBy(col); setSortAsc(true); }
  };

  const toggleSelect = (path: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const dirs  = sorted.filter(i => i.is_dir);
  const files = sorted.filter(i => !i.is_dir);

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col
      ? <span style={{ fontSize: "0.65rem", marginLeft: 3 }}>{sortAsc ? "▲" : "▼"}</span>
      : null;

  return (
    <>
      <style>{`
        @keyframes ft-up { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        .ft-row:hover { background: rgba(0,212,255,0.025) !important; }
        .ft-act-btn { display:none; }
        .ft-row:hover .ft-act-btn { display:inline-flex; }
        @media (max-width: 640px) {
          .ft-act-btn { display:inline-flex !important; }
          .ft-col-size { display:none !important; }
          .ft-col-mod  { display:none !important; }
        }
        @media (max-width: 420px) {
          .ft-col-check { display:none !important; }
        }
      `}</style>

      {/* Rename modal */}
      {renameItem && (
        <RenameModal item={renameItem} onConfirm={handleRename} onClose={() => setRenameItem(null)} />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── Drives ────────────────────────────────────────────────── */}
        {drives.length > 0 && (
          <div style={{ display: "flex", gap: 7, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
            {drives.map(d => (
              <DriveCard
                key={d.drive} drive={d}
                active={currentPath.startsWith(d.drive)}
                onClick={() => navigate(d.drive)}
              />
            ))}
          </div>
        )}

        {/* ── Navigation bar ─────────────────────────────────────────── */}
        <div style={{
          background: "rgba(6,10,22,0.7)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, padding: isMobile ? "10px 10px" : "10px 14px",
          display: "flex", flexDirection: "column", gap: 8,
        }}>

          {/* Row 1: nav buttons + path  */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>

            {/* Back */}
            <button
              onClick={goBack} disabled={history.length === 0} title="Back"
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 7, padding: "7px 10px", cursor: history.length ? "pointer" : "not-allowed",
                color: history.length ? "#e2e8f0" : "rgba(226,232,240,0.25)", fontFamily: "inherit",
                opacity: history.length ? 1 : 0.4, flexShrink: 0, minHeight: 36,
              }}>◀</button>

            {/* Up */}
            <button
              onClick={goUp} title="Parent folder"
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 7, padding: "7px 10px", cursor: "pointer",
                color: "#e2e8f0", fontFamily: "inherit", flexShrink: 0, minHeight: 36,
              }}>↑</button>

            {/* Path input — always visible on desktop; toggle-able on mobile */}
            {(!isMobile || showPath) ? (
              <>
                <input
                  value={pathInput}
                  onChange={e => setPathInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") navigate(pathInput); }}
                  onFocus={() => setPathFocused(true)}
                  onBlur={() => setPathFocused(false)}
                  style={{
                    flex: 1, minWidth: 0,
                    background: pathFocused ? "rgba(0,212,255,0.04)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${pathFocused ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.09)"}`,
                    borderRadius: 7, padding: "7px 10px",
                    color: "#e2e8f0", fontSize: isMobile ? "0.78rem" : "0.82rem",
                    fontFamily: "monospace", outline: "none",
                    transition: "border-color 0.2s",
                  }}
                />
                <button onClick={() => navigate(pathInput)} style={{
                  background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                  color: "#00d4ff", borderRadius: 7, padding: "7px 12px",
                  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  flexShrink: 0, minHeight: 36,
                }}>Go</button>
                {isMobile && (
                  <button onClick={() => setShowPath(false)} style={{
                    background: "none", border: "1px solid rgba(255,255,255,0.09)",
                    color: "rgba(226,232,240,0.5)", borderRadius: 7, padding: "7px 10px",
                    cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                  }}>✕</button>
                )}
              </>
            ) : (
              /* Mobile: show current folder name as tappable pill → opens path input */
              <button
                onClick={() => setShowPath(true)}
                style={{
                  flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 7, padding: "7px 10px",
                  color: "#e2e8f0", fontSize: "0.78rem", fontFamily: "monospace",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minHeight: 36,
                }}
                title={currentPath}
              >
                <span style={{ opacity: 0.5, flexShrink: 0 }}>📂</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentPath.split("\\").pop() || currentPath}
                </span>
                <span style={{ opacity: 0.3, marginLeft: "auto", flexShrink: 0, fontSize: "0.7rem" }}>✎</span>
              </button>
            )}

            {/* Refresh */}
            <button onClick={() => navigate(currentPath, false)} title="Refresh" style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 7, padding: "7px 10px", cursor: "pointer",
              color: "#e2e8f0", fontFamily: "inherit", flexShrink: 0, minHeight: 36,
            }}>🔄</button>

            {/* Upload */}
            <label style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
              color: "#22c55e", borderRadius: 7, padding: "7px 12px",
              fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              whiteSpace: "nowrap", flexShrink: 0, minHeight: 36,
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {uploading ? "⌛" : "📤"}
              {!isXS && (uploading ? " Uploading…" : " Upload")}
              <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
            </label>
          </div>

          {/* Breadcrumb */}
          {!searchMode && <Breadcrumb path={currentPath} onNavigate={navigate} />}
          {searchMode && (
            <div style={{ fontSize: "0.75rem", color: "#f59e0b", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>🔍 Hasil pencarian: <b>&quot;{searchQuery}&quot;</b> — {items.length} item</span>
              <button onClick={() => navigate(currentPath, false)} style={{
                background: "none", border: "none", color: "#00d4ff",
                cursor: "pointer", fontSize: "0.75rem", padding: 0,
              }}>✕ Bersihkan</button>
            </div>
          )}

          {/* Search bar */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSearch(); if (e.key === "Escape") { setSearchInput(""); navigate(currentPath, false); } }}
              placeholder="🔍 Cari file… (nama atau .ekstensi)"
              style={{
                flex: 1, minWidth: 0,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "8px 12px", color: "#e2e8f0",
                fontSize: "0.85rem", outline: "none", fontFamily: "inherit",
              }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(""); navigate(currentPath, false); }} style={{
                background: "none", border: "none", color: "rgba(226,232,240,0.4)",
                cursor: "pointer", fontSize: "1rem", padding: "0 4px", flexShrink: 0,
              }}>✕</button>
            )}
            <button
              onClick={handleSearch} disabled={searching}
              style={{
                background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                color: "#00d4ff", borderRadius: 8, padding: "8px 14px",
                fontSize: "0.8rem", fontWeight: 600, cursor: searching ? "wait" : "pointer",
                fontFamily: "inherit", flexShrink: 0,
              }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
          }}>
            ❌ {error}
          </div>
        )}

        {/* ── File list ───────────────────────────────────────────────── */}
        <div style={{
          background: "rgba(6,10,22,0.6)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {loading ? (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              padding: 60, gap: 12, color: "rgba(226,232,240,0.3)", fontSize: "0.85rem",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00d4ff",
                display: "inline-block", animation: "ft-up 0.7s linear infinite",
              }} />
              Loading…
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)" }}>
                    <th className="ft-col-check" style={{ padding: "10px 10px", textAlign: "left", width: 32 }}>
                      <input type="checkbox" style={{ accentColor: "#00d4ff" }}
                        checked={selected.size === items.length && items.length > 0}
                        onChange={() => setSelected(
                          selected.size === items.length ? new Set() : new Set(items.map(i => i.path))
                        )}
                      />
                    </th>
                    <th onClick={() => toggleSort("name")} style={{
                      padding: "10px 10px", textAlign: "left",
                      color: "rgba(226,232,240,0.5)", fontWeight: 600, cursor: "pointer", userSelect: "none",
                    }}>
                      Name <SortIcon col="name" />
                    </th>
                    <th onClick={() => toggleSort("size")} className="ft-col-size" style={{
                      padding: "10px 10px", textAlign: "right",
                      color: "rgba(226,232,240,0.5)", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                      Size <SortIcon col="size" />
                    </th>
                    <th onClick={() => toggleSort("modified")} className="ft-col-mod" style={{
                      padding: "10px 10px", textAlign: "right",
                      color: "rgba(226,232,240,0.5)", fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}>
                      Modified <SortIcon col="modified" />
                    </th>
                    <th style={{ padding: "10px 10px", textAlign: "center", color: "rgba(226,232,240,0.5)", fontWeight: 600, whiteSpace: "nowrap" }}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* Dirs */}
                  {dirs.map(item => (
                    <tr key={item.path} className="ft-row"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                      onClick={() => navigate(item.path)}
                    >
                      <td className="ft-col-check" style={{ padding: "8px 10px" }} onClick={e => { e.stopPropagation(); toggleSelect(item.path); }}>
                        <input type="checkbox" style={{ accentColor: "#00d4ff" }}
                          checked={selected.has(item.path)} onChange={() => {}} />
                      </td>
                      <td style={{ padding: "8px 10px", color: "#00d4ff", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                          <span style={{ flexShrink: 0 }}>📁</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                        </div>
                      </td>
                      <td className="ft-col-size" style={{ padding: "8px 10px", textAlign: "right", color: "rgba(226,232,240,0.2)", fontSize: "0.78rem" }}>—</td>
                      <td className="ft-col-mod" style={{ padding: "8px 10px", textAlign: "right", color: "rgba(226,232,240,0.3)", fontSize: "0.75rem" }}>{item.modified ?? "—"}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "nowrap" }}>
                          <button className="ft-act-btn" onClick={() => setRenameItem(item)} style={{
                            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                            color: "#f59e0b", borderRadius: 6, padding: "3px 8px",
                            fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit",
                            display: "inline-flex", alignItems: "center", gap: 3,
                          }}>✏️</button>
                          <button className="ft-act-btn" onClick={() => handleDelete(item)} style={{
                            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                            color: "#ef4444", borderRadius: 6, padding: "3px 8px",
                            fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit",
                            display: "inline-flex", alignItems: "center", gap: 3,
                          }}>🗑️</button>
                          <button onClick={() => navigate(item.path)} style={{
                            background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.18)",
                            color: "#00d4ff", borderRadius: 6, padding: "3px 9px",
                            fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                            display: "inline-flex", alignItems: "center",
                          }}>Open</button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Files */}
                  {files.map(item => (
                    <tr key={item.path} className="ft-row"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td className="ft-col-check" style={{ padding: "8px 10px" }}>
                        <input type="checkbox" style={{ accentColor: "#00d4ff" }}
                          checked={selected.has(item.path)}
                          onChange={() => toggleSelect(item.path)} />
                      </td>
                      <td style={{ padding: "8px 10px", color: "#e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                          <span style={{ flexShrink: 0 }}>{getFileIcon(item.name)}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                          {item.error && (
                            <span style={{ fontSize: "0.65rem", color: "#ef4444", flexShrink: 0 }}>⚠</span>
                          )}
                        </div>
                      </td>
                      <td className="ft-col-size" style={{ padding: "8px 10px", textAlign: "right", color: "rgba(226,232,240,0.45)", fontSize: "0.78rem", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {formatSize(item.size)}
                      </td>
                      <td className="ft-col-mod" style={{ padding: "8px 10px", textAlign: "right", color: "rgba(226,232,240,0.3)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                        {item.modified ?? "—"}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "nowrap" }}>
                          <button className="ft-act-btn" onClick={() => setRenameItem(item)} style={{
                            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                            color: "#f59e0b", borderRadius: 6, padding: "3px 8px",
                            fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit",
                            display: "inline-flex", alignItems: "center",
                          }}>✏️</button>
                          <button className="ft-act-btn" onClick={() => handleDelete(item)} style={{
                            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)",
                            color: "#ef4444", borderRadius: 6, padding: "3px 8px",
                            fontSize: "0.7rem", cursor: "pointer", fontFamily: "inherit",
                            display: "inline-flex", alignItems: "center",
                          }}>🗑️</button>
                          <a
                            href={getDownloadUrl(item.path)}
                            download={item.name}
                            style={{
                              background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.18)",
                              color: "#00d4ff", borderRadius: 6, padding: "3px 9px",
                              fontSize: "0.72rem", fontWeight: 600, textDecoration: "none",
                              whiteSpace: "nowrap", display: "inline-flex", alignItems: "center",
                            }}
                          >
                            {isXS ? "⬇" : "⬇ DL"}
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {sorted.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} style={{ padding: 48, textAlign: "center", color: "rgba(226,232,240,0.3)" }}>
                        <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>📂</div>
                        <div style={{ fontSize: "0.85rem" }}>
                          {searchMode ? "Tidak ada file yang cocok dengan pencarian." : "Folder ini kosong."}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.72rem", color: "rgba(226,232,240,0.35)", flexWrap: "wrap", gap: 6,
        }}>
          <span>
            📁 {dirs.length} folder · 📄 {files.length} file
            {selected.size > 0 && (
              <span style={{ color: "#00d4ff", marginLeft: 10 }}>· {selected.size} dipilih</span>
            )}
          </span>
          {!isMobile && (
            <code style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "rgba(226,232,240,0.25)" }}>
              {currentPath}
            </code>
          )}
        </div>
      </div>
    </>
  );
}