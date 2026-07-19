import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
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
  title: "KARAY Models",
  description:
    "Agência profissional de gestão, marketing e desenvolvimento para criadoras de conteúdo.",
};

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="h-8 w-8"
      fill="currentColor"
    >
      <path d="M16.04 3C8.85 3 3 8.73 3 15.78c0 2.25.6 4.45 1.73 6.38L3 29l7.03-1.8a13.16 13.16 0 0 0 6 1.45h.01C23.23 28.65 29 22.92 29 15.86 29 8.8 23.23 3 16.04 3Zm0 23.49h-.01a10.95 10.95 0 0 1-5.57-1.5l-.4-.24-4.17 1.07 1.11-4-.26-.41a10.52 10.52 0 0 1-1.63-5.63c0-5.86 4.9-10.63 10.94-10.63 6.02 0 10.82 4.82 10.82 10.71 0 5.86-4.84 10.63-10.83 10.63Zm5.99-7.96c-.33-.16-1.95-.94-2.25-1.05-.3-.11-.52-.16-.74.16-.22.32-.85 1.05-1.04 1.27-.19.21-.38.24-.71.08-.33-.16-1.39-.5-2.65-1.6a9.85 9.85 0 0 1-1.83-2.22c-.19-.32-.02-.5.14-.66.15-.15.33-.37.49-.56.16-.18.22-.32.33-.53.11-.21.05-.4-.03-.56-.08-.16-.74-1.75-1.01-2.4-.27-.64-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.4-.3.32-1.14 1.1-1.14 2.67s1.17 3.09 1.33 3.3c.16.21 2.3 3.44 5.57 4.82.78.33 1.39.53 1.87.68.78.24 1.49.21 2.05.13.63-.09 1.95-.78 2.22-1.54.27-.77.27-1.43.19-1.57-.08-.13-.3-.21-.63-.37Z" />
    </svg>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Navbar />

        {children}

        <Footer />
        <FloatingWhatsApp />
      </body>
    </html>
  );
}