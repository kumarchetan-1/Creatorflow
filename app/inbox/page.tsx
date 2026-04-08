"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";

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
    <main className="mx-auto w-full max-w-3xl p-6">
      <SectionHeader
        title="Inbox"
        description="Brand-related emails only."
        right={
          <Link href="/" className="cf-link text-sm">
            Back
          </Link>
        }
        className="mb-4"
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} variant="xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="cf-skeleton h-6 w-24 rounded-full" />
                    <div className="cf-skeleton h-4 w-40 rounded-full" />
                  </div>
                  <div className="cf-skeleton h-4 w-[85%] rounded-full" />
                  <div className="mt-3 space-y-2">
                    <div className="cf-skeleton h-4 w-[95%] rounded-full" />
                    <div className="cf-skeleton h-4 w-[75%] rounded-full" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 md:flex-col md:items-end">
                  <div className="cf-skeleton h-9 w-36 rounded-full" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card variant="xl" className="text-sm">
          Couldn’t load inbox.
        </Card>
      ) : ordered.length === 0 ? (
        <Card variant="xl" className="text-sm cf-muted">
          No brand emails right now.
        </Card>
      ) : (
        <div className="space-y-3">
          {ordered.map((item) => {
            const key = `${item.from}::${item.subject}`;
            const isOpen = Boolean(openReplies[key]);
            const isSending = Boolean(sending[key]);
            const status = sentMsg[key] ?? null;
            return (
              <Card key={key} variant="xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge>{item.brandName || "—"}</Badge>
                      <span className="text-xs cf-muted">
                        {item.from ? `From: ${item.from}` : "From: —"}
                      </span>
                    </div>

                    <div className="truncate text-sm font-medium">{item.subject}</div>
                    <div className="mt-2 text-sm text-[#EDEDED]">{item.summary}</div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 md:flex-col md:items-end md:justify-start">
                    <Button
                      variant="primary"
                      type="button"
                      onClick={() =>
                        setOpenReplies((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                    >
                      {isOpen ? "Hide Reply" : "Generate Reply"}
                    </Button>

                    {status ? <div className="text-sm cf-muted">{status}</div> : null}
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-4 space-y-2">
                    <textarea
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="cf-input min-h-[140px] resize-y p-3 text-sm"
                    />

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
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
                      >
                        {isSending ? "Sending…" : "Send email"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

