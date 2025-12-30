import type { Metadata } from "next";
import { Poppins, Lexend } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

const fontBody = Poppins({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const fontHeadline = Lexend({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["500", "700"],
});


export const metadata: Metadata = {
  title: "Timetable Weaver",
  description: "An AI-powered school timetable planner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Lexend:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn(
          "font-body antialiased",
          fontBody.variable,
          fontHeadline.variable
        )}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
