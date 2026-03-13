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
          <button key={d.drive} className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 12px" }}
            onClick={() => navigate(d.drive)}>
            💽 {d.drive} {d.percent ? `(${d.percent}%)` : ""}
          </button>
        ))}
      </div>

      {/* Navigation bar */}
      <div className="jarvis-card" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn-primary" style={{ padding: "4px 10px", fontSize: "0.8rem" }}
            onClick={goBack} disabled={history.length === 0}>◀ Back</button>
          <button className="btn-primary" style={{ padding: "4px 10px", fontSize: "0.8rem" }}
            onClick={goUp}>↑ Up</button>
          <input
            className="jarvis-input" value={currentPath}
            onChange={e => setCurrentPath(e.target.value)}
            onKeyDown={e => e.key === "Enter" && navigate(currentPath)}
            style={{ flex: 1, fontSize: "0.85rem", fontFamily: "monospace" }}
            placeholder="Enter path..."
          />
          <button className="btn-primary" style={{ padding: "4px 12px" }}
            onClick={() => navigate(currentPath)}>Go</button>
          <label className="btn-success" style={{ cursor: "pointer" }}>
            {uploading ? "⏳" : "📤 Upload"}
            <input type="file" hidden onChange={handleUpload} />
          </label>
          <button className="btn-primary" style={{ padding: "4px 10px" }}
            onClick={() => navigate(currentPath)}>🔄</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: "0.875rem" }}>
          ❌ {error}
        </div>
      )}

      {/* File list */}
      <div className="jarvis-card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "rgba(226,232,240,0.5)", fontWeight: 500 }}>Name</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(226,232,240,0.5)", fontWeight: 500 }}>Size</th>
                  <th style={{ padding: "10px 16px", textAlign: "right", color: "rgba(226,232,240,0.5)", fontWeight: 500 }}>Modified</th>
                  <th style={{ padding: "10px 16px", textAlign: "center", color: "rgba(226,232,240,0.5)", fontWeight: 500 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dirs.map(item => (
                  <tr key={item.path} style={{ borderBottom: "1px solid rgba(0,212,255,0.05)", cursor: "pointer" }}
                    className="glass-hover" onClick={() => navigate(item.path)}>
                    <td style={{ padding: "8px 16px", color: "#00d4ff" }}>📁 {item.name}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", color: "rgba(226,232,240,0.3)" }}>—</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", color: "rgba(226,232,240,0.3)", fontSize: "0.75rem" }}>{item.modified}</td>
                    <td style={{ padding: "8px 16px", textAlign: "center" }}>
                      <button className="btn-primary" style={{ fontSize: "0.7rem", padding: "2px 8px" }}
                        onClick={e => { e.stopPropagation(); navigate(item.path); }}>Open</button>
                    </td>
                  </tr>
                ))}
                {files.map(item => (
                  <tr key={item.path} style={{ borderBottom: "1px solid rgba(0,212,255,0.05)" }}>
                    <td style={{ padding: "8px 16px", color: "#e2e8f0" }}>📄 {item.name}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", color: "rgba(226,232,240,0.4)", fontSize: "0.8rem" }}>{formatSize(item.size)}</td>
                    <td style={{ padding: "8px 16px", textAlign: "right", color: "rgba(226,232,240,0.3)", fontSize: "0.75rem" }}>{item.modified}</td>
                    <td style={{ padding: "8px 16px", textAlign: "center" }}>
                      <a href={getDownloadUrl(item.path)} download={item.name}
                        className="btn-primary" style={{ fontSize: "0.7rem", padding: "2px 8px", textDecoration: "none" }}>
                        ⬇ Download
                      </a>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "rgba(226,232,240,0.3)" }}>
                      (empty directory)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div style={{ fontSize: "0.75rem", color: "rgba(226,232,240,0.4)" }}>
        {dirs.length} folders, {files.length} files
      </div>
    </div>
  );
}
