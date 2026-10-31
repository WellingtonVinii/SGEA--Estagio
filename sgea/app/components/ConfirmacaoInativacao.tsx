"use client";

import Icone from "./Icone";

type Props = {
  titulo: string;
  mensagem: string;
  processando: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
};

export default function ConfirmacaoInativacao({ titulo, mensagem, processando, onCancelar, onConfirmar }: Props) {
  return <div className="modal-overlay alert-layer" onMouseDown={evento => {
    if (evento.target === evento.currentTarget && !processando) onCancelar();
  }}>
    <div className="modal-card card border-0 alert-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <button className="icon-button btn alert-close" aria-label="Fechar confirmação" disabled={processando} onClick={onCancelar}><Icone nome="fechar" tamanho={20}/></button>
      <span className="warning-symbol">!</span>
      <h2 id="confirm-title">{titulo}</h2>
      <p id="confirm-message">{mensagem}</p>
      <div className="alert-actions d-flex justify-content-end">
        <button className="button button-secondary btn" disabled={processando} onClick={onCancelar}>Cancelar</button>
        <button className="button button-danger btn" disabled={processando} onClick={onConfirmar}>{processando ? "Inativando..." : "Confirmar inativação"}</button>
      </div>
    </div>
  </div>;
}
