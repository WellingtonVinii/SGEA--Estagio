"use client";

import Link from "next/link";
import Icone from "../../components/Icone";
import TourGuia, { type PassoTour } from "../../components/TourGuia";
import UsuarioLogado from "../../components/UsuarioLogado";

export default function InicioPage() {
  const passosTour: PassoTour[] = [
    { popover: { title: "Bem-vindo ao SGEA", description: "O Sistema de Gestão de Estoque do Almoxarifado controla os produtos, pedidos, entradas, saídas e ajustes do estoque da escola." } },
    { element: ".sidebar nav", popover: { title: "Menu", description: "Use o menu para acessar as telas. As opções exibidas dependem do seu perfil." } },
    { element: ".home-cards", popover: { title: "Atalhos", description: "Acesse rapidamente as funcionalidades mais usadas." } },
    { element: ".user-area", popover: { title: "Seu usuário", description: "Clique aqui para ver seus dados e sair do sistema." } },
    { popover: { title: "Precisa de ajuda?", description: "Em todas as telas existe este botão de ajuda (?) ao lado do título, que explica como usar aquela tela." } },
  ];

  return <div className="content-shell">
    <header className="topbar d-flex align-items-center justify-content-between">
      <div className="topbar-title">Sistema de Estoque</div>
      <UsuarioLogado />
    </header>
    <main className="main-content">
      <div className="breadcrumb">Início</div>
      <div className="title-block title-with-help"><div><h1>Bem-vindo ao SGEA</h1><p>Acesse as funcionalidades disponíveis para o seu perfil.</p></div><TourGuia passos={passosTour}/></div>
      <section className="home-cards" aria-label="Atalhos do sistema">
        <Link href="/produtos" className="home-card"><span><Icone nome="caixa" tamanho={28}/></span><div><strong>Produtos</strong><small>Consulte e gerencie os produtos do estoque.</small></div><Icone nome="direita" tamanho={18}/></Link>
        <Link href="/pedidos" className="home-card"><span><Icone nome="pedidos" tamanho={28}/></span><div><strong>Pedidos de compra</strong><small>Acompanhe as solicitações e seus recebimentos.</small></div><Icone nome="direita" tamanho={18}/></Link>
        <Link href="/entradas" className="home-card"><span><Icone nome="entrada" tamanho={28}/></span><div><strong>Entradas</strong><small>Registre produtos recebidos e atualize o estoque.</small></div><Icone nome="direita" tamanho={18}/></Link>
        <Link href="/saidas" className="home-card"><span><Icone nome="saida" tamanho={28}/></span><div><strong>Saídas</strong><small>Registre a distribuição de materiais do estoque.</small></div><Icone nome="direita" tamanho={18}/></Link>
        <Link href="/configuracoes" className="home-card"><span><Icone nome="config" tamanho={28}/></span><div><strong>Configurações</strong><small>Acesse as configurações disponíveis.</small></div><Icone nome="direita" tamanho={18}/></Link>
      </section>
    </main>
  </div>;
}
