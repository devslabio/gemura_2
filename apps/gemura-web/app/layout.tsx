import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./config/fontawesome";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#052a54",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://gemura.com'),
  title: {
    default: "Gemura - Milk operations platform",
    template: "%s | Gemura",
  },
  description: "Gemura's comprehensive platform for milk collection, sales, and financial operations management",
  keywords: ["gemura", "milk collection", "milk operations", "sales management", "accounting"],
  authors: [{ name: "Gemura" }],
  creator: "Gemura",
  publisher: "Gemura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-w-0 overflow-x-hidden safe-area-inset" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
