"use client";
import { useState, useRef, useEffect } from "react";
import { askAI } from "@/lib/api";

interface Message { role: "user" | "assistant"; text: string; time: Date }

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "👋 Halo! Saya JARVIS. Anda bisa mengetik perintah dalam bahasa natural atau bahasa Indonesia. Contoh: 'buka notepad', 'screenshot', 'berapa RAM yang dipakai?'", time: new Date() }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await askAI(text);
      const reply: Message = {
        role: "assistant",
        text: data.response || "I couldn't process that.",
        time: new Date()
      };
      setMessages(prev => [...prev, reply]);

      // Show action notification
      if (data.action) {
        const actionMsg: Message = {
          role: "assistant",
          text: `⚡ Executing action: \`${data.action}\``,
          time: new Date()
        };
        setMessages(prev => [...prev, actionMsg]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `❌ Error: ${e.message}. Make sure Gemini/OpenAI API key is configured.`,
        time: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const EXAMPLES = [
    "Buka notepad",
    "Ambil screenshot",
    "Berapa CPU yang dipakai?",
    "Set volume ke 80",
    "Kunci PC",
    "buka chrome",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 200px)", minHeight: 500 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>🧠 JARVIS AI Chat</h2>
        <button className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
          onClick={() => setMessages([{ role: "assistant", text: "Memory cleared. How can I help?", time: new Date() }])}>
          🧹 Clear
        </button>
      </div>

      {/* Examples */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {EXAMPLES.map(ex => (
          <button key={ex} className="btn-primary" style={{ fontSize: "0.75rem", padding: "3px 10px" }}
            onClick={() => setInput(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12,
        background: "rgba(10,15,30,0.5)", borderRadius: 12, padding: 16,
        border: "1px solid rgba(0,212,255,0.1)"
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            animation: "fadeIn 0.2s ease"
          }}>
            <div style={{
              maxWidth: "80%",
              background: msg.role === "user"
                ? "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${msg.role === "user" ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              padding: "10px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: "0.8rem" }}>{msg.role === "user" ? "👤" : "🤖"}</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.4)" }}>
                  {msg.role === "user" ? "You" : "JARVIS"} · {msg.time.toLocaleTimeString()}
                </span>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px 12px 12px 4px", padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8
            }}>
              <span style={{ fontSize: "0.8rem" }}>🤖</span>
              <div className="spinner" style={{ width: 14, height: 14 }} />
              <span style={{ color: "rgba(226,232,240,0.5)", fontSize: "0.8rem" }}>JARVIS is thinking...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 8,
        background: "rgba(10,15,30,0.8)", border: "1px solid rgba(0,212,255,0.2)",
        borderRadius: 12, padding: "10px 14px", alignItems: "flex-end"
      }}>
        <textarea
          id="ai-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type your command or question... (Enter to send)"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#e2e8f0", fontSize: "0.875rem", resize: "none", maxHeight: 120,
            minHeight: 40, lineHeight: 1.5
          }}
          rows={1}
        />
        <button className="btn-primary" onClick={send} disabled={loading || !input.trim()}
          style={{ padding: "8px 16px", alignSelf: "flex-end" }}>
          {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : "▶ Send"}
        </button>
      </div>
    </div>
  );
}
