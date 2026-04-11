"use client";

import { useEffect, useState } from "react";
import { Button, Card, SectionHeader } from "@/components/ui";
import { buildApiUrl } from "@/lib/base-url";

export default function ConnectionsPage() {
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string>("");
  const [gmailStatus, setGmailStatus] = useState<
    | { connected: boolean; message?: string; inboxCount?: number; sample?: Array<{ subject: string; from: string }> }
    | null
  >(null);
  const [gmailLoading, setGmailLoading] = useState(false);

  async function loadGmailStatus() {
    setGmailLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/gmail/status"));
      const json = (await res.json()) as unknown;
      if (!res.ok || (json as { ok?: unknown } | null)?.ok === false) {
        const msg =
          typeof (json as { error?: unknown } | null)?.error === "string"
            ? (json as { error: string }).error
            : "Failed to load Gmail status.";
        throw new Error(msg);
      }
      const connected = Boolean((json as { connected?: unknown } | null)?.connected);
      const inboxCount =
        typeof (json as { inboxCount?: unknown } | null)?.inboxCount === "number"
          ? (json as { inboxCount: number }).inboxCount
          : undefined;
      const message =
        typeof (json as { message?: unknown } | null)?.message === "string"
          ? (json as { message: string }).message
          : undefined;
      const sampleRaw = (json as { sample?: unknown } | null)?.sample;
      const sample = Array.isArray(sampleRaw)
        ? sampleRaw
            .map((r) => ({
              subject: typeof (r as { subject?: unknown })?.subject === "string" ? (r as { subject: string }).subject : "",
              from: typeof (r as { from?: unknown })?.from === "string" ? (r as { from: string }).from : ""
            }))
            .filter((r) => r.subject || r.from)
        : undefined;

      setGmailStatus({ connected, inboxCount, message, sample });
    } catch (e) {
      setGmailStatus({ connected: false, message: e instanceof Error ? e.message : "Unexpected error." });
    } finally {
      setGmailLoading(false);
    }
  }

  useEffect(() => {
    void loadGmailStatus();
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <SectionHeader
        title="Connections"
        description="Bring Email, Instagram, Upwork, and Forms into one lifecycle."
        className="mb-4"
      />

      <Card variant="xl" className="mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Try it (no setup)</div>
            <div className="mt-1 text-sm cf-muted">
              Adds demo Instagram DM + Upwork lead + Form submission into your Inbox so you can test
              the lifecycle.
            </div>
          </div>
          <div className="shrink-0">
            <Button
              type="button"
              variant="primary"
              disabled={seeding}
              onClick={async () => {
                setSeeding(true);
                setSeedMsg("");
                try {
                  const res = await fetch(buildApiUrl("/api/inbound/test"), { method: "POST" });
                  const json = (await res.json()) as unknown;
                  if (!res.ok || (json as { ok?: unknown } | null)?.ok === false) {
                    const msg =
                      typeof (json as { error?: unknown } | null)?.error === "string"
                        ? (json as { error: string }).error
                        : "Failed to add demo items.";
                    throw new Error(msg);
                  }
                  setSeedMsg("Demo items added. Open Inbox → Convert to deal.");
                } catch (e) {
                  setSeedMsg(e instanceof Error ? e.message : "Unexpected error.");
                } finally {
                  setSeeding(false);
                }
              }}
            >
              {seeding ? "Adding…" : "Add demo inbound items"}
            </Button>
            {seedMsg ? <div className="mt-2 text-xs cf-muted">{seedMsg}</div> : null}
          </div>
        </div>
      </Card>

      <Card variant="xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Gmail</div>
            <div className="mt-2 text-sm cf-muted">
              Connect your Google account so Creatorflow can read your inbox and send replies. Brand
              emails are filtered and summarized in <span className="text-[#EDEDED]">Inbox</span>.
            </div>
            <div className="mt-3 text-xs cf-muted">
              After you approve access, your refresh token is stored securely for your account (table{" "}
              <span className="text-[#EDEDED]">google_oauth_tokens</span> in Supabase).{" "}
              <span className="text-[#EDEDED]">Local-only shortcut:</span> you can still set{" "}
              <span className="text-[#EDEDED]">GOOGLE_REFRESH_TOKEN</span> in{" "}
              <span className="text-[#EDEDED]">.env.local</span> instead of using Connect Gmail.
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-[#EDEDED]">Status</div>
              <div className="mt-1 text-xs cf-muted">
                {gmailLoading
                  ? "Checking…"
                  : gmailStatus?.connected
                    ? `Connected. Inbox messages fetched: ${gmailStatus.inboxCount ?? 0}`
                    : `Not connected. ${gmailStatus?.message ?? ""}`}
              </div>
              {gmailStatus?.connected && (gmailStatus.sample?.length ?? 0) > 0 ? (
                <div className="mt-2 space-y-1 text-xs cf-muted">
                  {(gmailStatus.sample ?? []).slice(0, 3).map((r, idx) => (
                    <div key={idx} className="truncate">
                      {r.subject ? r.subject : "—"} {r.from ? `• ${r.from}` : ""}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 md:items-end">
            <a
              href={buildApiUrl("/api/google/auth")}
              className="cf-button-primary w-full px-4 py-2 text-center md:w-auto"
            >
              Connect Gmail
            </a>
            <Button type="button" onClick={loadGmailStatus} disabled={gmailLoading}>
              {gmailLoading ? "Checking…" : "Re-check status"}
            </Button>
            <span className="text-xs cf-muted md:text-right">Starts Google OAuth (read + send)</span>
          </div>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        <Card variant="xl">
          <div className="text-sm font-semibold">Instagram DMs (webhook)</div>
          <div className="mt-2 text-sm cf-muted">
            Post messages into Creatorflow to unify your deal lifecycle. Endpoint:{" "}
            <span className="text-[#EDEDED]">POST /api/inbound/instagram</span> with{" "}
            <span className="text-[#EDEDED]">Authorization: Bearer INBOUND_WEBHOOK_SECRET</span>.
          </div>
        </Card>

        <Card variant="xl">
          <div className="text-sm font-semibold">Upwork (webhook)</div>
          <div className="mt-2 text-sm cf-muted">
            Send job invites / messages into Creatorflow. Endpoint:{" "}
            <span className="text-[#EDEDED]">POST /api/inbound/upwork</span> with{" "}
            <span className="text-[#EDEDED]">Authorization: Bearer INBOUND_WEBHOOK_SECRET</span>.
          </div>
        </Card>

        <Card variant="xl">
          <div className="text-sm font-semibold">Inbound forms (webhook)</div>
          <div className="mt-2 text-sm cf-muted">
            Pipe website form submissions into the same inbox. Endpoint:{" "}
            <span className="text-[#EDEDED]">POST /api/inbound/form</span> with{" "}
            <span className="text-[#EDEDED]">Authorization: Bearer INBOUND_WEBHOOK_SECRET</span>.
          </div>
        </Card>
      </div>

      <Card variant="xl" className="mt-4">
        <div className="text-sm font-semibold">Webhooks (for production)</div>
        <div className="mt-2 text-sm cf-muted">
          Set <span className="text-[#EDEDED]">INBOUND_WEBHOOK_SECRET</span> in{" "}
          <span className="text-[#EDEDED]">.env.local</span> (and in prod) to protect inbound
          endpoints.
        </div>
      </Card>
    </main>
  );
}

