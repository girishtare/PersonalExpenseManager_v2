import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Script from "next/script";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Personal Expense Manager",
  description: "Track income, expenses, and spending trends across your bank accounts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} h-full antialiased`}
      // The beforeInteractive theme-init script adds/removes the "dark" class on this
      // element before hydration, which intentionally differs from the server-rendered
      // markup - suppress the (expected) one-time mismatch warning for it.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
