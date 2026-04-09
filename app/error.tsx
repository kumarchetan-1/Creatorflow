"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-lg p-6">
      <h2 className="text-lg font-semibold tracking-tight">Something went wrong</h2>
      <p className="mt-2 text-sm cf-muted">{error.message}</p>
      <button type="button" onClick={() => reset()} className="cf-button-primary mt-4 px-4 py-2 text-sm font-medium">
        Try again
      </button>
    </main>
  );
}
