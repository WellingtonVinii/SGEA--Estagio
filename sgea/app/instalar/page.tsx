"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icone from "../components/Icone";
import estilos from "./instalar.module.css";

// Evento do Chrome/Edge que permite abrir a janela de instalação pelo próprio site
type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Modo = "verificando" | "instalavel" | "ios" | "manual" | "instalado" | "concluido";

function jaInstalado() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function ehIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function IconeCompartilhar() {
  return <svg className={estilos.simbolo} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>
  </svg>;
}

export default function InstalarPage() {
  const [modo, setModo] = useState<Modo>("verificando");
  const evento = useRef<EventoInstalacao | null>(null);

  useEffect(() => {
    if (jaInstalado()) { setModo("instalado"); return; }
    if (ehIOS()) { setModo("ios"); return; }

    const aoPoderInstalar = (e: Event) => {
      e.preventDefault();
      evento.current = e as EventoInstalacao;
      setModo("instalavel");
    };
    const aoInstalar = () => { evento.current = null; setModo("concluido"); };

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    // Se o navegador não oferecer a instalação em poucos segundos, mostra o passo a passo manual
    const espera = window.setTimeout(() => setModo(atual => atual === "verificando" ? "manual" : atual), 2500);

    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
      window.clearTimeout(espera);
    };
  }, []);

  async function instalar() {
    const e = evento.current;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    evento.current = null;
    setModo(outcome === "accepted" ? "concluido" : "manual");
  }

  return <main className="login-page">
    <section className="login-card" aria-label="Instalar o aplicativo SGEA">
      <div className="login-brand">
        <span className="login-brand-icon"><Icone nome="livro" tamanho={48}/></span>
        <strong>Instalar o SGEA</strong>
        <span>Sistema de Estoque · Escola Osira</span>
      </div>

      {modo === "verificando" && <p className={estilos.texto}>Verificando o seu aparelho...</p>}

      {modo === "instalavel" && <>
        <p className={estilos.texto}>
          Instale o SGEA como aplicativo para abri-lo direto pelo ícone, em tela cheia, sem precisar do navegador.
        </p>
        <button type="button" className={`login-button ${estilos.botao}`} onClick={instalar}>
          <Icone nome="download" tamanho={18}/> Instalar SGEA
        </button>
      </>}

      {modo === "ios" && <>
        <p className={estilos.texto}>No iPhone e no iPad, a instalação é feita pelo Safari:</p>
        <ol className={estilos.passos}>
          <li>Toque no botão <strong>Compartilhar</strong> <IconeCompartilhar/> na barra do Safari.</li>
          <li>Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.</li>
          <li>Toque em <strong>Adicionar</strong>. O ícone do SGEA aparecerá junto aos seus aplicativos.</li>
        </ol>
      </>}

      {modo === "manual" && <>
        <p className={estilos.texto}>Para instalar, use o menu do seu navegador:</p>
        <ol className={estilos.passos}>
          <li><strong>Android (Chrome):</strong> toque no menu <strong>⋮</strong> e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
          <li><strong>Computador (Chrome ou Edge):</strong> clique no ícone de instalação na barra de endereço ou, no menu, em <strong>Instalar SGEA</strong>.</li>
          <li>Se a opção não aparecer, abra este link no <strong>Chrome</strong> ou no <strong>Edge</strong>.</li>
        </ol>
      </>}

      {modo === "instalado" && <div className={estilos.status}>
        <span aria-hidden="true">✓</span>
        O SGEA já está instalado neste aparelho.
      </div>}

      {modo === "concluido" && <div className={estilos.status}>
        <span aria-hidden="true">✓</span>
        Pronto! O SGEA foi instalado. Procure o ícone junto aos seus aplicativos.
      </div>}

      <Link href="/login" className={estilos.rodape}>Continuar no navegador</Link>
    </section>
  </main>;
}
