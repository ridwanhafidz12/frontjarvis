"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { getApiBase, getToken } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

type VaultType = "note" | "contact" | "reminder" | "snippet" | "all";

interface VaultItem {
  id:         string;
  type:       VaultType;
  title:      string;
  content:    string;
  tags:       string[];
  created_at: string;
  updated_at: string;
  pinned?:    boolean;
  reminder_at?: string;  // ISO datetime for reminders
}

interface VaultStats {
  total:    number;
  notes:    number;
  contacts: number;
  reminders:number;
  snippets: number;
}

// ── API helpers ────────────────────────────────────────────────────────────

async function vaultApi(action: string, params: Record<string, unknown> = {}) {
  const base  = getApiBase();
  const token = getToken();
  const resp  = await fetch(`${base}/api/control`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ action, params }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json() as { error?: string; [k: string]: unknown };
  if (data.error) throw new Error(data.error);
  return data;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_META: Record<VaultType, { icon: string; label: string; color: string; bg: string }> = {
  note:     { icon: "📝", label: "Catatan",  color: "#00d4ff", bg: "rgba(0,212,255,0.08)"   },
  contact:  { icon: "👤", label: "Kontak",   color: "#22c55e", bg: "rgba(34,197,94,0.08)"   },
  reminder: { icon: "⏰", label: "Reminder", color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
  snippet:  { icon: "💻", label: "Kode",     color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  all:      { icon: "📦", label: "Semua",    color: "#e2e8f0", bg: "rgba(255,255,255,0.04)" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000)  return "Baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)} jam lalu`;
  return d.toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" });
}

function isReminderOverdue(item: VaultItem) {
  if (item.type !== "reminder" || !item.reminder_at) return false;
  return new Date(item.reminder_at) < new Date();
}

// ── Item card ──────────────────────────────────────────────────────────────

function ItemCard({
  item, onEdit, onDelete, onPin,
}: {
  item:     VaultItem;
  onEdit:   (item: VaultItem) => void;
  onDelete: (id: string) => void;
  onPin:    (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta     = TYPE_META[item.type];
  const overdue  = isReminderOverdue(item);
  const preview  = item.content.length > 120
    ? item.content.slice(0, 120) + "…"
    : item.content;

  return (
    <div style={{
      background:    "rgba(6,10,22,0.7)",
      border:        `1px solid ${overdue ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.07)"}`,
      borderLeft:    `3px solid ${overdue ? "#ef4444" : meta.color}`,
      borderRadius:  10,
      padding:       "12px 14px",
      transition:    "border-color 0.15s",
      animation:     "vault-up 0.2s ease both",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: meta.bg, border: `1px solid ${meta.color}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.9rem",
        }}>
          {meta.icon}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {item.pinned && <span style={{ marginRight: 4 }}>📌</span>}
              {overdue && <span style={{ marginRight: 4 }}>🔴</span>}
              {item.title}
            </span>
            <span style={{
              fontSize: "0.62rem", padding: "1px 7px", borderRadius: 10,
              background: meta.bg, color: meta.color, fontWeight: 600,
              border: `1px solid ${meta.color}25`,
            }}>
              {meta.label}
            </span>
          </div>
          <div style={{ fontSize: "0.68rem", color: "rgba(226,232,240,0.3)", marginTop: 2 }}>
            {formatDate(item.updated_at)}
            {item.reminder_at && (
              <span style={{ marginLeft: 8, color: overdue ? "#ef4444" : "#f59e0b" }}>
                ⏰ {new Date(item.reminder_at).toLocaleString("id-ID", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onPin(item.id)} title={item.pinned ? "Unpin" : "Pin"}
            style={{ background: "none", border: "none", cursor: "pointer",
              color: item.pinned ? "#f59e0b" : "rgba(226,232,240,0.3)",
              fontSize: "0.85rem", padding: "2px 4px" }}>
            📌
          </button>
          <button onClick={() => onEdit(item)} title="Edit"
            style={{ background: "none", border: "none", cursor: "pointer",
              color: "rgba(0,212,255,0.5)", fontSize: "0.8rem", padding: "2px 4px" }}>
            ✏️
          </button>
          <button onClick={() => onDelete(item.id)} title="Hapus"
            style={{ background: "none", border: "none", cursor: "pointer",
              color: "rgba(239,68,68,0.5)", fontSize: "0.8rem", padding: "2px 4px" }}>
            🗑
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: 10, paddingLeft: 42 }}>
        {item.type === "snippet" ? (
          <pre style={{
            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6, padding: "8px 10px",
            fontFamily: "monospace", fontSize: "0.72rem",
            color: "#a78bfa", whiteSpace: "pre-wrap",
            maxHeight: expanded ? 400 : 80, overflowY: "auto",
            margin: 0,
          }}>
            {item.content}
          </pre>
        ) : (
          <p style={{
            fontSize: "0.8rem", color: "rgba(226,232,240,0.65)",
            lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap",
          }}>
            {expanded ? item.content : preview}
          </p>
        )}

        {item.content.length > 120 && item.type !== "snippet" && (
          <button onClick={() => setExpanded(v => !v)} style={{
            background: "none", border: "none", color: meta.color,
            fontSize: "0.7rem", cursor: "pointer", marginTop: 4,
            fontFamily: "inherit", padding: 0,
          }}>
            {expanded ? "▲ Ringkas" : "▼ Tampilkan semua"}
          </button>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {item.tags.map(tag => (
              <span key={tag} style={{
                fontSize: "0.62rem", padding: "1px 7px", borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(226,232,240,0.45)",
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────

function ItemModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<VaultItem>;
  onSave:   (data: Partial<VaultItem>) => Promise<void>;
  onClose:  () => void;
}) {
  const [type,        setType]        = useState<VaultType>(initial?.type || "note");
  const [title,       setTitle]       = useState(initial?.title || "");
  const [content,     setContent]     = useState(initial?.content || "");
  const [tags,        setTags]        = useState((initial?.tags || []).join(", "));
  const [reminderAt,  setReminderAt]  = useState(
    initial?.reminder_at
      ? new Date(initial.reminder_at).toISOString().slice(0,16)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleSave = async () => {
    if (!title.trim())   { setError("Judul tidak boleh kosong."); return; }
    if (!content.trim()) { setError("Isi tidak boleh kosong.");   return; }
    setSaving(true);
    try {
      await onSave({
        ...(initial?.id ? { id: initial.id } : {}),
        type,
        title:       title.trim(),
        content:     content.trim(),
        tags:        tags.split(",").map(t => t.trim()).filter(Boolean),
        reminder_at: reminderAt || undefined,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "9px 12px",
    color: "#e2e8f0", fontSize: "0.85rem",
    fontFamily: "inherit", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.68rem", color: "rgba(226,232,240,0.4)",
    textTransform: "uppercase", letterSpacing: "0.08em",
    marginBottom: 5, display: "block",
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "rgba(8,12,26,0.99)",
        border: "1px solid rgba(0,212,255,0.2)",
        borderRadius: 14, padding: 24,
        width: "100%", maxWidth: 500,
        display: "flex", flexDirection: "column", gap: 14,
        boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        animation: "vault-up 0.2s ease both",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
            {initial?.id ? "✏️ Edit Item" : "➕ Tambah Data Baru"}
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(226,232,240,0.4)",
            cursor: "pointer", fontSize: "1.2rem",
          }}>✕</button>
        </div>

        {/* Type selector */}
        <div>
          <span style={labelStyle}>Tipe</span>
          <div style={{ display: "flex", gap: 6 }}>
            {(["note","contact","reminder","snippet"] as const).map(t => {
              const m = TYPE_META[t];
              return (
                <button key={t} onClick={() => setType(t)} style={{
                  flex: 1, background: type===t ? m.bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${type===t ? m.color+"44" : "rgba(255,255,255,0.08)"}`,
                  color: type===t ? m.color : "rgba(226,232,240,0.4)",
                  borderRadius: 8, padding: "7px 4px",
                  fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}>
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <span style={labelStyle}>
            {type === "contact" ? "Nama Kontak" : "Judul"}
          </span>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder={type === "contact" ? "Nama orang/organisasi" : "Judul singkat"}
            style={inputStyle} autoFocus/>
        </div>

        {/* Content */}
        <div>
          <span style={labelStyle}>
            {type === "contact" ? "Detail (nomor, email, alamat, dll)" :
             type === "reminder" ? "Isi Reminder" :
             type === "snippet" ? "Kode" : "Catatan"}
          </span>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={
              type === "contact" ? "Nomor: 08xxx\nEmail: xxx@gmail.com\nAlamat: Jl. xxx" :
              type === "snippet" ? "// Tulis kode di sini..." :
              "Tulis isi di sini..."
            }
            rows={type === "snippet" ? 6 : 4}
            style={{ ...inputStyle, resize: "vertical", fontFamily: type==="snippet"?"monospace":"inherit" }}/>
        </div>

        {/* Reminder datetime */}
        {type === "reminder" && (
          <div>
            <span style={labelStyle}>Tanggal & Jam Reminder (opsional)</span>
            <input type="datetime-local" value={reminderAt}
              onChange={e => setReminderAt(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}/>
          </div>
        )}

        {/* Tags */}
        <div>
          <span style={labelStyle}>Tags (pisah dengan koma)</span>
          <input value={tags} onChange={e => setTags(e.target.value)}
            placeholder="pekerjaan, penting, pribadi"
            style={inputStyle}/>
        </div>

        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 7,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444", fontSize: "0.78rem",
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(226,232,240,0.5)", borderRadius: 8, padding: "9px 18px",
            fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit",
          }}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={{
            background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
            color: "#00d4ff", borderRadius: 8, padding: "9px 20px",
            fontSize: "0.82rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: saving ? 0.6 : 1,
          }}>
            {saving ? "Menyimpan…" : initial?.id ? "💾 Update" : "➕ Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main VaultTab ──────────────────────────────────────────────────────────

export default function VaultTab() {
  const [items,      setItems]      = useState<VaultItem[]>([]);
  const [stats,      setStats]      = useState<VaultStats>({ total:0, notes:0, contacts:0, reminders:0, snippets:0 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [activeType, setActiveType] = useState<VaultType>("all");
  const [search,     setSearch]     = useState("");
  const [sortBy,     setSortBy]     = useState<"updated"|"created"|"title">("updated");
  const [showModal,  setShowModal]  = useState(false);
  const [editItem,   setEditItem]   = useState<VaultItem | undefined>(undefined);
  const [toast,      setToast]      = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ── Fetch all items ──────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await vaultApi("vault_list", { type: "all" }) as {
        items?: VaultItem[];
        stats?: VaultStats;
      };
      setItems(data.items || []);
      if (data.stats) setStats(data.stats);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Filter + sort ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = [...items];
    if (activeType !== "all") result = result.filter(i => i.type === activeType);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sortBy === "title")   return a.title.localeCompare(b.title);
      if (sortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return result;
  }, [items, activeType, search, sortBy]);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const handleSave = async (data: Partial<VaultItem>) => {
    if (data.id) {
      await vaultApi("vault_update", data);
      showToast("✅ Item diupdate");
    } else {
      await vaultApi("vault_save", data);
      showToast("✅ Item disimpan");
    }
    await fetchItems();
    setEditItem(undefined);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Hapus item ini?")) return;
    await vaultApi("vault_delete", { id });
    showToast("🗑 Item dihapus");
    await fetchItems();
  };

  const handlePin = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    await vaultApi("vault_update", { id, pinned: !item.pinned });
    await fetchItems();
  };

  const openAdd  = () => { setEditItem(undefined); setShowModal(true); };
  const openEdit = (item: VaultItem) => { setEditItem(item); setShowModal(true); };

  // Overdue reminders count
  const overdueCount = items.filter(isReminderOverdue).length;

  return (
    <>
      <style>{`
        @keyframes vault-up { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;} }
      `}</style>

      {/* Modals */}
      {showModal && (
        <ItemModal
          initial={editItem}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditItem(undefined); }}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#e2e8f0", margin: "0 0 3px" }}>
              🔐 JARVIS Vault
            </h2>
            <p style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.35)", margin: 0 }}>
              Simpan data penting · akses kapanpun · sync cloud
              {overdueCount > 0 && (
                <span style={{ color: "#ef4444", marginLeft: 8 }}>
                  · ⚠️ {overdueCount} reminder jatuh tempo
                </span>
              )}
            </p>
          </div>
          <button onClick={openAdd} style={{
            background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
            color: "#00d4ff", borderRadius: 8, padding: "8px 16px",
            fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          }}>
            ➕ Tambah
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            padding: "9px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600,
            background: toast.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${toast.startsWith("✅") ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            color: toast.startsWith("✅") ? "#22c55e" : "#ef4444",
            animation: "vault-up 0.2s ease both",
          }}>{toast}</div>
        )}

        {/* ── Stats cards ──────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px,1fr))", gap: 10 }}>
          {([
            { key: "total",     label: "Total",     icon: "📦", color: "#e2e8f0" },
            { key: "notes",     label: "Catatan",   icon: "📝", color: "#00d4ff" },
            { key: "contacts",  label: "Kontak",    icon: "👤", color: "#22c55e" },
            { key: "reminders", label: "Reminder",  icon: "⏰", color: "#f59e0b" },
            { key: "snippets",  label: "Kode",      icon: "💻", color: "#a78bfa" },
          ] as Array<{key:keyof VaultStats;label:string;icon:string;color:string}>).map(s => (
            <div key={s.key} style={{
              background: "rgba(6,10,22,0.6)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "12px", textAlign: "center",
              cursor: "pointer",
              borderTop: activeType === (s.key === "total" ? "all" : s.key.replace("s","") as VaultType)
                ? `2px solid ${s.color}` : "1px solid rgba(255,255,255,0.07)",
            }} onClick={() => setActiveType(
              s.key === "total" ? "all" : s.key.replace("s","") as VaultType
            )}>
              <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: s.color, fontFamily: "monospace" }}>
                {stats[s.key]}
              </div>
              <div style={{ fontSize: "0.62rem", color: "rgba(226,232,240,0.35)", marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Search + filters ─────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Cari judul, isi, atau tag..."
            style={{
              flex: 1, minWidth: 180,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "8px 12px",
              color: "#e2e8f0", fontSize: "0.82rem",
              fontFamily: "inherit", outline: "none",
            }}/>

          {/* Type tabs */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden" }}>
            {(["all","note","contact","reminder","snippet"] as VaultType[]).map(t => {
              const m = TYPE_META[t];
              return (
                <button key={t} onClick={() => setActiveType(t)} style={{
                  fontSize: "0.68rem", padding: "6px 10px", border: "none",
                  background: activeType===t ? m.bg : "transparent",
                  color: activeType===t ? m.color : "rgba(226,232,240,0.4)",
                  fontWeight: activeType===t ? 700 : 400,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>
                  {m.icon} {m.label}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "6px 10px", color: "rgba(226,232,240,0.6)",
              fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit", outline: "none",
            }}>
            <option value="updated">Terbaru diubah</option>
            <option value="created">Terbaru dibuat</option>
            <option value="title">Judul A-Z</option>
          </select>

          <button onClick={fetchItems} disabled={loading} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
            color: "rgba(226,232,240,0.5)", borderRadius: 8, padding: "6px 10px",
            fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit",
          }}>🔄</button>
        </div>

        {/* ── Items list ───────────────────────────────────────────── */}
        {error && (
          <div style={{ padding:"10px 14px", borderRadius:8, fontSize:"0.8rem",
            background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)",
            color:"#ef4444" }}>
            ❌ {error} — pastikan JARVIS berjalan dan vault_manager.py sudah terpasang.
          </div>
        )}

        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center",
            padding:60, gap:12, color:"rgba(226,232,240,0.3)", fontSize:"0.85rem" }}>
            <span style={{ width:20, height:20, borderRadius:"50%",
              border:"2px solid rgba(0,212,255,0.3)", borderTopColor:"#00d4ff",
              display:"inline-block", animation:"vault-up 0.7s linear infinite" }}/>
            Memuat vault...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:48,
            color:"rgba(226,232,240,0.3)", fontSize:"0.85rem" }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>
              {search ? "🔍" : TYPE_META[activeType].icon}
            </div>
            <div>
              {search
                ? `Tidak ada hasil untuk "${search}"`
                : activeType === "all"
                  ? "Vault kosong. Klik ➕ Tambah atau minta JARVIS menyimpan sesuatu via chat."
                  : `Belum ada ${TYPE_META[activeType].label.toLowerCase()} tersimpan.`}
            </div>
            {!search && (
              <button onClick={openAdd} style={{
                marginTop:16, background:"rgba(0,212,255,0.08)",
                border:"1px solid rgba(0,212,255,0.2)", color:"#00d4ff",
                borderRadius:8, padding:"8px 18px", fontSize:"0.8rem",
                cursor:"pointer", fontFamily:"inherit",
              }}>➕ Tambah sekarang</button>
            )}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {/* Result count */}
            <div style={{ fontSize:"0.68rem", color:"rgba(226,232,240,0.3)" }}>
              {filtered.length} item{search && ` untuk "${search}"`}
            </div>
            {filtered.map(item => (
              <ItemCard
                key={item.id} item={item}
                onEdit={openEdit}
                onDelete={handleDelete}
                onPin={handlePin}
              />
            ))}
          </div>
        )}

        {/* ── Vault tip ────────────────────────────────────────────── */}
        {!loading && !error && items.length > 0 && (
          <div style={{ padding:"10px 14px", borderRadius:10, fontSize:"0.72rem",
            background:"rgba(0,212,255,0.04)", border:"1px solid rgba(0,212,255,0.1)",
            color:"rgba(226,232,240,0.4)", lineHeight:1.7 }}>
            💡 <strong style={{color:"rgba(0,212,255,0.7)"}}>Tips:</strong>{" "}
            Bisa simpan via chat — cukup bilang ke JARVIS:{" "}
            <span style={{color:"rgba(0,212,255,0.6)"}}>
              "simpan nomor Budi: 081234"
            </span>{" "}
            atau{" "}
            <span style={{color:"rgba(0,212,255,0.6)"}}>
              "catat password wifi: abc123"
            </span>
          </div>
        )}
      </div>
    </>
  );
}