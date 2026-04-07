import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const to = typeof (body as { to?: unknown })?.to === "string" ? (body as { to: string }).to : "";
    const subject =
      typeof (body as { subject?: unknown })?.subject === "string"
        ? (body as { subject: string }).subject
        : "";
    const messageBody =
      typeof (body as { body?: unknown })?.body === "string" ? (body as { body: string }).body : "";

    const id = await sendEmail(to, subject, messageBody);
    return NextResponse.json({ ok: true, message: "Email sent successfully.", id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

