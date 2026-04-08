import { getSupabaseAuthed } from "@/lib/supabase";
import type { ActionResult, ParsedIntent } from "@/types/domain";

async function logActivity(actionType: string, summary: string) {
  const { supabase, user } = await getSupabaseAuthed();
  await supabase.from("activities").insert({
    user_id: user.id,
    action_type: actionType,
    summary
  });
}

export async function executeIntent(parsed: ParsedIntent): Promise<ActionResult> {
  const { supabase, user } = await getSupabaseAuthed();

  if (parsed.intent === "create_contact") {
    const brandName = parsed.entities.brandName;
    if (!brandName) {
      return { success: false, message: "Missing brand name." };
    }

    const { data, error } = await supabase
      .from("contacts")
      .insert({
        user_id: user.id,
        name: brandName
      })
      .select("id,name")
      .single();

    if (error) return { success: false, message: error.message };
    await logActivity("create_contact", `Added contact ${brandName}`);
    return { success: true, message: `Contact created: ${brandName}`, data };
  }

  if (parsed.intent === "log_deal") {
    const dealName = parsed.entities.dealName;
    if (!dealName) {
      return { success: false, message: "Missing deal name." };
    }

    const { data, error } = await supabase
      .from("deals")
      .insert({
        user_id: user.id,
        title: dealName,
        amount: parsed.entities.amount ?? 0,
        status: parsed.entities.status ?? "lead",
        notes: parsed.entities.note ?? null
      })
      .select("id,title,status,amount")
      .single();

    if (error) return { success: false, message: error.message };
    await logActivity("log_deal", `Logged deal ${dealName}`);
    return { success: true, message: `Deal logged: ${dealName}`, data };
  }

  if (parsed.intent === "set_follow_up") {
    const dueDate = parsed.entities.dueDate;
    const note = parsed.entities.note ?? "Follow up";

    if (!dueDate) {
      return { success: false, message: "Missing follow-up date." };
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: note,
        due_date: dueDate,
        status: "open"
      })
      .select("id,title,due_date,status")
      .single();

    if (error) return { success: false, message: error.message };
    await logActivity("set_follow_up", `Created follow-up for ${dueDate}`);
    return { success: true, message: `Follow-up set for ${dueDate}`, data };
  }

  if (parsed.intent === "query_insights") {
    const [contactsRes, dealsRes, openTasksRes] = await Promise.all([
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("deals").select("amount,status").eq("user_id", user.id),
      supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "open")
    ]);

    if (dealsRes.error) return { success: false, message: dealsRes.error.message };

    const totalPipeline = (dealsRes.data || []).reduce(
      (sum, deal) => sum + (deal.amount || 0),
      0
    );

    const wonDeals = (dealsRes.data || []).filter((deal) => deal.status === "won").length;

    const message = `Contacts: ${contactsRes.count || 0}, Open tasks: ${
      openTasksRes.count || 0
    }, Pipeline: $${totalPipeline}, Won deals: ${wonDeals}`;
    await logActivity("query_insights", "Retrieved CRM insights");
    return { success: true, message };
  }

  return { success: false, message: "Intent not recognized." };
}
