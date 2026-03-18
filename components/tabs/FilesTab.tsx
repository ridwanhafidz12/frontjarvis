"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { listFiles, getDrives, getDownloadUrl, uploadFile, control } from "@/lib/api";

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
  if (idx <= 0) return path; // already root
  const parent = norm.slice(0, idx);
  // Re-add backslash for Windows drive roots like C:
  return parent.endsWith(":") ? parent + "\\" : parent;
}

// ── Drive card ─────────────────────────────────────────────────────────────

function DriveCard({ drive, active, onClick }: {
  drive: Drive; active: boolean; onClick: () => void;
}) {
  const pct = drive.percent ?? 0;
  const color = pct > 90 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#00d4ff";

  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 10, padding: "10px 14px",
        cursor: "pointer", fontFamily: "inherit",
        display: "flex", flexDirection: "column", gap: 6, minWidth: 110,
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: "1rem" }}>💽</span>
        <span style={{
          fontSize: "0.82rem", fontWeight: 700,
          color: active ? "#00d4ff" : "#e2e8f0",
          fontFamily: "monospace",
        }}>
          {drive.drive}
        </span>
      </div>
      {drive.percent !== undefined && (
        <>
          <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: color, borderRadius: 2,
              transition: "width 0.4s",
            }} />
          </div>
          <span style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.4)" }}>
            {formatSize(drive.free)} free · {pct}% used
          </span>
        </>
      )}
    </button>
  );
}

// ── Search bar ─────────────────────────────────────────────────────────────

