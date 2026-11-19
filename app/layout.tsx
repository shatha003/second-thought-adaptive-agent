import type { Metadata, Viewport } from "next";
import { Caveat, Courier_Prime, Newsreader, UnifrakturMaguntia } from "next/font/google";
import "./globals.css";

const blackletter = UnifrakturMaguntia({ variable: "--font-blackletter", subsets: ["latin"], weight: "400" });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const courier = Courier_Prime({ variable: "--font-courier", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Second Thought",
  description:
    "An agent that proofreads its own plan: it notices when reality changed, changes its mind safely, and prints the correction.",
};

export const viewport: Viewport = {
  themeColor: "#ecebe6",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${blackletter.variable} ${newsreader.variable} ${caveat.variable} ${courier.variable}`}>
      <body className="min-h-[100dvh] overflow-x-hidden">{children}</body>
    </html>
  );
}
