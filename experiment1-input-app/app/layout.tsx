import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "じゃんけん 1000（実験1 入力アプリ）",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}