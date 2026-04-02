import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Minority Market | On-Chain Prediction",
  description: "Pick the minority. Fewer wins more. Pure on-chain game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen`}>
        <ClientLayout>
          <div className="flex flex-col min-h-screen">
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              Minority Market
            </footer>
          </div>
        </ClientLayout>
      </body>
    </html>
  );
}
