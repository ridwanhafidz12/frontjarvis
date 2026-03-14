"use client";
import { useState, useEffect } from "react";
import { listFiles, getDrives, getDownloadUrl, uploadFile } from "@/lib/api";

interface FileItem { name: string; path: string; is_dir: boolean; size?: number; modified?: string; error?: string }
interface Drive { drive: string; total?: number; used?: number; free?: number; percent?: number }

function formatSize(bytes?: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function FilesTab() {
  const [items, setItems] = useState<FileItem[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [currentPath, setCurrentPath] = useState("C:\\");
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDrives();
    navigate("C:\\");
  }, []);

  const fetchDrives = async () => {
    try {
      const data = await getDrives();
      setDrives(data);
    } catch {}
  };

  const navigate = async (path: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await listFiles(path);
      if (data.error) throw new Error(data.error);
      setItems(data.items || []);
      if (path !== currentPath) {
        setHistory(prev => [...prev, currentPath]);
      }
      setCurrentPath(path);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      navigate(prev);
    }
  };

  const goUp = () => {
    const parts = currentPath.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    const parent = parts.join("\\") + "\\";
    navigate(parent);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadFile(file, currentPath);
      navigate(currentPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const dirs = items.filter(i => i.is_dir);
  const files = items.filter(i => !i.is_dir);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Drives */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {drives.map(d => (
          <button key={d.drive} className="btn-primary" style={{ fontSize: "0.75rem", padding: "6px 14px", borderRadius: 20 }}
            onClick={() => navigate(d.drive)}>
            💽 {d.drive} {d.percent ? `(${d.percent}%)` : ""}
          </button>
        ))}
      </div>

      {/* Navigation bar */}
      <div className="jarvis-card" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn-primary" style={{ padding: "6px 12px", borderRadius: 8 }}
              onClick={goBack} disabled={history.length === 0}>◀</button>
            <button className="btn-primary" style={{ padding: "6px 12px", borderRadius: 8 }}
              onClick={goUp}>↑</button>
          </div>
          <input
            className="jarvis-input" value={currentPath}
            onChange={e => setCurrentPath(e.target.value)}
            onKeyDown={e => e.key === "Enter" && navigate(currentPath)}
            style={{ flex: 1, minWidth: 200, fontSize: "0.85rem", fontFamily: "monospace" }}
            placeholder="Enter path..."
          />
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn-primary" style={{ padding: "6px 14px" }}
              onClick={() => navigate(currentPath)}>Go</button>
            <label className="btn-success" style={{ cursor: "pointer", padding: "6px 14px", borderRadius: 8 }}>
              {uploading ? "⌛" : "📤 Upload"}
              <input type="file" hidden onChange={handleUpload} />
            </label>
            <button className="btn-primary" style={{ padding: "6px 12px" }}
              onClick={() => navigate(currentPath)}>🔄</button>
          </div>
        </div>
      </div>

      {error && (
        <div className="fade-in" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: "0.9rem", fontWeight: 500 }}>
          ❌ {error}
        </div>
      )}

      {/* File list */}
      <div className="jarvis-card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.1)", background: "rgba(0,212,255,0.02)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(226,232,240,0.5)", fontWeight: 600 }}>Name</th>
                  <th className="responsive-hide" style={{ padding: "12px 16px", textAlign: "right", color: "rgba(226,232,240,0.5)", fontWeight: 600 }}>Size</th>
                  <th className="responsive-hide" style={{ padding: "12px 16px", textAlign: "right", color: "rgba(226,232,240,0.5)", fontWeight: 600 }}>Modified</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", color: "rgba(226,232,240,0.5)", fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dirs.map(item => (
                  <tr key={item.path} style={{ borderBottom: "1px solid rgba(0,212,255,0.05)", cursor: "pointer" }}
                    className="glass-hover" onClick={() => navigate(item.path)}>
                    <td style={{ padding: "10px 16px", color: "#00d4ff", fontWeight: 500 }}>📁 {item.name}</td>
                    <td className="responsive-hide" style={{ padding: "10px 16px", textAlign: "right", color: "rgba(226,232,240,0.2)" }}>—</td>
                    <td className="responsive-hide" style={{ padding: "10px 16px", textAlign: "right", color: "rgba(226,232,240,0.3)", fontSize: "0.75rem" }}>{item.modified}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      <button className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 12px" }}
                        onClick={e => { e.stopPropagation(); navigate(item.path); }}>Open</button>
                    </td>
                  </tr>
                ))}
                {files.map(item => (
                  <tr key={item.path} style={{ borderBottom: "1px solid rgba(0,212,255,0.05)" }}>
                    <td style={{ padding: "10px 16px", color: "#e2e8f0" }}>📄 {item.name}</td>
                    <td className="responsive-hide" style={{ padding: "10px 16px", textAlign: "right", color: "rgba(226,232,240,0.4)", fontSize: "0.8rem" }}>{formatSize(item.size)}</td>
                    <td className="responsive-hide" style={{ padding: "10px 16px", textAlign: "right", color: "rgba(226,232,240,0.3)", fontSize: "0.75rem" }}>{item.modified}</td>
                    <td style={{ padding: "10px 16px", textAlign: "center" }}>
                      <a href={getDownloadUrl(item.path)} download={item.name}
                        className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 12px", textDecoration: "none" }}>
                        ⬇ Download
                      </a>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: "center", color: "rgba(226,232,240,0.3)" }}>
                      <div style={{ fontSize: "2rem", marginBottom: 8 }}>📁</div>
                      No files found in this directory.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ fontSize: "0.8rem", color: "rgba(226,232,240,0.4)", display: "flex", justifyContent: "space-between" }}>
        <span>{dirs.length} folders, {files.length} files</span>
        <span>{currentPath}</span>
      </div>
    </div>
  );
}
