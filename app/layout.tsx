import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nova Cidade • Gestão da Igreja",
  description:
    "Igreja de Cristo em Nova Cidade — ministérios, atividades e tesouraria",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
