"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getApiBase, getToken } from "@/lib/api";

interface StartupItem {
  name:     string;
  command:  string;
  source:   string;
  enabled:  boolean;
  hive:     string;
  reg_path: string;
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

export default function StartupTab() {
  const [items,    setItems]    = useState<StartupItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [toast,    setToast]    = useState<{ msg: string; err: boolean } | null>(null);
  const [busyKey,  setBusyKey]  = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, err = false) => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, err });
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/startup") as { items: StartupItem[] };
      setItems(data.items || []);
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item: StartupItem) => {
    const key = `${item.hive}:${item.name}`;
    setBusyKey(key);
    try {
      await apiRequest("/api/startup/toggle", {
        method: "POST",
        body: JSON.stringify({ name: item.name, hive: item.hive, enable: !item.enabled }),
      });
      showToast(item.enabled
        ? `⏸️ "${item.name}" dinonaktifkan dari startup`
        : `▶️ "${item.name}" diaktifkan kembali`
      );
      setItems(prev => prev.map(i =>
        i.name === item.name && i.hive === item.hive
          ? { ...i, enabled: !i.enabled }
          : i
      ));
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (item: StartupItem) => {
    if (!confirm(`Hapus "${item.name}" dari startup registry?\nIni tidak dapat diurungkan kecuali install ulang.`)) return;
    const key = `${item.hive}:${item.name}`;
    setBusyKey(key);
    try {
      await apiRequest("/api/startup/delete", {
        method: "POST",
        body: JSON.stringify({ name: item.name, hive: item.hive, reg_path: item.reg_path }),
      });
      showToast(`🗑️ "${item.name}" dihapus dari startup`);
      setItems(prev => prev.filter(i => !(i.name === item.name && i.hive === item.hive)));
    } catch (e: unknown) {
      showToast(`❌ ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusyKey(null);
    }
  };

  const filtered = items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.command.toLowerCase().includes(search.toLowerCase())
  );

  const enabled  = filtered.filter(i => i.enabled).length;
  const disabled = filtered.filter(i => !i.enabled).length;

  return (
    <>
      <style>{`
        @keyframes su-fade { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
        @keyframes su-spin { to{transform:rotate(360deg);} }
        .su-row { transition: background 0.12s; }
        .su-row:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>

      {toast && (
        <div style={{
          position: "fixed", bottom: 80, right: 16, zIndex: 9999,
          background: toast.err ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
          border: `1px solid ${toast.err ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
          color: toast.err ? "#fca5a5" : "#6ee7b7",
          borderRadius: 10, padding: "10px 16px",
          fontSize: "0.83rem", fontWeight: 600, backdropFilter: "blur(12px)",
          animation: "su-fade 0.2s ease both", maxWidth: 360,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "su-fade 0.35s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
              🚀 Startup Manager
            </h2>
            <p style={{ fontSize: "0.72rem", color: "rgba(226,232,240,0.35)", marginTop: 3 }}>
              {loading ? "Memuat…" : `${items.length} startup entries · ${enabled} aktif · ${disabled} nonaktif`}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Cari…"
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "7px 12px", color: "#e2e8f0",
                fontSize: "0.82rem", outline: "none", fontFamily: "inherit", width: 180,
              }}
            />
            <button onClick={load} disabled={loading} style={{
              background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
              color: "#00d4ff", borderRadius: 8, padding: "7px 13px",
              fontSize: "0.8rem", cursor: loading ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit",
            }}>
              <span style={{ animation: loading ? "su-spin 0.7s linear infinite" : "none", display: "inline-block" }}>🔄</span>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Total Entries", value: items.length, color: "#00d4ff" },
            { label: "✅ Aktif",  value: items.filter(i=>i.enabled).length,  color: "#10b981" },
            { label: "⏸️ Disabled", value: items.filter(i=>!i.enabled).length, color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color, fontFamily: "monospace" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div style={{
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 10, padding: "10px 14px",
          fontSize: "0.78rem", color: "rgba(239,68,68,0.7)",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <span>
            <strong>Hati-hati:</strong> Menonaktifkan atau menghapus startup entry Windows penting bisa menyebabkan masalah.
            Hanya nonaktifkan program yang kamu kenal. Perubahan efektif setelah <strong>restart PC target</strong>.
          </span>
        </div>

        {/* Table */}
        <div style={{
          background: "rgba(4,8,18,0.8)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, overflow: "hidden",
        }}>
          {loading ? (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              padding: 52, gap: 12, color: "rgba(226,232,240,0.35)",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                border: "2px solid rgba(0,212,255,0.3)", borderTopColor: "#00d4ff",
                animation: "su-spin 0.7s linear infinite",
              }} />
              Membaca registry startup…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "rgba(226,232,240,0.3)", fontSize: "0.875rem" }}>
              {search ? `Tidak ada hasil untuk "${search}"` : "Tidak ada startup entries"}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,212,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th style={{ padding: "9px 12px", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "9px 12px", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase" }}>Name</th>
                  <th style={{ padding: "9px 12px", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase" }}>Command</th>
                  <th style={{ padding: "9px 12px", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase" }}>Source</th>
                  <th style={{ padding: "9px 12px", textAlign: "center", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(226,232,240,0.4)", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const key    = `${item.hive}:${item.name}`;
                  const busy   = busyKey === key;
                  return (
                    <tr key={key} className="su-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {/* Status dot */}
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: item.enabled ? "#10b981" : "rgba(255,255,255,0.15)",
                          margin: "0 auto",
                          boxShadow: item.enabled ? "0 0 8px rgba(16,185,129,0.4)" : "none",
                        }} />
                      </td>

                      {/* Name */}
                      <td style={{ padding: "9px 12px", maxWidth: 180 }}>
                        <div style={{
                          fontSize: "0.82rem", fontWeight: 600,
                          color: item.enabled ? "#e2e8f0" : "rgba(226,232,240,0.35)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }} title={item.name}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(226,232,240,0.3)", marginTop: 1 }}>
                          {item.hive}
                        </div>
                      </td>

                      {/* Command */}
                      <td style={{ padding: "9px 12px", maxWidth: 300 }}>
                        <div style={{
                          fontSize: "0.7rem", color: "rgba(226,232,240,0.35)",
                          fontFamily: "monospace", overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }} title={item.command}>
                          {item.command}
                        </div>
                      </td>

                      {/* Source */}
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 600,
                          background: item.hive === "HKCU" ? "rgba(124,58,237,0.12)" : "rgba(0,212,255,0.1)",
                          border: `1px solid ${item.hive === "HKCU" ? "rgba(124,58,237,0.25)" : "rgba(0,212,255,0.2)"}`,
                          color: item.hive === "HKCU" ? "#a78bfa" : "#00d4ff",
                          borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap",
                        }}>
                          {item.hive}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "9px 8px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                          {/* Toggle */}
                          <button
                            onClick={() => toggle(item)}
                            disabled={!!busyKey}
                            title={item.enabled ? "Nonaktifkan" : "Aktifkan kembali"}
                            style={{
                              background: item.enabled ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                              border: `1px solid ${item.enabled ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.25)"}`,
                              color: item.enabled ? "#f59e0b" : "#10b981",
                              borderRadius: 6, padding: "4px 9px",
                              fontSize: "0.72rem", fontWeight: 600,
                              cursor: busyKey ? "not-allowed" : "pointer",
                              fontFamily: "inherit",
                              opacity: busyKey && !busy ? 0.4 : 1,
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            {busy ? (
                              <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "su-spin 0.6s linear infinite" }} />
                            ) : item.enabled ? "⏸️ Disable" : "▶️ Enable"}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => remove(item)}
                            disabled={!!busyKey}
                            title="Hapus dari registry"
                            style={{
                              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                              color: "#ef4444", borderRadius: 6, padding: "4px 8px",
                              fontSize: "0.72rem", cursor: busyKey ? "not-allowed" : "pointer",
                              fontFamily: "inherit", opacity: busyKey && !busy ? 0.4 : 1,
                              display: "flex", alignItems: "center",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.3)" }}>
          Menampilkan {filtered.length} dari {items.length} startup entries · HKCU = user, HKLM = sistem
        </div>
      </div>
    </>
  );
}
