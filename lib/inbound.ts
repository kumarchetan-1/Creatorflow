import { createSupabaseServerClient } from "@/lib/supabase/auth-server";

export type InboundSource = "email" | "instagram" | "upwork" | "form";
export type InboundStatus = "new" | "triaged" | "converted" | "ignored";

export type InboundItem = {
  id: string;
  user_id: string;
  source: InboundSource;
  external_id: string | null;
  thread_id: string | null;
  from_name: string | null;
  from_email: string | null;
  from_handle: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string;
  status: InboundStatus;
  contact_id: string | null;
  deal_id: string | null;
  task_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function upsertInboundItem(input: {
  userId: string;
  source: InboundSource;
  externalId?: string | null;
  threadId?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  fromHandle?: string | null;
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
  receivedAt?: string | null;
  status?: InboundStatus | null;
  metadata?: Record<string, unknown> | null;
}): Promise<InboundItem> {
  const supabase = await createSupabaseServerClient();

  const row = {
    user_id: input.userId,
    source: input.source,
    external_id: input.externalId ?? null,
    thread_id: input.threadId ?? null,
    from_name: input.fromName ?? null,
    from_email: input.fromEmail ?? null,
    from_handle: input.fromHandle ?? null,
    subject: input.subject ?? null,
    snippet: input.snippet ?? null,
    body: input.body ?? null,
    received_at: input.receivedAt ?? null,
    status: input.status ?? null,
    metadata: input.metadata ?? {}
  };

  // When external_id is present we can upsert for idempotency.
  // If it's absent we fall back to insert.
  if (row.external_id) {
    const { data, error } = await supabase
      .from("inbound_items")
      .upsert(row, { onConflict: "user_id,source,external_id" })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Failed to upsert inbound item.");
    return data as InboundItem;
  }

  const { data, error } = await supabase
    .from("inbound_items")
    .insert(row)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to insert inbound item.");
  return data as InboundItem;
}

export async function listInboundItems(input: {
  userId: string;
  source?: InboundSource | "all";
  status?: InboundStatus | "all";
  limit?: number;
}): Promise<InboundItem[]> {
  const supabase = await createSupabaseServerClient();

  let q = supabase
    .from("inbound_items")
    .select("*")
    .eq("user_id", input.userId)
    .order("received_at", { ascending: false });

  if (input.source && input.source !== "all") {
    q = q.eq("source", input.source);
  }

  if (input.status && input.status !== "all") {
    q = q.eq("status", input.status);
  }

  if (typeof input.limit === "number") {
    q = q.limit(input.limit);
  } else {
    q = q.limit(50);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as InboundItem[];
}

