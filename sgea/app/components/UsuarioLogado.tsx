"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icone from "./Icone";

type UsuarioSessao = {
  funcionarioNome?: string;
  perfil?: string;
};

export default function UsuarioLogado() {
  const router = useRouter();
  const areaRef = useRef<HTMLDivElement>(null);
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      try {
        const dados = window.localStorage.getItem("sgea_usuario");
        setUsuario(dados ? JSON.parse(dados) as UsuarioSessao : null);
      } catch {
        setUsuario(null);
      }
    }, 0);

    const fechar = (evento: MouseEvent) => {
      if (!areaRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("mousedown", fechar);
    };
  }, []);

  function sair() {
    window.localStorage.removeItem("sgea_token");
    window.localStorage.removeItem("sgea_usuario");
    router.replace("/login");
  }

  return <div className="logged-user" ref={areaRef}>
    <button className="user-area" type="button" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
      <span className="user-avatar"><Icone nome="usuarios" tamanho={18}/></span>
      <span className="user-copy"><strong>{usuario?.funcionarioNome || "Usuário"}</strong><small>{usuario?.perfil || "Sistema de Estoque"}</small></span>
      <span className={aberto ? "user-chevron user-chevron-open" : "user-chevron"}><Icone nome="baixo" tamanho={14}/></span>
    </button>
    {aberto && <div className="user-menu" role="menu">
      <div className="user-menu-identification"><strong>{usuario?.funcionarioNome || "Usuário"}</strong><small>{usuario?.perfil || "Perfil não informado"}</small></div>
      <button type="button" role="menuitem" onClick={sair}><Icone nome="sair" tamanho={17}/> Sair do sistema</button>
    </div>}
  </div>;
}
