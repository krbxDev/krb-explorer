import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Key, FolderOpen, Loader2 } from "lucide-react";
import { useStore } from "../../store";
import { fs } from "../../lib/invoke";

interface Message { role: "user" | "assistant"; content: string }

export function AiAssistantModal() {
  const { aiOpen, toggleAi, aiApiKey, setAiApiKey, activePaneId, panes, navigate, refresh } = useStore();
  const pane = panes[activePaneId];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(!aiApiKey);
  const [keyDraft, setKeyDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  // BUG-038 FIX: abort controller to cancel in-flight requests on close
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!aiOpen) { abortRef.current?.abort(); setLoading(false); }
  }, [aiOpen]);

  if (!aiOpen) return null;

  const send = async () => {
    if (!input.trim() || !aiApiKey) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      // Build context about current folder
      const entries = pane?.entries ?? [];
      const context = `Current folder: ${pane?.path}\nFiles (first 30): ${entries.slice(0, 30).map((e) => `${e.name}${e.isDir ? "/" : ""}`).join(", ")}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: abortRef.current.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: `You are a file manager AI assistant for KRB Explorer (a Windows file manager). Help users organize files, suggest folder structures, rename files, find duplicates, etc. When suggesting file operations, be specific with file names and paths. Context: ${context}`,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userMsg },
          ],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const reply = data.content?.[0]?.text ?? "No response";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl w-[420px] h-[560px] flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface)] rounded-t-xl">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">AI Assistant</span>
            <span className="text-[10px] text-[var(--text-muted)]">Claude</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowKeyInput((v) => !v)} title="API Key"
              className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <Key size={12} />
            </button>
            <button onClick={toggleAi} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* API Key input */}
        {showKeyInput && (
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
            <div className="flex gap-2">
              <input value={keyDraft || aiApiKey} onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="sk-ant-... (Anthropic API key)"
                type="password"
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
              <button onClick={() => { if (keyDraft) { setAiApiKey(keyDraft); setKeyDraft(""); setShowKeyInput(false); } }}
                className="px-2 py-1 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/80 transition-colors">Save</button>
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">Get your key at console.anthropic.com</div>
          </div>
        )}

        {/* Context bar */}
        <div className="px-4 py-1.5 border-b border-[var(--border)] bg-[var(--bg-base)] shrink-0 flex items-center gap-2">
          <FolderOpen size={10} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-[10px] text-[var(--text-muted)] truncate">{pane?.path}</span>
        </div>
        {/* BUG-057 FIX: privacy disclosure */}
        <div className="px-4 py-1 bg-yellow-500/5 border-b border-yellow-500/20 shrink-0 flex items-center gap-1.5">
          <span className="text-[9px] text-yellow-500/80 leading-tight">
            ⚠ Folder path and file names (up to 30) are sent to Anthropic's API with each message.
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
              <Sparkles size={32} className="opacity-20" />
              <div className="text-sm text-center">Ask me to organize files, suggest names, find duplicates, or anything about your current folder.</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Organize this folder", "Find duplicate files", "Suggest a folder structure", "What are the largest files?"].map((s) => (
                  <button key={s} onClick={() => { setInput(s); }}
                    className="px-2 py-1 text-[10px] rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)]"
              }`}>
                {m.role === "assistant" && <Sparkles size={10} className="inline mr-1 text-[var(--accent)]" />}
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2">
                <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 p-3 border-t border-[var(--border)] shrink-0">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={aiApiKey ? "Ask about your files…" : "Add API key to start"}
            disabled={!aiApiKey}
            rows={2}
            className="flex-1 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none placeholder:text-[var(--text-muted)] disabled:opacity-50"
          />
          <button onClick={send} disabled={!input.trim() || !aiApiKey || loading}
            className="p-2 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)]/80 disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
