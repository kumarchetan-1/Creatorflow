"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/auth-client";
import { Button, Card, Input, SectionHeader } from "@/components/ui";

function SigninForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath =
    (() => {
      const n = searchParams.get("next");
      if (n?.startsWith("/") && !n.startsWith("//")) return n;
      return "/chat";
    })();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-1px)] w-full max-w-md items-center px-6 py-10">
      <div className="w-full">
        <SectionHeader
          title="Welcome back"
          description="Sign in to continue."
          className="mb-4"
        />

        <Card variant="xl">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <div className="text-xs cf-muted">Email</div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs cf-muted">Password</div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error ? <div className="text-sm">{error}</div> : null}

            <div className="pt-2 space-y-3">
              <Button variant="primary" type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in…" : "Sign in"}
              </Button>

              <div className="text-sm cf-muted">
                New here?{" "}
                <Link href="/signup" className="cf-link">
                  Create an account
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-[#1C1C1F]" />
              <div className="text-xs cf-muted">or</div>
              <div className="h-px flex-1 bg-[#1C1C1F]" />
            </div>

            <Button
              type="button"
              disabled={loading}
              className="w-full justify-center gap-2"
              onClick={async () => {
                if (loading) return;
                setError(null);
                setLoading(true);
                try {
                  const supabase = createSupabaseBrowserClient();
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
                    }
                  });
                  if (error) throw error;
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Google sign-in failed.";
                  setError(msg);
                  setLoading(false);
                }
              }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5A9.5 9.5 0 1 0 12 21.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
                <path fill="#34A853" d="M3.9 7.9l3.2 2.3C8 8.2 9.8 6.9 12 6.9c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 8.4 2.5 5.2 4.5 3.9 7.9z"/>
                <path fill="#FBBC05" d="M12 21.5c2.5 0 4.6-.8 6.2-2.3l-2.9-2.4c-.8.6-1.8 1-3.3 1-2.5 0-4.6-1.7-5.4-4l-3.2 2.5A9.5 9.5 0 0 0 12 21.5z"/>
                <path fill="#4285F4" d="M21.1 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.4-1.1 2.6-2.2 3.4l2.9 2.4c1.7-1.6 2.9-4 2.9-7.1z"/>
              </svg>
              Continue with Google
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

export default function SigninPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[calc(100vh-1px)] w-full max-w-md items-center px-6 py-10">
          <div className="w-full text-sm cf-muted">Loading…</div>
        </main>
      }
    >
      <SigninForm />
    </Suspense>
  );
}

