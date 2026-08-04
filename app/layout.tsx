import ConditionalPublicLayout from "@/components/ConditionalPublicLayout";
import IdleTimeoutProvider from "@/components/IdleTimeoutProvider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The tab title and the search-result description follow the reader's language
 * like everything else. `getTranslations` resolves through the same request
 * config the page body uses, so the two can never disagree.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved server-side, before a single element renders. This is what keeps
  // `lang` honest and what keeps the first paint from being in the wrong
  // language and then correcting itself.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <IdleTimeoutProvider>
            <ConditionalPublicLayout>
              {children}
            </ConditionalPublicLayout>
          </IdleTimeoutProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
