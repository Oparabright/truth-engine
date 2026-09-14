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
  metadataBase: new URL("https://genlayer-truth-engine.vercel.app"),
  title: "Truth Engine | Ask the Consensus",
  description:
    "Evidence-backed answers powered by GenLayer Intelligent Consensus. Ask a question, discover evidence, and receive an on-chain Truth Receipt.",
  applicationName: "Truth Engine",
  keywords: [
    "Truth Engine",
    "GenLayer",
    "AI consensus",
    "evidence verification",
    "Intelligent Contracts",
    "Truth Receipt",
  ],
  authors: [{ name: "Truth Engine" }],
  creator: "Truth Engine",
  openGraph: {
    title: "Truth Engine | Ask the Consensus",
    description:
      "Don't trust one AI. Ask the consensus. Evidence-backed verification powered by GenLayer.",
    url: "/",
    siteName: "Truth Engine",
    type: "website",
    images: [
      {
        url: "/truth-engine-logo.png",
        width: 1024,
        height: 1024,
        alt: "Truth Engine",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Truth Engine | Ask the Consensus",
    description:
      "Don't trust one AI. Ask the consensus. Evidence-backed verification powered by GenLayer.",
    images: ["/truth-engine-logo.png"],
  },
  icons: {
    icon: "/truth-engine-logo.png",
    shortcut: "/truth-engine-logo.png",
    apple: "/truth-engine-logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
