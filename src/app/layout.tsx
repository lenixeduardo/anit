import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANIT Headshop — Vidro, cultura e estilo",
  description:
    "Explore as coleções ANIT de bongs, maçaricos e acessórios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50">
        {children}
      </body>
    </html>
  );
}
