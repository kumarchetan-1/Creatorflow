"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { buildApiUrl } from "@/lib/base-url";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
};

type ViewMessage = ChatMessage & { isTyping?: boolean };

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9CA3AF]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9CA3AF] [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9CA3AF] [animation-delay:300ms]" />
    </div>
  );
}

export default function ChatHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("thread");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(requestedThreadId);
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inFlightRef = useRef(false);

  const view = useMemo(() => {
    const base: ViewMessage[] = messages.map((m) => ({ ...m, isTyping: false }));
    if (loading) {
      base.push({ role: "assistant", text: "", suggestions: [], isTyping: true });
    }
    return base;
  }, [messages, loading]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [view.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const maxHeight = 160;
    const target = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(24, target)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    async function loadThread(threadId: string) {
      try {
        const res = await fetch(buildApiUrl(`/api/chats/${threadId}`), { method: "GET" });
        const data = (await res.json()) as { messages?: Array<{ role: string; content: string }> };
        if (!res.ok || !Array.isArray(data.messages)) throw new Error("Failed to load chat thread.");
        if (!cancelled) {
          setMessages(
            data.messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({
                role: m.role as "user" | "assistant",
                text: m.content,
                suggestions: []
              }))
          );
          setCurrentThreadId(threadId);
        }
      } catch {
        if (!cancelled) {
          setMessages([]);
          setCurrentThreadId(threadId);
        }
      }
    }

    if (!requestedThreadId) {
      setCurrentThreadId(null);
      setMessages([]);
      return () => {
        cancelled = true;
      };
    }

    void loadThread(requestedThreadId);
    return () => {
      cancelled = true;
    };
  }, [requestedThreadId]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || inFlightRef.current) return;

    inFlightRef.current = true;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(buildApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, threadId: currentThreadId })
      });

      const data = (await res.json()) as unknown;
      const reply =
        typeof (data as { reply?: unknown } | null)?.reply === "string"
          ? ((data as { reply: string }).reply as string)
          : typeof (data as { error?: unknown } | null)?.error === "string"
            ? ((data as { error: string }).error as string)
            : "Sorry, something went wrong.";

      const suggestionsRaw = (data as { suggestions?: unknown } | null)?.suggestions;
      const suggestions = Array.isArray(suggestionsRaw)
        ? suggestionsRaw.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        : [];
      const threadIdFromResponse =
        typeof (data as { threadId?: unknown } | null)?.threadId === "string"
          ? ((data as { threadId: string }).threadId as string)
          : null;
      if (threadIdFromResponse && threadIdFromResponse !== currentThreadId) {
        setCurrentThreadId(threadIdFromResponse);
        router.replace(`/?thread=${threadIdFromResponse}`, { scroll: false });
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: reply, suggestions }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Network error. Please try again.", suggestions: [] }
      ]);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await sendMessage(input);
  }

  return (
    <main className="relative mx-auto h-[calc(100vh-1px)] w-full max-w-[700px] px-6">
      <div className="pt-6">
        <SectionHeader
          title="Chat"
          description="Tell Creatorflow what to do."
        />
      </div>

      <div className="mt-5 pb-32">
        {view.length === 0 ? (
          <Card variant="xl" className="text-sm cf-muted">
            Tell me what you want to do. I can log deals, set follow-ups, and draft negotiation replies.
          </Card>
        ) : (
          <div className="space-y-4">
            {view.map((msg, idx) => {
              const isAssistant = msg.role === "assistant";
              const isTyping = (msg as { isTyping?: boolean }).isTyping === true;

              return (
                <div
                  key={idx}
                  className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div className="max-w-[85%]">
                    <div
                      className={`whitespace-pre-line rounded-[24px] border px-4 py-3 text-sm leading-relaxed shadow-[0_1px_0_rgba(255,255,255,0.03)] ${
                        isAssistant
                          ? "bg-[#111113] text-[#EDEDED] border-[#1C1C1F]"
                          : "bg-[#151518] text-[#EDEDED] border-[#1C1C1F]"
                      }`}
                    >
                      {isTyping ? <TypingDots /> : msg.text}
                    </div>

                    {isAssistant && !isTyping && msg.suggestions && msg.suggestions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.suggestions.map((s) => (
                          <Badge
                            key={s}
                            role="button"
                            tabIndex={0}
                            onClick={async () => {
                              if (loading) return;
                              setInput(s);
                              await sendMessage(s);
                            }}
                            onKeyDown={async (e) => {
                              if (loading) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setInput(s);
                                await sendMessage(s);
                              }
                            }}
                            className={loading ? "opacity-50" : "cursor-pointer select-none"}
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 border-t"
        style={{ borderColor: "#2A2A2F", background: "linear-gradient(to top, rgba(11,11,12,0.98), rgba(11,11,12,0.72), rgba(11,11,12,0))" }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-[700px] px-6 pb-6 pt-4">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3 overflow-hidden rounded-full border px-5 py-3 shadow-[0_1px_0_rgba(255,255,255,0.03),0_12px_30px_rgba(0,0,0,0.35)]"
            style={{ background: "#111113", borderColor: "#2A2A2F" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what you want to do..."
              rows={1}
              className="w-full resize-none bg-transparent py-0 text-sm leading-6 text-[#EDEDED] outline-none placeholder:text-[#9CA3AF]"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  await sendMessage(input);
                }
              }}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="h-11 w-11 shrink-0 rounded-full p-0 text-lg"
              aria-label="Send message"
            >
              {loading ? (
                "…"
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
              )}
            </Button>
          </form>
          <div className="mt-2 text-xs cf-muted">
            Enter to send • Shift+Enter for newline
          </div>
        </div>
      </div>
    </main>
  );
}
