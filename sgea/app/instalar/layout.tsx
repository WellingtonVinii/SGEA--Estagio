import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instalar o SGEA | Sistema de Estoque Escolar",
  description: "Instale o SGEA como aplicativo no celular ou no computador.",
};

export default function InstalarLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
