import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

function guessBrandName(input: {
  brandName?: string | null;
  from?: string | null;
  subject?: string | null;
}): string {
  const clean = (input.brandName ?? "").trim();
  if (clean) return clean;
  const from = (input.from ?? "").trim();
  if (from) return from.length > 80 ? from.slice(0, 80) : from;
  const subject = (input.subject ?? "").trim();
  if (subject) return subject.length > 80 ? subject.slice(0, 80) : subject;
  return "Unknown";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as unknown;
    const inboundItemId =
      typeof (body as { inboundItemId?: unknown })?.inboundItemId === "string"
        ? (body as { inboundItemId: string }).inboundItemId
        : "";
    const action =
      typeof (body as { action?: unknown })?.action === "string"
        ? (body as { action: string }).action
        : "create_deal";
    const dealAmount =
      typeof (body as { dealAmount?: unknown })?.dealAmount === "number"
        ? (body as { dealAmount: number }).dealAmount
        : 0;

    if (!inboundItemId) {
      return NextResponse.json({ ok: false, error: "Missing inboundItemId." }, { status: 400 });
    }

    const { data: item, error: itemErr } = await supabase
      .from("inbound_items")
      .select("*")
      .eq("id", inboundItemId)
      .eq("user_id", user.id)
      .single();
    if (itemErr || !item) {
      return NextResponse.json({ ok: false, error: itemErr?.message || "Not found." }, { status: 404 });
    }

    const md = (item.metadata ?? {}) as Record<string, unknown>;
    const inferredBrand = guessBrandName({
      brandName: typeof md.brandName === "string" ? md.brandName : null,
      from: (item.from_email ?? item.from_handle ?? item.from_name ?? null) as string | null,
      subject: item.subject as string | null
    });

    // 1) Ensure contact exists (by name; you can improve this later via email/handle matching).
    const { data: existingContact, error: contactErr } = await supabase
      .from("contacts")
      .select("id,name")
      .eq("user_id", user.id)
      .ilike("name", inferredBrand)
      .limit(1)
      .maybeSingle();
    if (contactErr) return NextResponse.json({ ok: false, error: contactErr.message }, { status: 500 });

    const contactId =
      existingContact?.id ??
      (
        await supabase
          .from("contacts")
          .insert({
            user_id: user.id,
            name: inferredBrand,
            type: "brand",
            email: item.from_email ?? null,
            instagram_handle: item.from_handle ?? null
          })
          .select("id")
          .single()
      ).data?.id;

    if (!contactId) {
      return NextResponse.json({ ok: false, error: "Failed to create contact." }, { status: 500 });
    }

    if (action === "create_task") {
      const title =
        typeof (body as { taskTitle?: unknown })?.taskTitle === "string"
          ? (body as { taskTitle: string }).taskTitle
          : "Follow up";
      const dueDate =
        typeof (body as { dueDate?: unknown })?.dueDate === "string"
          ? (body as { dueDate: string }).dueDate
          : null;

      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          contact_id: contactId,
          title,
          due_date: dueDate,
          status: "pending"
        })
        .select("id")
        .single();
      if (taskErr || !task) return NextResponse.json({ ok: false, error: taskErr?.message || "Failed." }, { status: 500 });

      const { error: updErr } = await supabase
        .from("inbound_items")
        .update({ status: "converted", contact_id: contactId, task_id: task.id })
        .eq("id", inboundItemId)
        .eq("user_id", user.id);
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, contactId, taskId: task.id });
    }

    // Default: create deal
    const dealTitle =
      typeof (body as { dealTitle?: unknown })?.dealTitle === "string"
        ? (body as { dealTitle: string }).dealTitle
        : item.subject ?? "Inbound opportunity";
    const dealStatus =
      typeof (body as { dealStatus?: unknown })?.dealStatus === "string"
        ? (body as { dealStatus: string }).dealStatus
        : "lead";

    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .insert({
        user_id: user.id,
        contact_id: contactId,
        title: dealTitle,
        amount: dealAmount,
        status: dealStatus,
        notes: item.snippet ?? null
      })
      .select("id")
      .single();
    if (dealErr || !deal) return NextResponse.json({ ok: false, error: dealErr?.message || "Failed." }, { status: 500 });

    const { error: updErr } = await supabase
      .from("inbound_items")
      .update({ status: "converted", contact_id: contactId, deal_id: deal.id })
      .eq("id", inboundItemId)
      .eq("user_id", user.id);
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, contactId, dealId: deal.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

