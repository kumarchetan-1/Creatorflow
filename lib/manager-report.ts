import { supabase } from "@/lib/supabaseClient";

export type DailyManagerReport = {
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

function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const EARNING_STATUSES = ["closed", "won"] as const;

export async function generateDailyManagerReport(userId: string): Promise<DailyManagerReport> {
  if (!userId) throw new Error("Missing userId.");
  const [tasksRes, recentDealsRes, earningsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,due_date,status,contacts(name)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .lte("due_date", endOfTodayIso())
      .order("due_date", { ascending: true }),

    supabase
      .from("deals")
      .select("id,amount,status,created_at,contacts(name)")
      .eq("user_id", userId)
      .gte("created_at", isoDaysAgo(7))
      .order("created_at", { ascending: false }),

    supabase
      .from("deals")
      .select("contact_id,amount,status,contacts(name)")
      .eq("user_id", userId)
      .in("status", [...EARNING_STATUSES])
  ]);

  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (recentDealsRes.error) throw new Error(recentDealsRes.error.message);
  if (earningsRes.error) throw new Error(earningsRes.error.message);

  const tasks =
    (tasksRes.data ?? []).map((t) => ({
      id: t.id as string,
      title: (t as { title?: string | null }).title ?? "",
      due_date: (t as { due_date?: string | null }).due_date ?? "",
      status: (t as { status?: string | null }).status ?? "pending",
      contactName: (t.contacts as { name?: string | null } | null)?.name ?? null
    })) ?? [];

  const recentDeals =
    (recentDealsRes.data ?? []).map((d) => ({
      id: d.id as string,
      amount: Number((d as { amount?: unknown }).amount ?? 0),
      status: (d as { status?: string | null }).status ?? "",
      created_at: (d as { created_at?: string | null }).created_at ?? "",
      contactName: (d.contacts as { name?: string | null } | null)?.name ?? null
    })) ?? [];

  const earningsRows =
    (earningsRes.data ?? []) as Array<{
      contact_id: string | null;
      amount: unknown;
      status: string | null;
      contacts: { name?: string | null } | null;
    }>;

  const totalEarnings = earningsRows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  const totalsByBrand = new Map<string, number>();
  for (const row of earningsRows) {
    const name = row.contacts?.name?.trim();
    if (!name) continue;
    totalsByBrand.set(name, (totalsByBrand.get(name) ?? 0) + Number(row.amount ?? 0));
  }

  let topBrand = "";
  let topAmount = -Infinity;
  for (const [name, total] of totalsByBrand.entries()) {
    if (total > topAmount) {
      topAmount = total;
      topBrand = name;
    }
  }

  return {
    tasks,
    recentDeals,
    totalEarnings,
    topBrand
  };
}

