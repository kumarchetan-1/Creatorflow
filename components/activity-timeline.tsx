import type { TimelineItem } from "@/types/domain";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

async function getTimeline(): Promise<TimelineItem[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from("activities")
      .select("id,action_type,summary,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    return data || [];
  } catch {
    return [];
  }
}

export async function ActivityTimeline() {
  const items = await getTimeline();

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
        Activity timeline
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="text-sm text-zinc-200">
              <span className="text-zinc-400">{new Date(item.created_at).toLocaleString()}:</span>{" "}
              {item.summary}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
