import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";
import { AlertProvider } from "@/hooks/use-alert";
import { Toaster } from "@/components/ui/toaster";
import { AlertDialog } from "@/components/ui/alert-dialog";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Devit – Asset Delivery Management",
  description: "Internal asset delivery workflow management system for Devit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AlertProvider>
          <ToastProvider>
            {children}
            <Toaster />
            <AlertDialog />
          </ToastProvider>
        </AlertProvider>
      </body>
    </html>
  );
}
