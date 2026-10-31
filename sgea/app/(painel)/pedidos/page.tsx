"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, elementoTour, avancarApos, voltarApos, type PassoTour } from "../../components/TourGuia";
import { baixarRelatorioPdf, dataIsoBrasileira, periodoTexto } from "../../components/relatorioPdf";
import UsuarioLogado from "../../components/UsuarioLogado";

type Situacao = "Pendente" | "Parcialmente Recebido" | "Recebido" | "Cancelado";
type Produto = { id: number; nome: string; ativo: boolean };
type ItemPedido = { produtoId: number; produtoNome: string; quantidade: number; produtoAtivo: boolean; quantidadeRecebida: number; quantidadePendente: number };
type Pedido = {
  id: number;
  dataSolicitacao: string;
  situacao: Situacao;
  observacao: string | null;
  funcionarioId: number;
  funcionarioNome: string;
  itens: ItemPedido[];
  quantidadeItens: number;
  totalUnidades: number;
};
type ItemFormulario = { chave: number; produtoId: string; produtoNome?: string; quantidade: string };
type Modo = "cadastro" | "edicao" | "detalhes" | null;

class ApiError extends Error {
  constructor(public status: number, dados: { erro?: string }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(base: "pedidos" | "produtos", caminho: string, opcoes?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem("sgea_token");
  const resposta = await fetch(`/api/${base}${caminho}`, {
    ...opcoes,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opcoes?.headers },
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

function perfilAdministrador(perfil?: string) {
  const normalizado = String(perfil ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ["adm", "administrador", "adiministrador"].includes(normalizado);
}

function dataBrasileira(data?: string | null) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return "Data não informada";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataInput(data: Date) {
  return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
}

function limitesDataPedido() {
  const hoje = new Date();
  const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
  const umMesAtras = new Date(
    hoje.getFullYear(),
    hoje.getMonth() - 1,
    Math.min(hoje.getDate(), ultimoDiaMesAnterior),
  );
  return { minima: formatarDataInput(umMesAtras), maxima: formatarDataInput(hoje) };
}

function BadgeSituacao({ situacao }: { situacao: Situacao }) {
  const classe = situacao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replaceAll(" ", "-");
  return <span className={`order-status order-status-${classe}`}>{situacao}</span>;
}

function mensagemErro(erro: unknown) {
  return erro instanceof ApiError ? erro.message : "Não foi possível conectar ao backend. Verifique se a API está em execução.";
}

export default function PedidosPage() {
  const [administrador, setAdministrador] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaConsulta, setBuscaConsulta] = useState("");
  const [situacao, setSituacao] = useState("Todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modo, setModo] = useState<Modo>(null);
  const [selecionado, setSelecionado] = useState<Pedido | null>(null);
  const [dataSolicitacao, setDataSolicitacao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itensFormulario, setItensFormulario] = useState<ItemFormulario[]>([]);
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Pedido | null>(null);
  const proximaChave = useRef(1);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      try {
        const usuario = JSON.parse(window.localStorage.getItem("sgea_usuario") || "{}") as { perfil?: string };
        setAdministrador(perfilAdministrador(usuario.perfil));
      } catch { setAdministrador(false); }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setBuscaConsulta(busca.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [busca]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista("");
    try {
      const parametros = new URLSearchParams({ busca: buscaConsulta, situacao });
      const lista = await requisicao<Pedido[]>("pedidos", `?${parametros}`);
      const respostaValida = Array.isArray(lista) && lista.every(pedido =>
        Number.isSafeInteger(pedido.id) && pedido.id > 0 &&
        typeof pedido.dataSolicitacao === "string" &&
        ["Pendente", "Parcialmente Recebido", "Recebido", "Cancelado"].includes(pedido.situacao)
      );
      if (!respostaValida) {
        throw new ApiError(502, { erro: "O backend ainda está usando a versão anterior. Reinicie a API e tente novamente." });
      }
      setPedidos(lista);
      setPagina(1);
    } catch {
      setPedidos([]);
      setPagina(1);
    } finally {
      setCarregando(false);
    }
  }, [buscaConsulta, situacao]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregar]);

  useEffect(() => {
    if (!administrador) return;
    const carregarProdutos = async () => {
      try {
        setProdutos(await requisicao<Produto[]>("produtos", "?nome=&situacao=ativos"));
      } catch (erro) { setErroLista(mensagemErro(erro)); }
    };
    void carregarProdutos();
  }, [administrador]);

  const novoItem = (): ItemFormulario => ({ chave: proximaChave.current++, produtoId: "", quantidade: "" });

  const abrirCadastro = () => {
    setSelecionado(null);
    setDataSolicitacao("");
    setObservacao("");
    setItensFormulario([novoItem()]);
    setErroFormulario("");
    setModo("cadastro");
  };

  const consultar = async (pedido: Pedido) => requisicao<Pedido>("pedidos", `/${pedido.id}`);

  const abrirDetalhes = async (pedido: Pedido) => {
    try {
      setSelecionado(await consultar(pedido));
      setModo("detalhes");
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  };

  const abrirEdicao = async (pedido: Pedido) => {
    try {
      const atual = await consultar(pedido);
      if (atual.situacao !== "Pendente") {
        setErroLista("Somente pedidos pendentes podem ser alterados.");
        return;
      }
      setSelecionado(atual);
      setDataSolicitacao(atual.dataSolicitacao);
      setObservacao(atual.observacao || "");
      setItensFormulario(atual.itens.map(item => ({
        chave: proximaChave.current++, produtoId: String(item.produtoId), produtoNome: item.produtoNome,
        quantidade: String(item.quantidade),
      })));
      setErroFormulario("");
      setModo("edicao");
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  };

  const alterarItem = (chave: number, campo: "produtoId" | "quantidade", valor: string) => {
    setItensFormulario(itens => itens.map(item => item.chave === chave ? { ...item, [campo]: valor } : item));
    setErroFormulario("");
  };

  const validar = () => {
    if (dataSolicitacao) {
      const { minima, maxima } = limitesDataPedido();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataSolicitacao) || dataSolicitacao < minima || dataSolicitacao > maxima) {
        return "A data da solicitação deve estar entre um mês atrás e hoje.";
      }
    }
    if (!itensFormulario.length) return "Adicione pelo menos um produto ao pedido.";
    const ids = new Set<number>();
    for (const item of itensFormulario) {
      const produtoId = Number(item.produtoId);
      const quantidade = Number(item.quantidade);
      if (!Number.isSafeInteger(produtoId) || produtoId <= 0) return "Selecione o produto de todos os itens.";
      if (!Number.isSafeInteger(quantidade) || quantidade <= 0) return "Todas as quantidades devem ser inteiras e maiores que zero.";
      if (ids.has(produtoId)) return "O mesmo produto não pode ser adicionado mais de uma vez.";
      ids.add(produtoId);
    }
    if (observacao.trim().length > 255) return "A observação deve ter no máximo 255 caracteres.";
    return "";
  };

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault();
    const erro = validar();
    if (erro) { setErroFormulario(erro); return; }
    setProcessando(true);
    setErroFormulario("");
    try {
      const corpo = {
        dataSolicitacao: dataSolicitacao || null,
        observacao: observacao.trim() || null,
        itens: itensFormulario.map(item => ({ produtoId: Number(item.produtoId), quantidade: Number(item.quantidade) })),
      };
      await requisicao<Pedido>("pedidos", modo === "cadastro" ? "" : `/${selecionado?.id}`, {
        method: modo === "cadastro" ? "POST" : "PUT",
        body: JSON.stringify(corpo),
      });
      setModo(null);
      await carregar();
    } catch (erro) {
      setErroFormulario(mensagemErro(erro));
    } finally { setProcessando(false); }
  };

  const cancelarPedido = async () => {
    if (!confirmacao) return;
    setProcessando(true);
    try {
      const atualizado = await requisicao<Pedido>("pedidos", `/${confirmacao.id}/situacao`, {
        method: "PATCH", body: JSON.stringify({ situacao: "Cancelado" }),
      });
      setConfirmacao(null);
      if (modo === "detalhes" && selecionado?.id === atualizado.id) setSelecionado(atualizado);
      await carregar();
    } catch (erro) {
      setConfirmacao(null);
      setErroLista(mensagemErro(erro));
    } finally { setProcessando(false); }
  };

  const pedidosFiltrados = pedidos.filter(pedido =>
    (!dataInicio || pedido.dataSolicitacao >= dataInicio) &&
    (!dataFim || pedido.dataSolicitacao <= dataFim)
  );
  const totalPaginas = Math.max(1, Math.ceil(pedidosFiltrados.length / 5));
  const itensPagina = pedidosFiltrados.slice((pagina - 1) * 5, pagina * 5);
  const inicio = pedidosFiltrados.length ? (pagina - 1) * 5 + 1 : 0;
  const fim = Math.min(pagina * 5, pedidosFiltrados.length);
  const limitesPedido = limitesDataPedido();

  const baixarListaPdf = () => baixarRelatorioPdf({
    titulo: "Relatório de Pedidos de Compra",
    arquivo: "pedidos-de-compra.pdf",
    informacoes: [
      ["Pesquisa", buscaConsulta || "Todas"], ["Situação", situacao],
      ["Período", periodoTexto(dataInicio, dataFim)], ["Total", `${pedidosFiltrados.length} pedido(s)`]
    ],
    tabelas: [{
      colunas: ["Nº", "Data", "Funcionário", "Situação", "Itens", "Observação"],
      linhas: pedidosFiltrados.map(pedido => [pedido.id, dataIsoBrasileira(pedido.dataSolicitacao), pedido.funcionarioNome, pedido.situacao, pedido.quantidadeItens, pedido.observacao || "—"])
    }]
  });

  const baixarPedidoPdf = (pedido: Pedido) => baixarRelatorioPdf({
    titulo: `Pedido de Compra Nº ${pedido.id}`,
    arquivo: `pedido-de-compra-${pedido.id}.pdf`,
    informacoes: [
      ["Data", dataIsoBrasileira(pedido.dataSolicitacao)], ["Responsável", pedido.funcionarioNome],
      ["Situação", pedido.situacao], ["Observação", pedido.observacao || "Sem observação"]
    ],
    tabelas: [{
      titulo: "Produtos solicitados",
      colunas: ["Produto", "Solicitada", "Recebida", "Pendente"],
      linhas: pedido.itens.map(item => [item.produtoNome, item.quantidade, item.quantidadeRecebida, item.quantidadePendente])
    }]
  });

  const passosTour: PassoTour[] = [
    { popover: { title: "Pedidos de Compra", description: "Os pedidos registram os produtos que precisam ser comprados. Conforme as entradas são lançadas, a situação muda de Pendente para Parcialmente Recebido e Recebido." } },
    { element: campoTour("Pesquisar", ".filter-panel"), popover: { title: "Pesquisar", description: "Busque por número do pedido, produto, observação ou funcionário." } },
    { element: campoTour("Situação", ".filter-panel"), popover: { title: "Filtrar por situação", description: "Pendente: nada recebido. Parcialmente Recebido: parte entregue. Recebido: tudo entregue. Cancelado: pedido cancelado." } },
    { element: campoTour("De", ".filter-panel"), popover: { title: "Período", description: "Informe as datas De e Até para ver os pedidos solicitados nesse intervalo." } },
    { element: ".filter-panel .pdf-button", popover: { title: "Baixar PDF", description: "Gera um PDF com a lista de pedidos exibida, respeitando os filtros aplicados." } },
    { element: ".table-panel", popover: { title: "Lista de pedidos", description: "Mostra número, data, funcionário, situação, quantidade de itens e observação." } },
    { element: ".table-panel tbody tr:first-child .order-view-action", popover: { title: "Visualizar", description: "Abre os detalhes do pedido com as quantidades solicitada, recebida e pendente de cada produto. Nos detalhes também é possível baixar o PDF do pedido." } },
    { element: ".table-panel tbody tr:first-child .order-edit-action", popover: { title: "Editar", description: "Disponível para o ADM enquanto o pedido estiver Pendente." } },
    { element: ".table-panel tbody tr:first-child .order-cancel-action", popover: { title: "Cancelar pedido", description: "Cancela pedidos Pendentes ou Parcialmente Recebidos." } },
    { element: ".table-footer", popover: { title: "Paginação", description: "Use as setas para navegar entre as páginas da lista." } },
    ...(administrador ? [
    { element: ".filter-panel .new-button", popover: { title: "Novo pedido", description: "Clique aqui para cadastrar um pedido de compra. Clique em Próximo para conhecer o formulário.", onNextClick: (...gancho) => avancarApos(abrirCadastro)(...gancho) } },
    { element: elementoTour(".modal-card"), popover: { title: "Formulário do pedido", description: "Preencha os dados do pedido. Os campos marcados com * são obrigatórios.", onPrevClick: voltarApos(() => setModo(null)) } },
    { element: campoTour("Data da solicitação"), popover: { title: "Data da solicitação *", description: "Data em que o pedido foi solicitado." } },
    { element: campoTour("Observação"), popover: { title: "Observação", description: "Informação opcional sobre o pedido, como o fornecedor ou a urgência." } },
    { element: elementoTour(".modal-card fieldset"), popover: { title: "Produtos solicitados *", description: "Selecione cada produto e informe a quantidade. Use Adicionar produto para incluir mais itens e o X para remover." } },
    { element: elementoTour(".modal-card button[type='submit']"), popover: { title: "Salvar pedido", description: "Clique para registrar o pedido. Ele começa com a situação Pendente." } },
    ] as PassoTour[] : []),
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between">
        <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar pedidos" placeholder="Buscar pedido, responsável ou produto..." value={busca} onChange={evento => setBusca(evento.target.value)}/></label>
        <UsuarioLogado />
      </header>
      <main className="main-content order-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Pedidos de compra</strong></div>
        <div className="title-block title-with-help"><div><h1>Controlar Pedidos de Compra</h1><p>Cadastre e acompanhe as solicitações de reposição do almoxarifado.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModo(atual => atual === "cadastro" ? null : atual)}/></div>

        <section className="filter-panel order-filters d-flex align-items-end">
          <label className="field form-label order-search-field"><span>Pesquisar</span><div className="order-search-input"><Icone nome="busca" tamanho={15}/><input className="form-control" placeholder="Pesquisar por número, produto, observação ou funcionário..." value={busca} onChange={evento => setBusca(evento.target.value)}/></div></label>
          <label className="field form-label"><span>Situação</span><select className="form-select" value={situacao} onChange={evento => { setSituacao(evento.target.value); setPagina(1); }}><option>Todas</option><option>Pendente</option><option>Parcialmente Recebido</option><option>Recebido</option><option>Cancelado</option></select></label>
          <label className="field form-label"><span>De</span><input className="form-control" type="date" value={dataInicio} max={dataFim || undefined} onChange={evento => { setDataInicio(evento.target.value); setPagina(1); }}/></label>
          <label className="field form-label"><span>Até</span><input className="form-control" type="date" value={dataFim} min={dataInicio || undefined} onChange={evento => { setDataFim(evento.target.value); setPagina(1); }}/></label>
          <button className="button button-secondary btn pdf-button" disabled={carregando || !pedidosFiltrados.length} onClick={baixarListaPdf}><Icone nome="download" tamanho={17}/> Baixar PDF</button>
          {administrador && <button className="button button-primary btn new-button" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Novo Pedido</button>}
        </section>

        <section className="table-panel order-table">
          <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Nº</th><th>Data da Solicitação</th><th>Funcionário</th><th>Situação</th><th>Quantidade de Itens</th><th>Observação</th><th>Ações</th></tr></thead><tbody>{!carregando && !erroLista && itensPagina.map((pedido, indice) => <tr key={pedido.id ? `pedido-${pedido.id}` : `pedido-sem-id-${indice}`}>
            <td><strong>{pedido.id}</strong></td><td>{dataBrasileira(pedido.dataSolicitacao)}</td><td>{pedido.funcionarioNome}</td><td><BadgeSituacao situacao={pedido.situacao}/></td><td className="order-quantity">{pedido.quantidadeItens}</td><td className="order-observation" title={pedido.observacao || "Sem observação"}>{pedido.observacao || "—"}</td><td><div className="order-row-actions"><button className="order-icon-action order-view-action btn" title="Visualizar detalhes" aria-label={`Visualizar pedido ${pedido.id}`} onClick={() => void abrirDetalhes(pedido)}><Icone nome="visualizar" tamanho={18}/></button>{administrador && pedido.situacao === "Pendente" && <button className="order-icon-action order-edit-action btn" title="Editar pedido" aria-label={`Editar pedido ${pedido.id}`} onClick={() => void abrirEdicao(pedido)}><Icone nome="editar" tamanho={17}/></button>}{["Pendente", "Parcialmente Recebido"].includes(pedido.situacao) && <button className="order-icon-action order-cancel-action btn" title="Cancelar pedido" aria-label={`Cancelar pedido ${pedido.id}`} onClick={() => setConfirmacao(pedido)}><Icone nome="lixeira" tamanho={17}/></button>}</div></td>
          </tr>)}</tbody></table></div>
          {carregando && <div className="table-state">Carregando pedidos...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregar()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !pedidosFiltrados.length && <div className="table-state">Nenhum pedido de compra encontrado.</div>}
        </section>
        <div className="table-footer d-flex align-items-center justify-content-between"><span>Mostrando {inicio} a {fim} de {pedidosFiltrados.length} pedidos</span><div className="pagination d-flex align-items-center"><button className="btn" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}><Icone nome="esquerda" tamanho={16}/></button><span className="current-page">{pagina}</span><button className="btn" disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)}><Icone nome="direita" tamanho={16}/></button></div></div>
      </main>
    </div>

    {modo && <div className="modal-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget && !processando) setModo(null); }}><div className={`modal-card order-modal card border-0 ${modo !== "detalhes" ? "order-register-modal" : "order-details-modal"}`} role="dialog" aria-modal="true">{modo !== "detalhes" ? <div className="order-register-heading"><div className="order-register-title"><span className="order-register-icon"><Icone nome="pedidos" tamanho={24}/></span><h2>{modo === "cadastro" ? "Cadastrar Pedido" : `Editar Pedido #${selecionado?.id}`}</h2></div><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div> : <div className="order-details-heading"><div className="order-details-title"><span className="order-details-icon"><Icone nome="pedidos" tamanho={27}/></span><div><h2>Detalhes do pedido</h2><p>Pedido de compra #{selecionado?.id}</p></div></div><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div>}
      {modo === "detalhes" && selecionado ? <div className="modal-body order-details-body">
        <div className="order-details-summary"><div className="order-details-summary-item"><Icone nome="calendario" tamanho={21}/><div><span>Data da solicitação</span><strong>{dataBrasileira(selecionado.dataSolicitacao)}</strong></div></div><div className="order-details-summary-item"><Icone nome="funcionarios" tamanho={22}/><div><span>Responsável</span><strong>{selecionado.funcionarioNome}</strong></div></div><div className="order-details-summary-item"><Icone nome="marcador" tamanho={21}/><div><span>Situação</span><BadgeSituacao situacao={selecionado.situacao}/></div></div></div>
        <div className="field order-details-observation"><span>Observação</span><div className="readonly-observation">{selecionado.observacao || "Sem observação"}</div></div>
        <div className="lot-section order-details-products"><h3>Produtos solicitados</h3><div className="table-responsive"><table className="table mb-0"><thead><tr><th>Produto</th><th>Quantidade solicitada</th><th>Quantidade recebida</th><th>Quantidade pendente</th></tr></thead><tbody>{selecionado.itens.map(item => <tr key={item.produtoId}><td>{item.produtoNome}</td><td>{item.quantidade}</td><td>{item.quantidadeRecebida}</td><td>{item.quantidadePendente}</td></tr>)}</tbody></table></div></div>
        <div className="modal-footer"><button className="button button-secondary btn" onClick={() => setModo(null)}>Fechar</button><button className="button button-secondary btn pdf-button" onClick={() => baixarPedidoPdf(selecionado)}><Icone nome="download" tamanho={17}/> Baixar PDF</button>{["Pendente", "Parcialmente Recebido"].includes(selecionado.situacao) && <button className="button button-danger btn" disabled={processando} onClick={() => setConfirmacao(selecionado)}>Cancelar pedido</button>}</div>
      </div> : <form className="modal-body order-register-body" onSubmit={salvar} noValidate>
        <div className="order-form-grid order-register-fields"><label className="field form-label"><span>Data da solicitação</span><input className="form-control" type="date" min={limitesPedido.minima} max={limitesPedido.maxima} value={dataSolicitacao} onChange={evento => { setDataSolicitacao(evento.target.value); setErroFormulario(""); }}/><small>Deve estar entre um mês atrás e hoje. Se ficar vazia, será utilizada a data atual.</small></label><label className="field form-label"><span>Observação</span><textarea className="form-control" maxLength={255} rows={3} placeholder="Observação opcional..." value={observacao} onChange={evento => setObservacao(evento.target.value)}/><small>{observacao.length}/255</small></label></div>
        <fieldset className="order-items order-register-items"><div className="order-register-items-heading"><div className="order-register-items-title"><span><Icone nome="caixa" tamanho={21}/></span><legend>Produtos solicitados</legend></div><button type="button" className="button button-secondary btn" onClick={() => setItensFormulario(itens => [...itens, novoItem()])}><Icone nome="mais" tamanho={16}/> Adicionar produto</button></div>
          {itensFormulario.map((item, indice) => { const usados = new Set(itensFormulario.filter(outro => outro.chave !== item.chave).map(outro => outro.produtoId)); const produtoAtualAtivo = produtos.some(produto => String(produto.id) === item.produtoId); return <div className="order-item-row" key={item.chave}><span className="order-item-number">{indice + 1}</span><label className="field form-label"><span>Produto <em>*</em></span><select className="form-select" value={item.produtoId} onChange={evento => alterarItem(item.chave, "produtoId", evento.target.value)}><option value="">Selecione...</option>{item.produtoId && !produtoAtualAtivo && <option value={item.produtoId}>{item.produtoNome || "Produto"} (inativo)</option>}{produtos.map(produto => <option key={produto.id} value={produto.id} disabled={usados.has(String(produto.id))}>{produto.nome}</option>)}</select></label><label className="field form-label"><span>Quantidade <em>*</em></span><input className="form-control" type="number" min={1} step={1} value={item.quantidade} onChange={evento => alterarItem(item.chave, "quantidade", evento.target.value)} placeholder="0"/></label><button type="button" className="icon-button order-remove btn" aria-label="Remover produto" onClick={() => setItensFormulario(itens => itens.filter(outro => outro.chave !== item.chave))}><Icone nome="lixeira" tamanho={19}/></button></div>; })}
          {!itensFormulario.length && <p className="empty-order-items">Nenhum produto adicionado.</p>}
        </fieldset>
        {erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}
        <div className="modal-footer order-register-footer"><button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModo(null)}>Cancelar</button><button type="submit" className="button button-primary btn" disabled={processando}><Icone nome="pedidos" tamanho={17}/>{processando ? "Salvando..." : "Salvar pedido"}</button></div>
      </form>}
    </div></div>}

    {confirmacao && <div className="modal-overlay alert-layer"><div className="modal-card alert-modal card border-0" role="alertdialog" aria-modal="true"><span className="warning-symbol">!</span><h2>Cancelar pedido?</h2><p>O pedido e seus itens serão preservados para consulta, mas não poderão mais ser alterados.</p><div className="alert-actions"><button className="button button-secondary btn" disabled={processando} onClick={() => setConfirmacao(null)}>Voltar</button><button className="button button-danger btn" disabled={processando} onClick={() => void cancelarPedido()}>{processando ? "Confirmando..." : "Confirmar"}</button></div></div></div>}
  </>;
}
