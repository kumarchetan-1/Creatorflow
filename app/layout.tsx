import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import PageTransition from "@/components/PageTransition";
import { Card } from "@/components/ui/Card";
import SidebarUser from "@/components/SidebarUser";
import SidebarNav from "@/components/SidebarNav";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Creatorflow CRM",
  description: "AI-native CRM for content creators"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <div className="flex min-h-screen">
          <aside
            className="fixed inset-y-0 left-0 hidden w-64 border-r md:flex md:flex-col"
            style={{ background: "#0B0B0C", borderColor: "#1C1C1F" }}
          >
            <div className="p-4">
              <Card variant="default" className="px-3 py-2 text-sm font-semibold tracking-tight">
                Creatorflow
              </Card>
            </div>

            <nav className="flex-1 px-3">
              <Suspense fallback={<div className="cf-nav">Chat</div>}>
                <SidebarNav />
              </Suspense>
            </nav>

            <div className="p-4">
              <SidebarUser />
            </div>
          </aside>

          <div className="flex w-full flex-col md:pl-64">
            <div className="border-b md:hidden" style={{ borderColor: "#1C1C1F" }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-semibold tracking-tight">Creatorflow</div>
                <div className="flex items-center gap-3 text-sm">
                  <Link href="/inbox" className="cf-link">
                    Inbox
                  </Link>
                  <Link href="/connections" className="cf-link">
                    Connections
                  </Link>
                  <Link href="/insights" className="cf-link">
                    Insights
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <PageTransition>{children}</PageTransition>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
