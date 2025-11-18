import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { UserProvider } from "@/lib/hooks/use-user";
import { getUser } from "@/lib/actions/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini mart",
  description: "Mini mart",
  generator: "Mini mart",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <UserProvider initialUser={user}>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1 flex flex-col mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </UserProvider>
        <Toaster position="top-right" richColors closeButton duration={4000} />
        <Analytics />
      </body>
    </html>
  );
}
