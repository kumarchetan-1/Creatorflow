"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0B0B0C",
          color: "#EDEDED",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          margin: 0
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</h2>
        <p style={{ marginTop: 8, color: "#9CA3AF", fontSize: 14 }}>{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            borderRadius: 16,
            border: "1px solid #1C1C1F",
            background: "#fff",
            color: "#0B0B0C",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer"
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
