"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, type PassoTour } from "../../components/TourGuia";
import { baixarRelatorioPdf, dataIsoBrasileira, periodoTexto } from "../../components/relatorioPdf";
import UsuarioLogado from "../../components/UsuarioLogado";

type AlertaLote = "Lote vencido" | "Próximo do vencimento" | null;
type LoteEstoque = { id: number; codigoLote: string; quantidadeDisponivel: number; dataValidade: string | null; alerta: AlertaLote };
type ProdutoEstoque = {
  id: number; nome: string; categoriaId: number; categoriaNome: string; quantidadeTotal: number;
  estoqueZerado: boolean; lotesVencidos: number; lotesProximosVencimento: number; lotes: LoteEstoque[];
};
type Categoria = { id: number; nome: string };

class ApiError extends Error {
  constructor(public status: number, dados: { erro?: string }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(base: "estoque" | "categorias", caminho: string): Promise<T> {
  const token = window.localStorage.getItem("sgea_token");
  const resposta = await fetch(`/api/${base}${caminho}`, {
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

function dataBrasileira(valor: string | null) {
  if (!valor) return "Sem validade";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function classeAlerta(alerta: string) {
  return alerta === "Próximo do vencimento" ? "stock-alert stock-alert-warning" : "stock-alert stock-alert-danger";
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState("");
  const [nomeConsulta, setNomeConsulta] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [validadeInicio, setValidadeInicio] = useState("");
  const [validadeFim, setValidadeFim] = useState("");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");

  const periodoInvalido = Boolean(validadeInicio && validadeFim && validadeInicio > validadeFim);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setNomeConsulta(nome.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [nome]);

  const carregarEstoque = useCallback(async () => {
    if (periodoInvalido) return;
    setCarregando(true);
    setErroLista("");
    try {
      const parametros = new URLSearchParams({ nome: nomeConsulta, categoriaId, validadeInicio, validadeFim });
      setProdutos(await requisicao<ProdutoEstoque[]>("estoque", `?${parametros}`));
    } catch {
      setProdutos([]);
      setErroLista("Não foi possível consultar o estoque.");
    } finally { setCarregando(false); }
  }, [nomeConsulta, categoriaId, validadeInicio, validadeFim, periodoInvalido]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarEstoque(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarEstoque]);

  useEffect(() => {
    const temporizador = window.setTimeout(async () => {
      try { setCategorias(await requisicao<Categoria[]>("categorias", "?nome=&situacao=ativas")); }
      catch { setCategorias([]); }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  const alternarProduto = (id: number) => setExpandidos(atuais => {
    const proximos = new Set(atuais);
    if (proximos.has(id)) proximos.delete(id);
    else proximos.add(id);
    return proximos;
  });

  const totalZerados = produtos.filter(produto => produto.estoqueZerado).length;
  const totalVencidos = produtos.reduce((total, produto) => total + produto.lotesVencidos, 0);
  const totalProximos = produtos.reduce((total, produto) => total + produto.lotesProximosVencimento, 0);

  const baixarPdf = () => baixarRelatorioPdf({
    titulo: "Relatório de Estoque Atual",
    arquivo: "estoque-atual.pdf",
    informacoes: [
      ["Produto", nomeConsulta || "Todos"],
      ["Categoria", categorias.find(categoria => String(categoria.id) === categoriaId)?.nome ?? "Todas"],
      ["Validade", validadeInicio || validadeFim ? periodoTexto(validadeInicio, validadeFim) : "Todas"],
      ["Alertas", `${totalZerados} produto(s) zerado(s), ${totalVencidos} lote(s) vencido(s), ${totalProximos} próximo(s) do vencimento`]
    ],
    tabelas: [{
      colunas: ["Produto", "Categoria", "Lote", "Validade", "Quantidade", "Alerta"],
      linhas: produtos.flatMap(produto => produto.lotes.length
        ? produto.lotes.map((lote, indice) => [
          indice ? "" : produto.nome, indice ? "" : produto.categoriaNome, `Lote ${lote.codigoLote}`,
          lote.dataValidade ? dataIsoBrasileira(lote.dataValidade) : "Sem validade", lote.quantidadeDisponivel, lote.alerta ?? "—"
        ])
        : [[produto.nome, produto.categoriaNome, "—", "—", produto.quantidadeTotal, produto.estoqueZerado ? "Estoque zerado" : "—"]])
    }]
  });

  const passosTour: PassoTour[] = [
    { popover: { title: "Consultar Estoque Atual", description: "Consulte quanto existe de cada produto ativo, em quais lotes e quais precisam de atenção. Esta tela é apenas para consulta." } },
    { element: campoTour("Produto", ".filter-panel"), popover: { title: "Produto", description: "Digite parte do nome do produto." } },
    { element: campoTour("Categoria", ".filter-panel"), popover: { title: "Categoria", description: "Mostra apenas os produtos da categoria selecionada." } },
    { element: campoTour("Validade de", ".filter-panel"), popover: { title: "Período de validade", description: "Informe as datas para ver apenas os lotes que vencem nesse intervalo. A quantidade total do produto continua considerando todos os lotes." } },
    { element: ".filter-panel .pdf-button", popover: { title: "Baixar PDF", description: "Gera um PDF do estoque exibido, com os lotes e alertas." } },
    { element: ".stock-summary", popover: { title: "Resumo de alertas", description: "Quantidade de produtos encontrados e o total de alertas: estoque zerado, lotes vencidos e lotes próximos do vencimento (até 30 dias)." } },
    { element: ".stock-table", popover: { title: "Lista de produtos", description: "Mostra nome, categoria, quantidade disponível (soma de todos os lotes) e os alertas de cada produto." } },
    { element: ".stock-table tbody tr:first-child .stock-toggle", popover: { title: "Ver lotes", description: "Clique na seta, ou em qualquer parte da linha, para ver os lotes do produto com validade, quantidade e alerta." } },
  ];

  return <div className="content-shell">
    <header className="topbar d-flex align-items-center justify-content-between">
      <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar produto no estoque" placeholder="Buscar produto no estoque..." value={nome} onChange={evento => setNome(evento.target.value)}/></label>
      <UsuarioLogado />
    </header>
    <main className="main-content stock-content">
      <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Estoque</strong></div>
      <div className="title-block title-with-help"><div><h1>Consultar Estoque Atual</h1><p>Acompanhe as quantidades disponíveis, os lotes e os alertas de validade dos produtos ativos.</p></div><TourGuia passos={passosTour}/></div>

      <section className="filter-panel stock-filters d-flex align-items-end">
        <label className="field form-label"><span>Produto</span><input className="form-control" placeholder="Nome do produto..." value={nome} onChange={evento => setNome(evento.target.value)}/></label>
        <label className="field form-label"><span>Categoria</span><select className="form-select" value={categoriaId} onChange={evento => setCategoriaId(evento.target.value)}><option value="">Todas</option>{categorias.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select></label>
        <label className="field form-label"><span>Validade de</span><input className="form-control" type="date" value={validadeInicio} onChange={evento => setValidadeInicio(evento.target.value)}/></label>
        <label className="field form-label"><span>Validade até</span><input className="form-control" type="date" value={validadeFim} onChange={evento => setValidadeFim(evento.target.value)}/></label>
        <button className="button button-secondary btn pdf-button" disabled={carregando || periodoInvalido || !produtos.length} onClick={baixarPdf}><Icone nome="download" tamanho={17}/> Baixar PDF</button>
      </section>
      {periodoInvalido && <div className="stock-period-error" role="alert">Período de validade inválido: a data inicial deve ser anterior ou igual à data final. Corrija o período para consultar.</div>}

      {!periodoInvalido && <section className="table-panel stock-table">
        {!carregando && !erroLista && produtos.length > 0 && <div className="stock-summary">
          <span className="stock-summary-count">{produtos.length} produto(s) encontrado(s)</span>
          {totalZerados > 0 && <span className="stock-alert stock-alert-danger">{totalZerados} com estoque zerado</span>}
          {totalVencidos > 0 && <span className="stock-alert stock-alert-danger">{totalVencidos} lote(s) vencido(s)</span>}
          {totalProximos > 0 && <span className="stock-alert stock-alert-warning">{totalProximos} lote(s) próximo(s) do vencimento</span>}
        </div>}
        <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th aria-label="Expandir"></th><th>Produto</th><th>Categoria</th><th>Quantidade disponível</th><th>Alertas</th></tr></thead><tbody>
          {!carregando && !erroLista && produtos.map(produto => {
            const aberto = expandidos.has(produto.id);
            return <Fragment key={produto.id}>
              <tr className={`stock-product-row${produto.estoqueZerado ? " stock-product-empty" : ""}`} onClick={() => alternarProduto(produto.id)}>
                <td><button className={`stock-toggle btn${aberto ? " stock-toggle-open" : ""}`} aria-expanded={aberto} aria-label={`${aberto ? "Recolher" : "Expandir"} lotes de ${produto.nome}`} onClick={evento => { evento.stopPropagation(); alternarProduto(produto.id); }}><Icone nome="direita" tamanho={16}/></button></td>
                <td><strong>{produto.nome}</strong></td>
                <td>{produto.categoriaNome}</td>
                <td className="stock-quantity">{produto.quantidadeTotal}</td>
                <td><div className="stock-alerts">
                  {produto.estoqueZerado && <span className="stock-alert stock-alert-danger">Estoque zerado</span>}
                  {produto.lotesVencidos > 0 && <span className="stock-alert stock-alert-danger">{produto.lotesVencidos} lote(s) vencido(s)</span>}
                  {produto.lotesProximosVencimento > 0 && <span className="stock-alert stock-alert-warning">{produto.lotesProximosVencimento} próximo(s) do vencimento</span>}
                  {!produto.estoqueZerado && !produto.lotesVencidos && !produto.lotesProximosVencimento && <span className="stock-no-alert">—</span>}
                </div></td>
              </tr>
              {aberto && <tr className="stock-lots-row"><td colSpan={5}>
                {produto.lotes.length ? <table className="stock-lots"><thead><tr><th>Lote</th><th>Validade</th><th>Quantidade disponível</th><th>Alerta</th></tr></thead><tbody>
                  {produto.lotes.map(lote => <tr key={lote.id}><td>Lote {lote.codigoLote}</td><td>{dataBrasileira(lote.dataValidade)}</td><td>{lote.quantidadeDisponivel}</td><td>{lote.alerta ? <span className={classeAlerta(lote.alerta)}>{lote.alerta}</span> : "—"}</td></tr>)}
                </tbody></table> : <div className="stock-no-lots">Nenhum lote com quantidade disponível.</div>}
              </td></tr>}
            </Fragment>;
          })}
        </tbody></table></div>
        {carregando && <div className="table-state">Carregando estoque...</div>}
        {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregarEstoque()}>Tentar novamente</button></div>}
        {!carregando && !erroLista && !produtos.length && <div className="table-state">Nenhum produto encontrado.</div>}
      </section>}
    </main>
  </div>;
}
