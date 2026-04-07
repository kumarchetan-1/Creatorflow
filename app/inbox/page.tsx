"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type InboxItem = {
  subject: string;
  from: string;
  brandName: string;
  summary: string;
  suggestedReply: string;
};

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] ?? fromHeader).trim();
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sentMsg, setSentMsg] = useState<Record<string, string>>({});

  const ordered = useMemo(() => items, [items]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/inbox", { method: "GET" });
        const data = (await res.json()) as unknown;

        if (!res.ok) {
          const msg =
            typeof (data as { error?: unknown } | null)?.error === "string"
              ? (data as { error: string }).error
              : "Failed to load inbox.";
          throw new Error(msg);
        }

        if (!Array.isArray(data)) {
          throw new Error("Unexpected API response.");
        }

        if (!cancelled) {
          const nextItems = data as InboxItem[];
          setItems(nextItems);
          setDrafts((prev) => {
            const next = { ...prev };
            for (const it of nextItems) {
              const key = `${it.from}::${it.subject}`;
              if (typeof next[key] !== "string") next[key] = it.suggestedReply ?? "";
            }
            return next;
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unexpected error.";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-zinc-100">Inbox</div>
          <div className="text-sm text-zinc-400">Brand-related emails only.</div>
        </div>
        <Link
          href="/"
          className="text-sm text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
        >
          Back
        </Link>
      </div>

      {loading ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : ordered.length === 0 ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          No brand-related emails found in the last 10.
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((item) => {
            const key = `${item.from}::${item.subject}`;
            const isOpen = Boolean(openReplies[key]);
            const isSending = Boolean(sending[key]);
            const status = sentMsg[key] ?? null;
            return (
              <div
                key={key}
                className="rounded-md border border-zinc-800 bg-zinc-950 p-4"
              >
                <div className="text-sm font-medium text-zinc-100">{item.subject}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  <div>
                    <span className="text-zinc-500">Brand:</span>{" "}
                    <span className="text-zinc-200">{item.brandName || "—"}</span>
                  </div>
                  <div className="truncate">
                    <span className="text-zinc-500">From:</span>{" "}
                    <span className="text-zinc-200">{item.from || "—"}</span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-zinc-200">{item.summary}</div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenReplies((prev) => ({ ...prev, [key]: !prev[key] }))
                    }
                    className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-black hover:bg-emerald-400"
                  >
                    {isOpen ? "Hide Reply" : "Generate Reply"}
                  </button>
                </div>

                {isOpen ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="min-h-[140px] w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={async () => {
                          setSending((prev) => ({ ...prev, [key]: true }));
                          setSentMsg((prev) => ({ ...prev, [key]: "" }));
                          try {
                            const to = extractEmailAddress(item.from);
                            const subject = item.subject.startsWith("Re:")
                              ? item.subject
                              : `Re: ${item.subject}`;
                            const body = drafts[key] ?? "";

                            const res = await fetch("/api/send-email", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ to, subject, body })
                            });
                            const data = (await res.json()) as unknown;

                            if (!res.ok || (data as { ok?: unknown } | null)?.ok === false) {
                              const msg =
                                typeof (data as { error?: unknown } | null)?.error === "string"
                                  ? (data as { error: string }).error
                                  : "Failed to send email.";
                              throw new Error(msg);
                            }

                            setSentMsg((prev) => ({
                              ...prev,
                              [key]: "Sent."
                            }));
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Unexpected error.";
                            setSentMsg((prev) => ({ ...prev, [key]: msg }));
                          } finally {
                            setSending((prev) => ({ ...prev, [key]: false }));
                          }
                        }}
                        className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                      >
                        {isSending ? "Sending…" : "Send email"}
                      </button>

                      {status ? (
                        <div className="text-sm text-zinc-300">{status}</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

