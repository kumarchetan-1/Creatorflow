import { supabase } from "@/lib/supabaseClient";

type QueryEntities = {
  name?: string | null;
  type?: string | null;
};

type LastDealResult = {
  type: "last_deal";
  contact: string;
  deal: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
  } | null;
};

type TopBrandResult = {
  type: "top_brand";
  brand: {
    contact_id: string;
    name: string;
    total_amount: number;
  } | null;
};

type AllDealsResult = {
  type: "all_deals";
  deals: Array<{
    id: string;
    contact_id: string | null;
    contact_name: string | null;
    amount: number;
    status: string;
    created_at: string;
  }>;
};

type QueryResult = LastDealResult | TopBrandResult | AllDealsResult;

export async function handleQuery(userId: string, entities: QueryEntities): Promise<QueryResult> {
  if (!userId) throw new Error("Missing userId.");
  const type = entities.type?.trim();

  if (type === "last_deal") {
    const name = entities.name?.trim();
    if (!name) {
      throw new Error("Name is required for last_deal query.");
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id,name")
      .eq("user_id", userId)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (contactError) throw new Error(contactError.message);
    if (!contact) {
      return { type: "last_deal", contact: name, deal: null };
    }

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("id,amount,status,created_at")
      .eq("user_id", userId)
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dealError) throw new Error(dealError.message);

    return {
      type: "last_deal",
      contact: contact.name,
      deal: deal
        ? {
            id: deal.id,
            amount: Number(deal.amount ?? 0),
            status: deal.status,
            created_at: deal.created_at
          }
        : null
    };
  }

  if (type === "top_brand") {
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select("contact_id,amount")
      .eq("user_id", userId)
      .not("contact_id", "is", null);

    if (dealsError) throw new Error(dealsError.message);

    const totals = new Map<string, number>();
    for (const deal of deals ?? []) {
      const contactId = deal.contact_id as string | null;
      if (!contactId) continue;
      totals.set(contactId, (totals.get(contactId) ?? 0) + Number(deal.amount ?? 0));
    }

    let topContactId: string | null = null;
    let topAmount = 0;
    for (const [contactId, total] of totals.entries()) {
      if (topContactId === null || total > topAmount) {
        topContactId = contactId;
        topAmount = total;
      }
    }

    if (!topContactId) {
      return { type: "top_brand", brand: null };
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id,name")
      .eq("user_id", userId)
      .eq("id", topContactId)
      .single();

    if (contactError) throw new Error(contactError.message);

    return {
      type: "top_brand",
      brand: {
        contact_id: contact.id,
        name: contact.name,
        total_amount: topAmount
      }
    };
  }

  if (type === "all_deals") {
    const { data, error } = await supabase
      .from("deals")
      .select("id,contact_id,amount,status,created_at,contacts(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const deals =
      data?.map((row) => ({
        id: row.id,
        contact_id: row.contact_id,
        contact_name: (row.contacts as { name?: string | null } | null)?.name ?? null,
        amount: Number(row.amount ?? 0),
        status: row.status,
        created_at: row.created_at
      })) ?? [];

    return { type: "all_deals", deals };
  }

  throw new Error("Unsupported query type.");
}
