"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { buildApiUrl } from "@/lib/base-url";

type ThreadSummary = {
  id: string;
  title: string;
  updated_at: string;
};

export default function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeThreadId = searchParams.get("thread");

  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadThreads() {
      try {
        const res = await fetch(buildApiUrl("/api/chats"), { method: "GET" });
        const data = (await res.json()) as { threads?: ThreadSummary[] };
        if (!res.ok || !Array.isArray(data.threads)) return;
        if (!cancelled) setThreads(data.threads);
      } catch {
        if (!cancelled) setThreads([]);
      }
    }
    void loadThreads();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="cf-nav flex items-center gap-2 px-2.5 py-2">
        <Link href="/" className="flex-1 px-1 text-sm">
          Chat
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle chat history"
          className="rounded-full border px-2 py-0.5 text-xs"
          style={{ borderColor: "#2A2A2D", background: "#0B0B0C" }}
        >
          {open ? "▴" : "▾"}
        </button>
      </div>

      {open ? (
        <div className="space-y-1 pl-2">
          <Link href="/" className="cf-nav block px-3 py-1.5 text-xs">
            + New chat
          </Link>
          {threads.length === 0 ? (
            <div className="px-3 py-1 text-xs text-[#9CA3AF]">No previous chats</div>
          ) : (
            threads.slice(0, 12).map((thread) => (
              <Link
                key={thread.id}
                href={`/?thread=${thread.id}`}
                className="block rounded-[12px] border px-3 py-1.5 text-xs transition-colors"
                style={{
                  borderColor: activeThreadId === thread.id ? "#2A2A2D" : "transparent",
                  background: activeThreadId === thread.id ? "#151518" : "transparent",
                  color: pathname === "/" ? "#EDEDED" : "#C9C9D1"
                }}
                title={thread.title}
              >
                {thread.title}
              </Link>
            ))
          )}
        </div>
      ) : null}

      <Link href="/inbox" className="cf-nav">
        Inbox
      </Link>
      <Link href="/tasks" className="cf-nav">
        Tasks
      </Link>
      <Link href="/connections" className="cf-nav">
        Connections
      </Link>
      <Link href="/insights" className="cf-nav">
        Insights
      </Link>
    </div>
  );
}
