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
          enum: ["lead", "pitched", "negotiating", "won", "lost"]
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

export type ContactIntent = {
  intent: "create_contact" | "create_deal" | "create_task" | "query";
  entities: {
    name?: string | null;
    type?: string | null;
    amount?: number | null;
    date?: string | null;
    title?: string | null;
  };
};

const contactIntentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: ["create_contact", "create_deal", "create_task", "query"]
    },
    entities: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: ["string", "null"] },
        type: { type: ["string", "null"] },
        amount: { type: ["number", "null"] },
        date: { type: ["string", "null"] },
        title: { type: ["string", "null"] }
      },
      required: ["name", "type", "amount", "date", "title"]
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
  "intent": "create_contact | create_deal | create_task | query",
  "entities": {
    "name": "string (optional)",
    "type": "string (optional)",
    "amount": "number (optional)",
    "date": "string (optional)",
    "title": "string (optional)"
  }
}

Examples:
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
  "entities": { "name": "Nike", "type": "brand" }
}

Input: Remind me to follow up with Nike tomorrow
Output:
{
  "intent": "create_task",
  "entities": { "name": "Nike", "title": "Follow up", "date": "tomorrow" }
}

Input: Follow up with Adidas in 3 days
Output:
{
  "intent": "create_task",
  "entities": { "name": "Adidas", "title": "Follow up", "date": "in 3 days" }
}

Input: What did I charge Nike last time?
Output:
{
  "intent": "query",
  "entities": { "name": "Nike", "type": "last_deal" }
}

Input: Which brand paid me the most?
Output:
{
  "intent": "query",
  "entities": { "type": "top_brand" }
}

Input: Show all my deals
Output:
{
  "intent": "query",
  "entities": { "type": "all_deals" }
}

Rules:
- Convert "k" to thousand (e.g., 50k = 50000).
- Convert "lakh" to 100000 units (e.g., 1 lakh = 100000).
- Extract relative dates like "tomorrow", "today", "in 3 days".
- Keep date as string for now.
- Handle casual phrasing and shorthand.
- If the user asks for information, set intent to "query".
- For query intent, extract meaning in entities.type (examples: "last_deal", "top_brand", "all_deals").`
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
