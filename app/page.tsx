"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      const reply =
        typeof data?.reply === "string"
          ? data.reply
          : data?.error || "Sorry, something went wrong.";

      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Network error. Please try again." }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4">
      <div className="mb-3 text-lg font-semibold">Creatorflow Chat</div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-400">Start by typing a message below.</p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`w-fit max-w-[85%] whitespace-pre-line rounded-md px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-auto bg-emerald-500 text-black"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              {msg.text}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </main>
  );
}
