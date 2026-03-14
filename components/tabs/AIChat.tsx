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
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 180px)", minHeight: 400 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>🧠 JARVIS AI Chat</h2>
        <button className="btn-primary" style={{ fontSize: "0.75rem", padding: "4px 10px" }}
          onClick={() => setMessages([{ role: "assistant", text: "Memory cleared. How can I help?", time: new Date() }])}>
          🧹 Clear
        </button>
      </div>

      {/* Examples */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : "none", overflowY: "auto" }}>
        {EXAMPLES.map(ex => (
          <button key={ex} className="btn-primary" style={{ fontSize: "0.7rem", padding: "3px 10px" }}
            onClick={() => setInput(ex)}>
            {ex}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12,
        background: "rgba(10,15,30,0.5)", borderRadius: 12, padding: "16px",
        border: "1px solid rgba(0,212,255,0.1)",
        boxShadow: "inset 0 0 20px rgba(0,0,0,0.2)"
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: typeof window !== 'undefined' && window.innerWidth < 640 ? "90%" : "80%",
              background: msg.role === "user"
                ? "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))"
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${msg.role === "user" ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "12px 16px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.9rem" }}>{msg.role === "user" ? "👤" : "🤖"}</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(226,232,240,0.5)", fontWeight: 600 }}>
                  {msg.role === "user" ? "YOU" : "JARVIS"} · {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ fontSize: "0.9rem", color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px 16px 16px 4px", padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10
            }}>
              <span style={{ fontSize: "0.9rem" }}>🤖</span>
              <div className="spinner" style={{ width: 14, height: 14 }} />
              <span style={{ color: "rgba(226,232,240,0.5)", fontSize: "0.85rem" }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 10,
        background: "rgba(10,15,30,0.9)", border: "1px solid rgba(0,212,255,0.3)",
        borderRadius: 16, padding: "8px 16px", alignItems: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
      }}>
        <textarea
          id="ai-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask me anything..."
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#e2e8f0", fontSize: "0.95rem", resize: "none", maxHeight: 120,
            minHeight: 24, lineHeight: 1.5, padding: "8px 0"
          }}
        />
        <button 
          className="btn-primary" 
          onClick={send} 
          disabled={loading || !input.trim()}
          style={{ 
            width: 40, height: 40, padding: 0, borderRadius: "50%", 
            justifyContent: "center", fontSize: "1.2rem" 
          }}
        >
          {loading ? "⌛" : "➤"}
        </button>
      </div>
    </div>
  );
}
