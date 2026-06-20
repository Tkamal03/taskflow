import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
// 👆 SessionProvider — makes session available everywhere in app

export const metadata: Metadata = {
  title: "TaskFlow",
  description: "Manage your tasks efficiently",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {/* 👆 Wraps entire app — session accessible everywhere */}
          {children}
          {/* 👆 children — renders the current page */}
        </SessionProvider>
      </body>
    </html>
  );
}