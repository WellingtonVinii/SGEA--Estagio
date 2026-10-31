"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, type PassoTour } from "../../components/TourGuia";
import { baixarRelatorioPdf, dataIsoBrasileira, periodoTexto } from "../../components/relatorioPdf";
import UsuarioLogado from "../../components/UsuarioLogado";

type TipoMovimentacao = "Entrada" | "Saída" | "Ajuste";
type ItemMovimentacao = { id: number; produtoNome: string; codigoLote: string; dataValidade: string | null; quantidade: number; justificativa: string | null };
type Funcionario = { id: number; nome: string };
type Movimentacao = {
  chave: string; tipo: TipoMovimentacao; id: number; dataHora: string; possuiHora: boolean; funcionarioId: number; funcionarioNome: string;
  complementoRotulo: string; complemento: string; observacao: string | null; itens: ItemMovimentacao[]; totalUnidades: number;
};

const itensVisiveis = 3;

class ApiError extends Error {
  constructor(public status: number, dados: { erro?: string }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(caminho: string): Promise<T> {
  const token = window.localStorage.getItem("sgea_token");
  const resposta = await fetch(`/api/historico${caminho}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const dados = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) {
    window.localStorage.removeItem("sgea_token");
    window.localStorage.removeItem("sgea_usuario");
    window.location.replace("/login");
  }
  if (!resposta.ok) throw new ApiError(resposta.status, dados);
  return dados as T;
}

function dataMovimentacao(movimentacao: Movimentacao) {
  const [data, hora = ""] = movimentacao.dataHora.split(" ");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}${movimentacao.possuiHora ? ` às ${hora.slice(0, 5)}` : ""}`;
}

function dataBrasileira(valor: string | null) {
  if (!valor) return "Sem validade";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function quantidadeComSinal(quantidade: number) {
  return quantidade > 0 ? `+${quantidade}` : String(quantidade);
}

function classeQuantidade(quantidade: number) {
  return quantidade > 0 ? "history-quantity history-quantity-in" : "history-quantity history-quantity-out";
}

export default function HistoricoPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [produto, setProduto] = useState("");
  const [produtoConsulta, setProdutoConsulta] = useState("");
  const [funcionarioId, setFuncionarioId] = useState("");
  const [tipo, setTipo] = useState("");
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const periodoInvalido = Boolean(dataInicio && dataFim && dataInicio > dataFim);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setProdutoConsulta(produto.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [produto]);

  useEffect(() => {
    const temporizador = window.setTimeout(async () => {
      try { setFuncionarios(await requisicao<Funcionario[]>("/funcionarios")); }
      catch { setFuncionarios([]); }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  const carregarHistorico = useCallback(async () => {
    if (periodoInvalido) return;
    setCarregando(true);
    setErroLista("");
    try { setMovimentacoes(await requisicao<Movimentacao[]>(`?${new URLSearchParams({ dataInicio, dataFim, produto: produtoConsulta, funcionarioId, tipo })}`)); }
    catch {
      setMovimentacoes([]);
      setErroLista("Não foi possível consultar o histórico de movimentações.");
    } finally { setCarregando(false); }
  }, [dataInicio, dataFim, produtoConsulta, funcionarioId, tipo, periodoInvalido]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarHistorico(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarHistorico]);

  const alternar = (chave: string) => setExpandidas(atuais => {
    const proximas = new Set(atuais);
    if (proximas.has(chave)) proximas.delete(chave);
    else proximas.add(chave);
    return proximas;
  });

  const contar = (tipo: TipoMovimentacao) => movimentacoes.filter(movimentacao => movimentacao.tipo === tipo).length;

  const baixarPdf = () => baixarRelatorioPdf({
    titulo: "Histórico de Movimentações",
    arquivo: "historico-movimentacoes.pdf",
    informacoes: [
      ["Período", periodoTexto(dataInicio, dataFim)],
      ["Produto", produtoConsulta || "Todos"],
      ["Funcionário", funcionarios.find(funcionario => String(funcionario.id) === funcionarioId)?.nome ?? "Todos"],
      ["Tipo", tipo || "Todos"],
      ["Total", `${movimentacoes.length} movimentação(ões): ${contar("Entrada")} entrada(s), ${contar("Saída")} saída(s), ${contar("Ajuste")} ajuste(s)`]
    ],
    tabelas: [{
      colunas: ["Tipo", "Data", "Produto", "Lote", "Quantidade", "Responsável"],
      linhas: movimentacoes.flatMap(movimentacao => movimentacao.itens.map((item, indice) => [
        indice ? "" : `${movimentacao.tipo} Nº ${movimentacao.id}`,
        indice ? "" : dataIsoBrasileira(movimentacao.possuiHora ? movimentacao.dataHora : movimentacao.dataHora.slice(0, 10)),
        item.produtoNome, `Lote ${item.codigoLote}`, quantidadeComSinal(item.quantidade), indice ? "" : movimentacao.funcionarioNome
      ]))
    }]
  });

  const passosTour: PassoTour[] = [
    { popover: { title: "Histórico de Movimentações", description: "Todas as entradas, saídas e ajustes em uma única lista, da mais recente para a mais antiga. Esta tela é apenas para consulta." } },
    { element: campoTour("Produto", ".filter-panel"), popover: { title: "Produto", description: "Mostra apenas as movimentações do produto informado." } },
    { element: campoTour("Funcionário", ".filter-panel"), popover: { title: "Funcionário", description: "Mostra apenas as movimentações registradas pelo funcionário selecionado." } },
    { element: campoTour("Tipo", ".filter-panel"), popover: { title: "Tipo de movimentação", description: "Entrada, Saída ou Ajuste." } },
    { element: campoTour("Data inicial", ".filter-panel"), popover: { title: "Período", description: "Informe a data inicial e a final. As duas datas entram no resultado." } },
    { element: ".filter-panel .pdf-button", popover: { title: "Baixar PDF", description: "Gera um PDF do histórico exibido, respeitando os filtros aplicados." } },
    { element: ".history-table", popover: { title: "Lista de movimentações", description: "Mostra tipo, data, produtos, lotes, quantidades e responsável. Quantidades com + aumentaram o estoque e com - diminuíram." } },
    { element: ".history-table tbody tr:first-child .stock-toggle", popover: { title: "Ver detalhes", description: "Clique na seta, ou em qualquer parte da linha, para ver todos os itens, o pedido, o destinatário ou o solicitante e a observação." } },
  ];

  return <div className="content-shell">
    <header className="topbar d-flex align-items-center justify-content-end"><UsuarioLogado /></header>
    <main className="main-content history-content">
      <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Histórico</strong></div>
      <div className="title-block title-with-help"><div><h1>Histórico de Movimentações</h1><p>Consulte as entradas, saídas e ajustes realizados no estoque.</p></div><TourGuia passos={passosTour}/></div>

      <section className="filter-panel history-filters d-flex align-items-end">
        <label className="field form-label history-product"><span>Produto</span><input className="form-control" placeholder="Nome do produto..." value={produto} onChange={evento => setProduto(evento.target.value)}/></label>
        <label className="field form-label"><span>Funcionário</span><select className="form-select" value={funcionarioId} onChange={evento => setFuncionarioId(evento.target.value)}><option value="">Todos</option>{funcionarios.map(funcionario => <option key={funcionario.id} value={funcionario.id}>{funcionario.nome}</option>)}</select></label>
        <label className="field form-label"><span>Tipo</span><select className="form-select" value={tipo} onChange={evento => setTipo(evento.target.value)}><option value="">Todos</option><option>Entrada</option><option>Saída</option><option>Ajuste</option></select></label>
        <label className="field form-label"><span>Data inicial</span><input className="form-control" type="date" value={dataInicio} onChange={evento => setDataInicio(evento.target.value)}/></label>
        <label className="field form-label"><span>Data final</span><input className="form-control" type="date" value={dataFim} onChange={evento => setDataFim(evento.target.value)}/></label>
        {(dataInicio || dataFim || produto || funcionarioId || tipo) && <button className="button button-secondary btn history-clear" onClick={() => { setDataInicio(""); setDataFim(""); setProduto(""); setFuncionarioId(""); setTipo(""); }}>Limpar filtros</button>}
        <button className="button button-secondary btn pdf-button" disabled={carregando || periodoInvalido || !movimentacoes.length} onClick={baixarPdf}><Icone nome="download" tamanho={17}/> Baixar PDF</button>
      </section>
      {periodoInvalido && <div className="stock-period-error" role="alert">Período inválido: a data inicial deve ser anterior ou igual à data final. Corrija o período para consultar.</div>}

      {!periodoInvalido && <section className="table-panel history-table">
        {!carregando && !erroLista && movimentacoes.length > 0 && <div className="stock-summary">
          <span className="stock-summary-count">{movimentacoes.length} movimentação(ões)</span>
          <span className="history-type history-type-entrada">{contar("Entrada")} entrada(s)</span>
          <span className="history-type history-type-saida">{contar("Saída")} saída(s)</span>
          <span className="history-type history-type-ajuste">{contar("Ajuste")} ajuste(s)</span>
        </div>}
        <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th aria-label="Expandir"></th><th>Tipo</th><th>Data</th><th>Produto</th><th>Lote</th><th>Quantidade</th><th>Responsável</th></tr></thead><tbody>
          {!carregando && !erroLista && movimentacoes.map(movimentacao => {
            const aberta = expandidas.has(movimentacao.chave);
            const visiveis = movimentacao.itens.slice(0, itensVisiveis);
            const ocultos = movimentacao.itens.length - visiveis.length;
            return <Fragment key={movimentacao.chave}>
              <tr className="history-row" onClick={() => alternar(movimentacao.chave)}>
                <td><button className={`stock-toggle btn${aberta ? " stock-toggle-open" : ""}`} aria-expanded={aberta} aria-label={`${aberta ? "Recolher" : "Expandir"} ${movimentacao.tipo} ${movimentacao.id}`} onClick={evento => { evento.stopPropagation(); alternar(movimentacao.chave); }}><Icone nome="direita" tamanho={16}/></button></td>
                <td><span className={`history-type history-type-${movimentacao.tipo === "Saída" ? "saida" : movimentacao.tipo.toLowerCase()}`}>{movimentacao.tipo}</span><small className="history-number">Nº {movimentacao.id}</small></td>
                <td className="history-date">{dataMovimentacao(movimentacao)}</td>
                <td><div className="history-lines">{visiveis.map(item => <span key={item.id}>{item.produtoNome}</span>)}{ocultos > 0 && <em>+{ocultos} item(ns)</em>}</div></td>
                <td><div className="history-lines">{visiveis.map(item => <span key={item.id}>Lote {item.codigoLote}</span>)}</div></td>
                <td><div className="history-lines">{visiveis.map(item => <span key={item.id} className={classeQuantidade(item.quantidade)}>{quantidadeComSinal(item.quantidade)}</span>)}</div></td>
                <td>{movimentacao.funcionarioNome}</td>
              </tr>
              {aberta && <tr className="stock-lots-row"><td colSpan={7}>
                <div className="history-details">
                  <div><span>Tipo</span><strong>{movimentacao.tipo} Nº {movimentacao.id}</strong></div>
                  <div><span>Data da operação</span><strong>{dataMovimentacao(movimentacao)}</strong></div>
                  <div><span>Responsável</span><strong>{movimentacao.funcionarioNome}</strong></div>
                  <div><span>{movimentacao.complementoRotulo}</span><strong>{movimentacao.complemento}</strong></div>
                  {movimentacao.tipo !== "Ajuste" && <div className="history-details-wide"><span>Observação</span><strong>{movimentacao.observacao || "Sem observação"}</strong></div>}
                </div>
                <table className="stock-lots"><thead><tr><th>Produto</th><th>Lote</th><th>Validade</th><th>Quantidade</th>{movimentacao.tipo === "Ajuste" && <th>Justificativa</th>}</tr></thead><tbody>
                  {movimentacao.itens.map(item => <tr key={item.id}><td>{item.produtoNome}</td><td>Lote {item.codigoLote}</td><td>{dataBrasileira(item.dataValidade)}</td><td className={classeQuantidade(item.quantidade)}>{quantidadeComSinal(item.quantidade)}</td>{movimentacao.tipo === "Ajuste" && <td>{item.justificativa}</td>}</tr>)}
                </tbody></table>
              </td></tr>}
            </Fragment>;
          })}
        </tbody></table></div>
        {carregando && <div className="table-state">Carregando histórico...</div>}
        {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregarHistorico()}>Tentar novamente</button></div>}
        {!carregando && !erroLista && !movimentacoes.length && <div className="table-state">Nenhuma movimentação encontrada.</div>}
      </section>}
    </main>
  </div>;
}
