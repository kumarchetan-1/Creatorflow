import OpenAI from "openai";
import { supabase } from "@/lib/supabaseClient";

export async function answerQueryFromData(question: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const [contactsRes, dealsRes] = await Promise.all([
    supabase.from("contacts").select("id,name,type"),
    supabase
      .from("deals")
      .select("id,contact_id,amount,status,created_at,contacts(name)")
      .order("created_at", { ascending: false })
  ]);

  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (dealsRes.error) throw new Error(dealsRes.error.message);

  const contacts = contactsRes.data ?? [];
  const deals =
    dealsRes.data?.map((deal) => ({
      id: deal.id,
      contact_id: deal.contact_id,
      contact_name: (deal.contacts as { name?: string | null } | null)?.name ?? null,
      amount: Number(deal.amount ?? 0),
      status: deal.status,
      created_at: deal.created_at
    })) ?? [];

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Answer user's question using this data. Be concise, clear, and human. If the answer is not in data, say that clearly."
      },
      {
        role: "user",
        content: `Question: ${question}\n\nData:\n${JSON.stringify(
          { contacts, deals },
          null,
          2
        )}`
      }
    ]
  });

  return response.output_text.trim();
}
