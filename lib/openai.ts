import OpenAI from "openai";
import type { ParsedIntent } from "@/types/domain";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: [
        "create_contact",
        "log_deal",
        "set_follow_up",
        "query_insights",
        "unknown"
      ]
    },
    confidence: { type: "number" },
    entities: {
      type: "object",
      additionalProperties: false,
      properties: {
        brandName: { type: "string" },
        dealName: { type: "string" },
        amount: { type: "number" },
        status: {
          type: "string",
          enum: [
            "lead",
            "pitched",
            "negotiating",
            "contract_sent",
            "contract_signed",
            "invoice_sent",
            "paid",
            "won",
            "lost",
            "closed"
          ]
        },
        dueDate: { type: "string" },
        note: { type: "string" },
        query: { type: "string" }
      }
    }
  },
  required: ["intent", "confidence", "entities"]
};

export type EmailAnalysis = {
  isBrandDeal: boolean;
  brandName: string;
  intent: "collab" | "inquiry" | "spam";
  summary: string;
};

const emailAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    isBrandDeal: { type: "boolean" },
    brandName: { type: "string" },
    intent: { type: "string", enum: ["collab", "inquiry", "spam"] },
    summary: { type: "string" }
  },
  required: ["isBrandDeal", "brandName", "intent", "summary"]
};

type SuggestedReply = { suggestedReply: string };

const suggestedReplySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestedReply: { type: "string" }
  },
  required: ["suggestedReply"]
};

type NegotiationReply = { reply: string };

const negotiationReplySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" }
  },
  required: ["reply"]
};

type FollowUpReply = { message: string };

const followUpReplySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string" }
  },
  required: ["message"]
};

export type DailyBrief = { summary: string; suggestions: string[] };

const dailyBriefSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      items: { type: "string" },
      minItems: 0,
      maxItems: 5
    }
  },
  required: ["summary", "suggestions"]
};

export type ContactIntent = {
  intent: "negotiate" | "create_contact" | "create_deal" | "create_task" | "query";
  entities: {
    name?: string | null;
    type?: string | null;
    amount?: number | null;
    date?: string | null;
    title?: string | null;
    message?: string | null;
  };
};

const contactIntentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: ["negotiate", "create_contact", "create_deal", "create_task", "query"]
    },
    entities: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        type: { type: ["string", "null"] },
        amount: { type: ["number", "null"] },
        date: { type: ["string", "null"] },
        title: { type: ["string", "null"] },
        message: { type: ["string", "null"] }
      },
      required: ["name", "type", "amount", "date", "title", "message"]
    }
  },
  required: ["intent", "entities"]
};

export async function parseIntent(input: string): Promise<ParsedIntent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "You are an intent parser for an AI-native CRM. Return only structured JSON."
      },
      {
        role: "user",
        content: input
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "crm_intent",
        strict: true,
        schema
      }
    }
  });

  const raw = response.output_text;
  return JSON.parse(raw) as ParsedIntent;
}

export async function extractIntent(message: string): Promise<ContactIntent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `You are an AI that extracts structured data from user input.

Return ONLY JSON.

Output format:
{
  "intent": "negotiate | create_contact | create_deal | create_task | query",
  "entities": {
    "name": "string (optional)",
    "amount": "number (optional)",
    "message": "string (optional)"
  }
}

Examples:
Input: Reply to Nike and ask for more money
Output:
{
  "intent": "negotiate",
  "entities": { "name": "Nike" }
}

Input: Tell Adidas 50k is too low
Output:
{
  "intent": "negotiate",
  "entities": { "name": "Adidas", "amount": 50000 }
}

Input: Deal with Nike for 50k
Output:
{
  "intent": "create_deal",
  "entities": { "name": "Nike", "amount": 50000 }
}

Input: Closed Adidas deal worth 1 lakh
Output:
{
  "intent": "create_deal",
  "entities": { "name": "Adidas", "amount": 100000 }
}

Input: Add Nike as a brand
Output:
{
  "intent": "create_contact",
  "entities": { "name": "Nike" }
}

Input: Remind me to follow up with Nike tomorrow
Output:
{
  "intent": "create_task",
  "entities": { "name": "Nike", "message": "Follow up tomorrow" }
}

Input: Follow up with Adidas in 3 days
Output:
{
  "intent": "create_task",
  "entities": { "name": "Adidas", "message": "Follow up in 3 days" }
}

Input: What did I charge Nike last time?
Output:
{
  "intent": "query",
  "entities": { "name": "Nike", "message": "last_deal" }
}

Input: Which brand paid me the most?
Output:
{
  "intent": "query",
  "entities": { "message": "top_brand" }
}

Input: Show all my deals
Output:
{
  "intent": "query",
  "entities": { "message": "all_deals" }
}

Rules:
- Convert "k" to thousand (e.g., 50k = 50000).
- Convert "lakh" to 100000 units (e.g., 1 lakh = 100000).
- Handle casual phrasing and shorthand.
- If the user asks for information, set intent to "query".
- For query intent, put the query type in entities.message (examples: "last_deal", "top_brand", "all_deals").`
      },
      {
        role: "user",
        content: message
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "contact_intent",
        strict: true,
        schema: contactIntentSchema
      }
    }
  });

  return JSON.parse(response.output_text) as ContactIntent;
}

