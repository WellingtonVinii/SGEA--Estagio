"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

function tokenValido(token: string) {
  try {
    const parte = token.split(".")[1];
    if (!parte) return false;
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export default function ProtecaoAutenticacao({ children }: { children: ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("sgea_token");
    if (!token || !tokenValido(token)) {
      window.localStorage.removeItem("sgea_token");
      window.localStorage.removeItem("sgea_usuario");
      router.replace("/login");
      return;
    }
    try {
      const usuario = JSON.parse(window.localStorage.getItem("sgea_usuario") || "{}") as { perfil?: string };
      const perfil = String(usuario.perfil ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const administrador = ["adm", "administrador", "adiministrador"].includes(perfil);
      const permitidas = ["/inicio", "/produtos", "/estoque", "/historico", "/pedidos", "/entradas", "/configuracoes"];
      if (!administrador && !permitidas.some(rota => caminho === rota || caminho.startsWith(`${rota}/`))) {
        router.replace("/produtos");
        return;
      }
    } catch {
      router.replace("/produtos");
      return;
    }
    const temporizador = window.setTimeout(() => setAutenticado(true), 0);
    return () => window.clearTimeout(temporizador);
  }, [caminho, router]);

  if (!autenticado) {
    return <main className="auth-loading" aria-live="polite">Verificando acesso...</main>;
  }

  return children;
}
