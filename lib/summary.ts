import { supabase } from "@/lib/supabaseClient";

export async function getDailySummary(): Promise<string> {
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("title,due_date,contact_id,contacts(name)")
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  if (tasksError) {
    throw new Error(tasksError.message);
  }

  const { count: activeDealsCount, error: dealsError } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .in("status", ["lead", "pitched", "negotiating"]);

  if (dealsError) {
    throw new Error(dealsError.message);
  }

  const pendingTasksCount = tasks?.length ?? 0;
  const dealsCount = activeDealsCount ?? 0;

  const firstTask = tasks?.[0] as
    | {
        title?: string | null;
        contacts?: { name?: string | null } | null;
      }
    | undefined;

  const focusName = firstTask?.contacts?.name;
  const focusLine = focusName
    ? `Focus on ${focusName} follow-up.`
    : "Focus on your most urgent follow-up.";

  return `Today:
- ${pendingTasksCount} follow-ups pending
- ${dealsCount} active deal${dealsCount === 1 ? "" : "s"}

${focusLine}`;
}
