import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const shoulders = Big_Shoulders({ variable: "--font-shoulders", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Second Thought",
  description:
    "An agent that notices when reality changed, changes its mind safely, and shows you exactly why.",
};

export const viewport: Viewport = {
  themeColor: "#090a0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${shoulders.variable} ${instrument.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-[100dvh] overflow-x-hidden">{children}</body>
    </html>
  );
}