export async function analyzeEmail(email: {
  subject: string;
  snippet: string;
}): Promise<EmailAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          'You are analyzing emails to detect brand deals.\n\nIf email is about collaboration, sponsorship, or partnership \u2192 isBrandDeal = true.\n\nReturn JSON only.'
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            subject: email.subject,
            snippet: email.snippet
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "email_analysis",
        strict: true,
        schema: emailAnalysisSchema
      }
    }
  });

  return JSON.parse(response.output_text) as EmailAnalysis;
}

export async function suggestReplyForEmail(input: {
  subject: string;
  snippet: string;
  brandName: string;
  intent: EmailAnalysis["intent"];
  summary: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Write a short, professional reply draft for a creator responding to a potential brand deal email. Be concise, friendly, and include 1-2 clarifying questions (deliverables, budget, timeline). Return JSON only."
      },
      {
        role: "user",
        content: JSON.stringify(input, null, 2)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "suggested_reply",
        strict: true,
        schema: suggestedReplySchema
      }
    }
  });

  const parsed = JSON.parse(response.output_text) as SuggestedReply;
  return parsed.suggestedReply.trim();
}

export async function generateNegotiationReply(input: {
  name: string;
  amount?: number | null;
  message?: string | null;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  if (!input.name?.trim()) {
    throw new Error("Missing brand name for negotiation reply.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `You are a top content creator negotiating brand deals.

Goal:
- increase deal value
- stay polite and confident
- never sound desperate

If amount is mentioned:
- say it's below your standard rate
- suggest higher range (1.5x–2x)

Tone:
- premium
- calm
- assertive

Keep under 100 words.

Return JSON only.`
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            name: input.name,
            amount: input.amount ?? null,
            message: input.message ?? null
          },
          null,
          2
        )
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "negotiation_reply",
        strict: true,
        schema: negotiationReplySchema
      }
    }
  });

  const parsed = JSON.parse(response.output_text) as NegotiationReply;
  return parsed.reply.trim();
}

export async function generateFollowUp(name: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error("Missing brand name for follow-up message.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `Write a short follow-up message to a brand.

Tone:
- polite
- confident
- not needy

Example:
'Just checking in on my previous message. Would love to collaborate if this aligns.'

Keep under 50 words.

Return JSON only.`
      },
      {
        role: "user",
        content: JSON.stringify({ name: cleanName }, null, 2)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "follow_up_message",
        strict: true,
        schema: followUpReplySchema
      }
    }
  });

  const parsed = JSON.parse(response.output_text) as FollowUpReply;
  return parsed.message.trim();
}

export async function generateAISummary(data: {
  tasks: unknown;
  deals: unknown;
  earnings: unknown;
}): Promise<DailyBrief> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `You are a personal business manager for a content creator.

Analyze this data:
- tasks
- deals
- earnings

Write a daily brief.

Structure:
1. What needs attention today
2. Key insights
3. Suggested actions

Also output a short suggestions list (2-4 items), e.g.:
- "Follow up with Nike"
- "Negotiate Adidas deal"

Tone:
- sharp
- actionable
- slightly authoritative

Keep under 120 words.

Return JSON only.`
      },
      {
        role: "user",
        content: JSON.stringify(data, null, 2)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "daily_brief",
        strict: true,
        schema: dailyBriefSchema
      }
    }
  });

  const parsed = JSON.parse(response.output_text) as DailyBrief;
  return {
    summary: (parsed.summary ?? "").trim(),
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s) => typeof s === "string")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 5)
      : []
  };
}
