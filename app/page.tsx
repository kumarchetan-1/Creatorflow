import { Suspense } from "react";
import ChatHome from "@/components/ChatHome";

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[700px] p-6 text-sm text-[#9CA3AF]">Loading chat…</main>}>
      <ChatHome />
    </Suspense>
  );
}
