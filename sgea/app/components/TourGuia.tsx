"use client";

import { useCallback } from "react";
import type { DriveStep, PopoverDOM } from "driver.js";
import "driver.js/dist/driver.css";
import Icone from "./Icone";

export type PassoTour = DriveStep;

type Gancho = NonNullable<NonNullable<DriveStep["popover"]>["onNextClick"]>;
const esperaRenderizacao = 150;

// Localiza um campo pelo texto do seu rótulo (ex.: "Nome", "CPF"), dentro do formulário aberto ou da área informada.
export function campoTour(rotulo: string, escopo = ".modal-card") {
  return () => [...document.querySelectorAll(`${escopo} .field`)]
    .find(campo => campo.querySelector("span")?.textContent?.trim().startsWith(rotulo)) as Element;
}

// Para elementos que só existem depois que o tour abre um formulário.
export function elementoTour(seletor: string) {
  return () => document.querySelector(seletor) as Element;
}

// Executa uma ação (ex.: abrir o formulário) e avança quando a tela estiver atualizada.
export function avancarApos(acao: () => void): Gancho {
  return (_elemento, _passo, { driver }) => { acao(); window.setTimeout(() => driver.moveNext(), esperaRenderizacao); };
}

export function voltarApos(acao: () => void): Gancho {
  return (_elemento, _passo, { driver }) => { acao(); window.setTimeout(() => driver.movePrevious(), esperaRenderizacao); };
}

export default function TourGuia({ passos, aoFinalizar }: { passos: PassoTour[]; aoFinalizar?: () => void }) {
  const iniciarTour = useCallback(async () => {
    const { driver } = await import("driver.js");
    // Passos com seletor de elemento ausente (ex.: lista vazia) são ignorados.
    // Passos com função são mantidos, pois apontam para formulários abertos durante o tour.
    const passosVisiveis = passos.filter(passo => !passo.element || typeof passo.element !== "string" || document.querySelector(passo.element));
    driver({
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Próximo →",
      prevBtnText: "← Anterior",
      doneBtnText: "✓ Concluir",
      overlayOpacity: 0.6,
      smoothScroll: true,
      popoverClass: "sgea-tour",
      steps: passosVisiveis,
      onPopoverRender: (popover: PopoverDOM) => popover.wrapper.setAttribute("lang", "pt-BR"),
      onDestroyed: () => aoFinalizar?.(),
    }).drive();
  }, [passos, aoFinalizar]);

  return <button type="button" className="help-button btn" title="Ajuda — como usar esta tela" aria-label="Ajuda — como usar esta tela" onClick={() => void iniciarTour()}>
    <Icone nome="ajuda" tamanho={20}/>
  </button>;
}
