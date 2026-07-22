import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WeldPilot — Vulcan OmniPro 220 Copilot",
  description:
    "Multimodal diagnostic and setup copilot for the Vulcan OmniPro 220 welder.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