function SearchBar({ currentPath, onResults, onClear }: {
  currentPath: string;
  onResults: (items: FileItem[], query: string) => void;
  onClear: () => void;
}) {
  const [query,     setQuery]     = useState("");
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) { onClear(); return; }
    setSearching(true);
    try {
      const res = await control("search_files", { query: q, dir: currentPath }) as { results?: FileItem[] };
      onResults((res?.results ?? []) as FileItem[], q);
    } catch { /* silent */ }
    finally { setSearching(false); }
  };

  const handleClear = () => { setQuery(""); onClear(); };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleSearch(); if (e.key === "Escape") handleClear(); }}
        placeholder='🔍 Cari file… (nama atau .ekstensi)'
        style={{
          flex: 1, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "8px 12px",
          color: "#e2e8f0", fontSize: "0.85rem",
          outline: "none", fontFamily: "inherit",
        }}
      />
      {query && (
        <button onClick={handleClear} style={{
          background: "none", border: "none", color: "rgba(226,232,240,0.4)",
          cursor: "pointer", fontSize: "1rem", padding: "0 4px",
        }}>✕</button>
      )}
      <button
        onClick={handleSearch}
        disabled={searching}
        style={{
          background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
          color: "#00d4ff", borderRadius: 8, padding: "8px 14px",
          fontSize: "0.8rem", fontWeight: 600, cursor: searching ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {searching ? "…" : "Search"}
      </button>
    </div>
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
      display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
      fontSize: "0.78rem", color: "rgba(226,232,240,0.4)",
    }}>
      {crumbs.map((c, i) => (
        <span key={c.path} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
          <button
            onClick={() => onNavigate(c.path)}
            style={{
              background: "none", border: "none", padding: "2px 4px",
              color: i === crumbs.length - 1 ? "#e2e8f0" : "#00d4ff",
              cursor: i === crumbs.length - 1 ? "default" : "pointer",
              fontFamily: "monospace", fontSize: "0.78rem",
              fontWeight: i === crumbs.length - 1 ? 700 : 400,
            }}
          >
            {c.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function FilesTab() {
  const [items,       setItems]       = useState<FileItem[]>([]);
  const [drives,      setDrives]      = useState<Drive[]>([]);
  const [currentPath, setCurrentPath] = useState("C:\\");
  const [pathInput,   setPathInput]   = useState("C:\\");
  const [history,     setHistory]     = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [uploading,   setUploading]   = useState(false);
  const [uploadMsg,   setUploadMsg]   = useState("");
  const [searchMode,  setSearchMode]  = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [sortBy,      setSortBy]      = useState<"name" | "size" | "modified">("name");
  const [sortAsc,     setSortAsc]     = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      } catch { /* silent */ }
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
    setUploadMsg("");
    try {
      await uploadFile(file, currentPath);
      setUploadMsg(`✅ ${file.name} uploaded`);
      await navigate(currentPath, false);
    } catch (err: unknown) {
      setUploadMsg(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadMsg(""), 4000);
    }
  };

  const handleSearchResults = (results: FileItem[], query: string) => {
    setItems(results);
    setSearchMode(true);
    setSearchQuery(query);
    setSelected(new Set());
  };

  // Sorted items
  const sorted = [...items].sort((a, b) => {
    // Dirs always first
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

  const SortIcon = ({ col }: { col: typeof sortBy }) =>
    sortBy === col
      ? <span style={{ fontSize: "0.65rem", marginLeft: 3 }}>{sortAsc ? "▲" : "▼"}</span>
      : null;

  const toggleSelect = (path: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const dirs  = sorted.filter(i => i.is_dir);
  const files = sorted.filter(i => !i.is_dir);

  return (
    <>
      <style>{`
        @keyframes files-up { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        .file-row:hover { background: rgba(0,212,255,0.03) !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Drives ─────────────────────────────────────────────────── */}
        {drives.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {drives.map(d => (
              <DriveCard
                key={d.drive}
                drive={d}
                active={currentPath.startsWith(d.drive)}
                onClick={() => navigate(d.drive)}
              />
            ))}
          </div>
        )}

        {/* ── Navigation bar ─────────────────────────────────────────── */}
        <div style={{
          background: "rgba(6,10,22,0.6)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, padding: "10px 14px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {/* Top row: nav buttons + path input */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={goBack} disabled={history.length === 0} title="Back" style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 7, padding: "7px 11px", cursor: history.length ? "pointer" : "not-allowed",
              color: history.length ? "#e2e8f0" : "rgba(226,232,240,0.25)", fontFamily: "inherit",
              opacity: history.length ? 1 : 0.4,
            }}>◀</button>

            <button onClick={goUp} title="Parent folder" style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 7, padding: "7px 11px", cursor: "pointer",
              color: "#e2e8f0", fontFamily: "inherit",
            }}>↑</button>

            <input
              value={pathInput}
              onChange={e => setPathInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && navigate(pathInput)}
              style={{
                flex: 1, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 7, padding: "7px 12px",
                color: "#e2e8f0", fontSize: "0.82rem",
                fontFamily: "monospace", outline: "none",
              }}
            />

            <button onClick={() => navigate(pathInput)} style={{
              background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff", borderRadius: 7, padding: "7px 14px",
              fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Go</button>

            <button onClick={() => navigate(currentPath, false)} title="Refresh" style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 7, padding: "7px 10px", cursor: "pointer",
              color: "#e2e8f0", fontFamily: "inherit",
            }}>🔄</button>

            <label style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
              color: "#22c55e", borderRadius: 7, padding: "7px 14px",
              fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {uploading ? "⌛ Uploading…" : "📤 Upload"}
              <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
            </label>
          </div>

          {/* Breadcrumb */}
          {!searchMode && <Breadcrumb path={currentPath} onNavigate={navigate} />}
          {searchMode && (
            <div style={{ fontSize: "0.75rem", color: "#f59e0b" }}>
              🔍 Search results for: <b>"{searchQuery}"</b> — {items.length} results
              <button onClick={() => navigate(currentPath, false)} style={{
                background: "none", border: "none", color: "#00d4ff",
                cursor: "pointer", marginLeft: 10, fontSize: "0.75rem",
              }}>✕ Clear search</button>
            </div>
          )}

          {/* Search */}
          <SearchBar
            currentPath={currentPath}
            onResults={handleSearchResults}
            onClear={() => navigate(currentPath, false)}
          />
        </div>

        {/* Upload message */}
        {uploadMsg && (
          <div style={{
            padding: "8px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600,
            background: uploadMsg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${uploadMsg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: uploadMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
            animation: "files-up 0.2s ease both",
          }}>
            {uploadMsg}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
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
                display: "inline-block", animation: "files-up 0.7s linear infinite",
              }} />
              Loading…
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(0,0,0,0.25)",
                  }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", width: 32 }}>
                      <input type="checkbox" style={{ accentColor: "#00d4ff" }}
                        checked={selected.size === items.length && items.length > 0}
                        onChange={() => {
                          setSelected(
                            selected.size === items.length
                              ? new Set()
                              : new Set(items.map(i => i.path))
                          );
                        }}
                      />
                    </th>
                    <th
                      onClick={() => toggleSort("name")}
                      style={{ padding: "10px 14px", textAlign: "left",
                        color: "rgba(226,232,240,0.5)", fontWeight: 600, cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      Name <SortIcon col="name" />
                    </th>
                    <th
                      onClick={() => toggleSort("size")}
                      className="xs-hide"
                      style={{ padding: "10px 14px", textAlign: "right",
                        color: "rgba(226,232,240,0.5)", fontWeight: 600, cursor: "pointer",
                        userSelect: "none", whiteSpace: "nowrap",
                      }}
                    >
                      Size <SortIcon col="size" />
                    </th>
                    <th
                      onClick={() => toggleSort("modified")}
                      className="responsive-hide"
                      style={{ padding: "10px 14px", textAlign: "right",
                        color: "rgba(226,232,240,0.5)", fontWeight: 600, cursor: "pointer",
                        userSelect: "none", whiteSpace: "nowrap",
                      }}
                    >
                      Modified <SortIcon col="modified" />
                    </th>
                    <th style={{ padding: "10px 14px", textAlign: "center",
                      color: "rgba(226,232,240,0.5)", fontWeight: 600, whiteSpace: "nowrap",
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* Dirs */}
                  {dirs.map(item => (
                    <tr key={item.path} className="file-row"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                      onClick={() => navigate(item.path)}
                    >
                      <td style={{ padding: "9px 14px" }} onClick={e => { e.stopPropagation(); toggleSelect(item.path); }}>
                        <input type="checkbox" style={{ accentColor: "#00d4ff" }}
                          checked={selected.has(item.path)} onChange={() => {}} />
                      </td>
                      <td style={{ padding: "9px 14px", color: "#00d4ff", fontWeight: 500 }}>
                        <span style={{ marginRight: 8 }}>📁</span>
                        {item.name}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right",
                        color: "rgba(226,232,240,0.2)", fontSize: "0.78rem" }} className="xs-hide">—</td>
                      <td style={{ padding: "9px 14px", textAlign: "right",
                        color: "rgba(226,232,240,0.3)", fontSize: "0.75rem" }} className="responsive-hide">
                        {item.modified ?? "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "center" }}>
                        <button
                          onClick={e => { e.stopPropagation(); navigate(item.path); }}
                          style={{
                            background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.18)",
                            color: "#00d4ff", borderRadius: 6, padding: "3px 12px",
                            fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Files */}
                  {files.map(item => (
                    <tr key={item.path} className="file-row"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td style={{ padding: "9px 14px" }}>
                        <input type="checkbox" style={{ accentColor: "#00d4ff" }}
                          checked={selected.has(item.path)}
                          onChange={() => toggleSelect(item.path)} />
                      </td>
                      <td style={{ padding: "9px 14px", color: "#e2e8f0" }}>
                        <span style={{ marginRight: 8 }}>{getFileIcon(item.name)}</span>
                        {item.name}
                        {item.error && (
                          <span style={{ fontSize: "0.65rem", color: "#ef4444", marginLeft: 8 }}>
                            ⚠ {item.error}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right",
                        color: "rgba(226,232,240,0.45)", fontSize: "0.78rem",
                        fontFamily: "monospace", whiteSpace: "nowrap",
                      }} className="xs-hide">
                        {formatSize(item.size)}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right",
                        color: "rgba(226,232,240,0.3)", fontSize: "0.75rem", whiteSpace: "nowrap",
                      }} className="responsive-hide">
                        {item.modified ?? "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "center" }}>
                        <a
                          href={getDownloadUrl(item.path)}
                          download={item.name}
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.18)",
                            color: "#00d4ff", borderRadius: 6, padding: "3px 12px",
                            fontSize: "0.72rem", fontWeight: 600, textDecoration: "none",
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⬇ Download
                        </a>
                      </td>
                    </tr>
                  ))}

                  {/* Empty state */}
                  {sorted.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} style={{ padding: 48, textAlign: "center",
                        color: "rgba(226,232,240,0.3)" }}>
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

        {/* ── Footer bar ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.72rem", color: "rgba(226,232,240,0.35)", flexWrap: "wrap", gap: 6,
        }}>
          <span>
            📁 {dirs.length} folder · 📄 {files.length} file
            {selected.size > 0 && (
              <span style={{ color: "#00d4ff", marginLeft: 10 }}>
                · {selected.size} dipilih
              </span>
            )}
          </span>
          <code style={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
            {currentPath}
          </code>
        </div>
      </div>
    </>
  );
}