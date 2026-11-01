import { Fraunces, Figtree, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--serif", style: ["normal", "italic"], display: "swap" });
const sans = Figtree({ subsets: ["latin"], variable: "--sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--mono", display: "swap" });

export const metadata = {
  title: "Worker",
  description: "Server defense dashboard",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%236a3ae9' d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>" },
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#b3b9ff" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
