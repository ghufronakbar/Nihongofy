import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JLPT Exam",
    template: "%s | JLPT Exam",
  },
  description:
    "Platform belajar dan latihan JLPT dengan mock test, review jawaban, dan analitik progres.",
  applicationName: "JLPT Exam",
  keywords: ["JLPT", "belajar bahasa Jepang", "mock test JLPT", "latihan JLPT"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
