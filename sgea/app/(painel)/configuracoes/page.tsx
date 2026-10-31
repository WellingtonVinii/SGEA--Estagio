"use client";

import { useEffect, useState } from "react";
import Icone from "../../components/Icone";
import TourGuia, { type PassoTour } from "../../components/TourGuia";
import UsuarioLogado from "../../components/UsuarioLogado";

export default function ConfiguracoesPage() {
  const [modoEscuro, setModoEscuro] = useState(false);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setModoEscuro(document.documentElement.dataset.theme === "dark");
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  function alterarTema(escuro: boolean) {
    setModoEscuro(escuro);
    if (escuro) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    window.localStorage.setItem("sgea_tema", escuro ? "escuro" : "claro");
  }

  const passosTour: PassoTour[] = [
    { element: ".settings-card", popover: { title: "Aparência", description: "Ative o modo escuro para deixar as telas mais escuras e confortáveis. A preferência fica salva neste navegador." } },
  ];

  return <div className="content-shell">
    <header className="topbar d-flex align-items-center justify-content-between">
      <div className="topbar-title">Sistema de Estoque</div>
      <UsuarioLogado />
    </header>
    <main className="main-content">
      <div className="breadcrumb"><strong>Configurações</strong></div>
      <div className="title-block title-with-help"><div><h1>Configurações</h1><p>Personalize a aparência do sistema.</p></div><TourGuia passos={passosTour}/></div>
      <section className="settings-card" aria-labelledby="appearance-title">
        <div className="settings-icon"><Icone nome={modoEscuro ? "lua" : "sol"} tamanho={24}/></div>
        <div className="settings-copy">
          <h2 id="appearance-title">Aparência</h2>
          <strong>Modo escuro</strong>
          <p>Escurece as áreas claras do sistema para proporcionar mais conforto visual.</p>
        </div>
        <button
          type="button"
          className={`theme-switch ${modoEscuro ? "active" : ""}`}
          role="switch"
          aria-checked={modoEscuro}
          aria-label="Ativar modo escuro"
          onClick={() => alterarTema(!modoEscuro)}
        >
          <span aria-hidden="true" />
        </button>
      </section>
    </main>
  </div>;
}
