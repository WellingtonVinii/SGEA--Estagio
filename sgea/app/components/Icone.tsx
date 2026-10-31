import type { ReactNode } from "react";

export default function Icone({ nome, tamanho = 18 }: { nome: string; tamanho?: number }) {
  const caminhos: Record<string, ReactNode> = {
    livro: <><path d="M12 5.5c-2.1-1.4-4.7-1.7-8-.8v14c3.3-.9 5.9-.6 8 .8 2.1-1.4 4.7-1.7 8-.8v-14c-3.3-.9-5.9-.6-8 .8Z"/><path d="M12 5.5v14"/></>,
    inicio: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></>,
    caixa: <><path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/></>,
    categorias: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 15h8"/></>,
    troca: <><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/></>,
    pedidos: <><path d="M7 3h10v3H7z"/><path d="M5 5v16h14V5M8 11h8M8 15h8"/></>,
    entrada: <><path d="M4 4h10v16H4z"/><path d="M9 12h12m-4-4 4 4-4 4"/></>,
    saida: <><path d="M10 4h10v16H10z"/><path d="M15 12H3m4-4-4 4 4 4"/></>,
    visualizar: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    grafico: <><path d="M4 20V4m0 16h16M8 16v-4m5 4V8m5 8V6"/></>,
    usuarios: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/></>,
    funcionarios: <><circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M8 13h8"/></>,
    config: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/></>,
    busca: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    mais: <path d="M12 4v16M4 12h16"/>,
    editar: <><path d="m4 20 4-.8L20 7.2 16.8 4 4.8 16 4 20Z"/><path d="m14.5 6.3 3.2 3.2"/></>,
    lixeira: <><path d="M4 6h16M9 6V4h6v2m3 0-1 15H7L6 6"/><path d="M10 10v7m4-7v7"/></>,
    reativar: <><path d="M5 10V5h5M5 5a8 8 0 1 1-1 12"/></>,
    fechar: <path d="M5 5 19 19M19 5 5 19"/>,
    esquerda: <path d="m15 5-7 7 7 7"/>,
    direita: <path d="m9 5 7 7-7 7"/>,
    baixo: <path d="m6 9 6 6 6-6"/>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    cadeado: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
    sair: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    calendario: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M8 14h2m4 0h2m-8 3h2m4 0h2"/></>,
    marcador: <path d="M6 3h12v18l-6-4-6 4V3Z"/>,
    ajuda: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2h.01"/></>,
    download: <><path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5"/><path d="M4 17v3h16v-3"/></>,
    lua: <path d="M20.5 15.5A9 9 0 0 1 8.5 3.5 9 9 0 1 0 20.5 15.5Z"/>,
    sol: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
  };

  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{caminhos[nome]}</svg>;
}
