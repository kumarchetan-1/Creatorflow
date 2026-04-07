import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creatorflow CRM",
  description: "AI-native CRM for content creators"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
