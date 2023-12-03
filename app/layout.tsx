import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";

const font = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Next.js on GCP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={font.className}>
        <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-gray-50 py-8 lg:py-12">
          <div className="w-full bg-white px-6 py-8 shadow-xl shadow-slate-700/10 ring-1 ring-gray-900/5 md:mx-auto md:max-w-3xl lg:max-w-4xl lg:pb-28 lg:pt-16">
            <article className="prose prose-slate lg:prose-lg mx-auto mt-4">
              {children}
            </article>
          </div>
        </main>
      </body>
    </html>
  );
}
