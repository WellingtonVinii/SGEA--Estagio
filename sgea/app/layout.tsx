import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SGEA | Sistema de Estoque Escolar",
  description: "Sistema de Gestão de Estoque Escolar",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("sgea_tema")==="escuro")document.documentElement.dataset.theme="dark"}catch(e){}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
