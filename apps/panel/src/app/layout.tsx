import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts are self-hosted (Latin subsets, SIL OFL: see ./fonts/OFL.txt) so the
// build never depends on Google Fonts being reachable.
const dmSans = localFont({
  src: "./fonts/DMSans-latin.woff2",
  variable: "--font-dm-sans",
  weight: "100 1000",
  display: "swap",
});

const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-latin.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

const jetbrains = localFont({
  src: "./fonts/JetBrainsMono-latin.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sakutina",
    template: "%s · Sakutina",
  },
  description: "Sakutina Discord bot administration panel",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${bricolage.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
