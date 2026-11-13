import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "4人じゃんけんシミュレーター（実験2）",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}