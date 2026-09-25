import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#facc00",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "Nihongofy - Belajar Bahasa Jepang & Simulasi JLPT",
    template: "%s | Nihongofy",
  },
  description:
    "Platform belajar bahasa Jepang dan simulasi JLPT (N5 - N1) yang interaktif, terarah, dan menyenangkan. Lengkap dengan Kana, kosakata, latihan cepat, mock test, dan analitik.",
  applicationName: "Nihongofy",
  keywords: [
    "Nihongofy",
    "belajar bahasa Jepang",
    "JLPT N5",
    "JLPT N4",
    "JLPT N3",
    "JLPT N2",
    "JLPT N1",
    "mock test JLPT",
    "latihan JLPT",
    "hiragana",
    "katakana",
    "kosakata jepang",
    "dokkai",
    "bunpou",
    "choukai",
  ],
  authors: [{ name: "Nihongofy" }],
  creator: "Nihongofy",
  publisher: "Nihongofy",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Nihongofy - Belajar Bahasa Jepang & Simulasi JLPT",
    description:
      "Platform belajar bahasa Jepang dan simulasi JLPT (N5 - N1) dengan cara yang menyenangkan, tegas, dan terarah.",
    url: SITE_URL,
    siteName: "Nihongofy",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nihongofy - Belajar Bahasa Jepang & Simulasi JLPT",
    description:
      "Platform belajar bahasa Jepang dan simulasi JLPT (N5 - N1) dengan cara yang menyenangkan, tegas, dan terarah.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
