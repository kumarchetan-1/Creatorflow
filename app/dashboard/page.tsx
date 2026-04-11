"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { buildApiUrl } from "@/lib/base-url";

type DailyData = {
  tasks: Array<{
    id: string;
    title: string;
    due_date: string;
    status: string;
    contactName: string | null;
  }>;
  recentDeals: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
    contactName: string | null;
  }>;
  totalEarnings: number;
  topBrand: string;
};

type DailyResponse = { summary: string; suggestions: string[]; data: DailyData };

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(buildApiUrl("/api/daily?refresh=1"), { method: "GET" });
      const json = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          typeof (json as { error?: unknown } | null)?.error === "string"
            ? (json as { error: string }).error
            : "Failed to load dashboard.";
        throw new Error(msg);
      }
      const payload = json as DailyResponse;
      setSummary(payload.summary ?? "");
      setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
      setData(payload.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // First open should use cached daily result (if available).
    void (async () => {
      setError(null);
      try {
        const res = await fetch(buildApiUrl("/api/daily"), { method: "GET" });
        const json = (await res.json()) as unknown;
        if (!res.ok) {
          const msg =
            typeof (json as { error?: unknown } | null)?.error === "string"
              ? (json as { error: string }).error
              : "Failed to load dashboard.";
          throw new Error(msg);
        }
        const payload = json as DailyResponse;
        setSummary(payload.summary ?? "");
        setSuggestions(Array.isArray(payload.suggestions) ? payload.suggestions : []);
        setData(payload.data ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unexpected error.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const dealsByBrand = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const d of data?.recentDeals ?? []) {
      const brand = d.contactName?.trim() || "Unknown";
      const cur = map.get(brand) ?? { count: 0, total: 0 };
      map.set(brand, { count: cur.count + 1, total: cur.total + Number(d.amount ?? 0) });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
  }, [data]);

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <div className="text-xl font-semibold tracking-tight">Good evening, Chetan</div>
        <div className="mt-1 text-sm cf-muted">Here’s what matters today.</div>
      </div>

      <SectionHeader
        title="Today"
        description={
          data
            ? `Top brand: ${data.topBrand || "—"} • Total earnings: ${formatMoney(
                data.totalEarnings
              )}`
            : "Generating your plan…"
        }
        right={
          <Button variant="primary" onClick={load} disabled={refreshing}>
            {refreshing ? "Generating…" : "Generate Today’s Plan"}
          </Button>
        }
        className="mb-4"
      />

      {loading ? (
        <div className="space-y-4">
          <Card variant="xl">
            <div className="mb-3 cf-skeleton h-4 w-24 rounded-full" />
            <div className="space-y-2">
              <div className="cf-skeleton h-4 w-[92%] rounded-full" />
              <div className="cf-skeleton h-4 w-[78%] rounded-full" />
              <div className="cf-skeleton h-4 w-[86%] rounded-full" />
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card variant="xl">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="cf-skeleton h-4 w-16 rounded-full" />
                <div className="cf-skeleton h-3 w-14 rounded-full" />
              </div>
              <div className="space-y-2">
                <Card variant="row" className="p-4">
                  <div className="cf-skeleton h-4 w-[70%] rounded-full" />
                  <div className="mt-2 cf-skeleton h-3 w-[55%] rounded-full" />
                </Card>
                <Card variant="row" className="p-4">
                  <div className="cf-skeleton h-4 w-[62%] rounded-full" />
                  <div className="mt-2 cf-skeleton h-3 w-[48%] rounded-full" />
                </Card>
              </div>
            </Card>

            <Card variant="xl">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="cf-skeleton h-4 w-16 rounded-full" />
                <div className="cf-skeleton h-3 w-14 rounded-full" />
              </div>
              <div className="space-y-2">
                <Card variant="row" className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="cf-skeleton h-4 w-[45%] rounded-full" />
                    <div className="mt-2 cf-skeleton h-3 w-[30%] rounded-full" />
                  </div>
                  <div className="cf-skeleton h-4 w-20 rounded-full" />
                </Card>
                <Card variant="row" className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="cf-skeleton h-4 w-[52%] rounded-full" />
                    <div className="mt-2 cf-skeleton h-3 w-[34%] rounded-full" />
                  </div>
                  <div className="cf-skeleton h-4 w-20 rounded-full" />
                </Card>
              </div>
            </Card>
          </div>
        </div>
      ) : error ? (
        <Card variant="xl" className="text-sm">
          Couldn’t load today’s plan.
        </Card>
      ) : (
        <div className="space-y-4">
          <Card variant="xl">
            <div className="mb-2 text-sm font-semibold">AI summary</div>
            <div className="whitespace-pre-line text-sm text-[#EDEDED]">{summary || "—"}</div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card variant="xl">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-sm font-semibold">Tasks</div>
                <div className="text-xs cf-muted">
                  {(data?.tasks?.length ?? 0) === 0 ? "None" : `${data?.tasks?.length ?? 0} due`}
                </div>
              </div>

              {(data?.tasks?.length ?? 0) === 0 ? (
                <div className="text-sm cf-muted">No pending tasks due today.</div>
              ) : (
                <div className="space-y-2">
                  {(data?.tasks ?? []).slice(0, 10).map((t) => (
                    <Card key={t.id} variant="row" className="p-4">
                      <div className="text-sm">{t.title}</div>
                      <div className="mt-1 text-xs cf-muted">
                        <span className="cf-muted">Brand:</span>{" "}
                        <span className="text-[#EDEDED]">{t.contactName ?? "—"}</span>
                        <span className="mx-2 text-[#1C1C1F]">•</span>
                        <span className="cf-muted">Due:</span>{" "}
                        <span className="text-[#EDEDED]">{fmtDate(t.due_date)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card variant="xl">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-sm font-semibold">Deals</div>
                <div className="text-xs cf-muted">
                  {(data?.recentDeals?.length ?? 0) === 0
                    ? "No deals"
                    : `${data?.recentDeals?.length ?? 0} in 7d`}
                </div>
              </div>

              {dealsByBrand.length === 0 ? (
                <div className="text-sm cf-muted">No deals yet. Start by logging one.</div>
              ) : (
                <div className="space-y-2">
                  {dealsByBrand.map(([brand, s]) => (
                    <Card key={brand} variant="row" className="flex items-center justify-between p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{brand}</div>
                        <div className="text-xs cf-muted">{s.count} deal(s)</div>
                      </div>
                      <div className="text-sm font-medium text-[#EDEDED]">
                        {formatMoney(s.total)}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {(data?.recentDeals?.length ?? 0) > 0 ? (
                <div className="mt-3 text-xs cf-muted">
                  Top brands by earnings (7 days).
                </div>
              ) : null}
            </Card>
          </div>

          {suggestions.length > 0 ? (
            <Card variant="xl">
              <div className="mb-3 text-sm font-semibold">Suggestions</div>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 6).map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </main>
  );
}

