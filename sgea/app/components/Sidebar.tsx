"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icone from "./Icone";

const itens = [
  { icone: "inicio", texto: "Início", rota: "/inicio", somenteAdm: false },
  { icone: "caixa", texto: "Produtos", rota: "/produtos", somenteAdm: false },
  { icone: "livro", texto: "Estoque", rota: "/estoque", somenteAdm: false },
  { icone: "pedidos", texto: "Pedidos de compra", rota: "/pedidos", somenteAdm: false },
  { icone: "entrada", texto: "Entradas", rota: "/entradas", somenteAdm: false },
  { icone: "saida", texto: "Saídas", rota: "/saidas", somenteAdm: false },
  { icone: "categorias", texto: "Categorias", rota: "/categorias", somenteAdm: true },
  { icone: "troca", texto: "Ajuste", rota: "/movimentacoes", somenteAdm: false },
  { icone: "calendario", texto: "Histórico", rota: "/historico", somenteAdm: false },
  { icone: "funcionarios", texto: "Funcionários", rota: "/funcionarios", somenteAdm: true },
  { icone: "usuarios", texto: "Usuários", rota: "/usuarios", somenteAdm: true },
  { icone: "config", texto: "Configurações", rota: "/configuracoes", somenteAdm: false },
];

function perfilAdministrador(perfil?: string) {
  const normalizado = String(perfil ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ["adm", "administrador", "adiministrador"].includes(normalizado);
}

export default function Sidebar() {
  const caminho = usePathname();
  const [administrador, setAdministrador] = useState(false);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      try {
        const usuario = JSON.parse(window.localStorage.getItem("sgea_usuario") || "{}") as { perfil?: string };
        setAdministrador(perfilAdministrador(usuario.perfil));
      } catch { setAdministrador(false); }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  return <aside className="sidebar d-flex flex-column flex-shrink-0">
    <div className="brand d-flex align-items-center">
      <span className="brand-icon"><Icone nome="livro" tamanho={26}/></span>
      <span><strong>Escola Osira</strong><small>Sistema de Estoque</small></span>
    </div>
    <nav aria-label="Menu principal" className="nav-list nav nav-pills flex-column">
      {itens.filter(item => administrador || !item.somenteAdm).map(item => {
        const ativa = caminho === item.rota || caminho.startsWith(`${item.rota}/`);
        return <Link key={item.rota} href={item.rota} className={`nav-item nav-link d-flex align-items-center ${ativa ? "nav-active active" : ""}`} aria-current={ativa ? "page" : undefined}>
          <Icone nome={item.icone}/><span>{item.texto}</span>
        </Link>;
      })}
    </nav>
    <div className="sidebar-bottom">SGEA · Gestão Escolar</div>
  </aside>;
}
