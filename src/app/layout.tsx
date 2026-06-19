import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { themeScript } from "@/lib/theme/themeScript";
// Fail-fast environment validation. Importing for its module-load side effect:
// in production this throws at boot if required runtime vars (DATABASE_URL,
// Supabase auth keys) are missing/placeholder, rather than silently degrading.
import "@/lib/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SymbioKnowledgeBase",
    template: "%s | SymbioKnowledgeBase",
  },
  description: "AI-agent-first knowledge management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
