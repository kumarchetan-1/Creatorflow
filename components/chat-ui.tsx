"use client";

import { useState, useTransition } from "react";
import { handleChatMessage } from "@/app/actions/chat";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Ask me to create contacts, log deals, set follow-ups, or show insights."
    }
  ]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInput("");

    startTransition(async () => {
      const res = await handleChatMessage(userMessage);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.assistantMessage }
      ]);
    });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col p-6">
      <h1 className="mb-4 text-2xl font-semibold">Creatorflow CRM</h1>

      <div className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
              msg.role === "user"
                ? "ml-auto bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-100"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Add brand Nike as a contact"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none ring-emerald-500/40 focus:ring"
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}
