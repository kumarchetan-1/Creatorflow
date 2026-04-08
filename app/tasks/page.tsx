"use client";

import { useEffect, useState } from "react";
import { Card, SectionHeader } from "@/components/ui";

type FollowUp = {
  contact: { id: string; name: string; type: string | null };
  nextTask: { id: string; title: string; due_date: string };
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TasksPage() {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Who do I need to follow up with?" })
        });
        const json = (await res.json()) as unknown;
        if (!res.ok) {
          const msg =
            typeof (json as { error?: unknown } | null)?.error === "string"
              ? (json as { error: string }).error
              : "Failed to load tasks.";
          throw new Error(msg);
        }
        const followUps = (json as { followUps?: unknown } | null)?.followUps;
        if (!Array.isArray(followUps)) {
          throw new Error("Unexpected response.");
        }
        if (!cancelled) setItems(followUps as FollowUp[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unexpected error.");
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
        title="Tasks"
        description="Pending follow-ups due today or overdue."
        className="mb-4"
      />

      {loading ? (
        <Card variant="xl" className="text-sm cf-muted">
          Loading…
        </Card>
      ) : error ? (
        <Card variant="xl" className="text-sm">
          Couldn’t load tasks.
        </Card>
      ) : items.length === 0 ? (
        <Card variant="xl" className="text-sm cf-muted">
          No pending follow-ups.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <Card key={f.nextTask.id} variant="xl">
              <div className="text-sm font-medium">{f.contact.name}</div>
              <div className="mt-1 text-xs cf-muted">
                <span className="cf-muted">Task:</span>{" "}
                <span className="text-[#EDEDED]">{f.nextTask.title}</span>
                <span className="mx-2 text-[#1C1C1F]">•</span>
                <span className="cf-muted">Due:</span>{" "}
                <span className="text-[#EDEDED]">{fmtDate(f.nextTask.due_date)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

