"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, elementoTour, avancarApos, voltarApos, type PassoTour } from "../../components/TourGuia";
import { baixarRelatorioPdf, dataIsoBrasileira, periodoTexto } from "../../components/relatorioPdf";
import UsuarioLogado from "../../components/UsuarioLogado";

type SituacaoPedido = "Pendente" | "Parcialmente Recebido" | "Recebido" | "Cancelado";
type ItemPedido = { produtoId: number; produtoNome: string; quantidade: number; quantidadeRecebida: number; quantidadePendente: number; produtoAtivo: boolean };
type Pedido = { id: number; dataSolicitacao: string; situacao: SituacaoPedido; observacao: string | null; funcionarioNome: string; itens: ItemPedido[] };
type Lote = { id: number; codigoLote: string; quantidadeDisponivel: number; dataValidade: string | null; produtoId: number };
type Produto = { id: number; nome: string; ativo: boolean; lotes: Lote[] };
type ItemEntrada = { id: number; produtoId: number; produtoNome: string; quantidade: number; loteId: number; codigoLote: string; dataValidade: string | null };
type Entrada = {
  id: number; pedidoCompraId: number | null; funcionarioId: number; funcionarioNome: string;
  dataEntrada: string; observacao: string | null;
  itens: ItemEntrada[]; quantidadeItens: number; totalUnidades: number;
};
type ItemFormulario = {
  chave: number; produtoId: string; quantidade: string; lote: string;
  codigoLote: string; dataValidade: string; lotes: Lote[]; itemPedido: boolean;
};
type Modo = "cadastro" | "edicao" | "detalhes" | null;

class ApiError extends Error {
  constructor(public status: number, dados: { erro?: string }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(base: "entradas" | "pedidos" | "produtos", caminho: string, opcoes?: RequestInit): Promise<T> {
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

function formatarDataInput(data: Date) {
  return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
}

function limitesData() {
  const hoje = new Date();
  const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
  const umMesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 1, Math.min(hoje.getDate(), ultimoDiaMesAnterior));
  return { minima: formatarDataInput(umMesAtras), maxima: formatarDataInput(hoje) };
}

function dataBrasileira(data?: string | null) {
  if (!data) return "Sem validade";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Lotes sem código usam o código 1; qualquer outro código exige a data de validade.
function exigeValidade(item: ItemFormulario) {
  const codigo = item.codigoLote.trim();
  return item.lote === "novo" && codigo !== "" && codigo !== "1";
}

function mensagemErro(erro: unknown) {
  return erro instanceof ApiError ? erro.message : "Não foi possível conectar ao backend.";
}

export default function EntradasPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaConsulta, setBuscaConsulta] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modo, setModo] = useState<Modo>(null);
  const [selecionada, setSelecionada] = useState<Entrada | null>(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [possuiPedido, setPossuiPedido] = useState<"" | "sim" | "nao">("");
  const [selecionandoVinculo, setSelecionandoVinculo] = useState(false);
  const [pedidoId, setPedidoId] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [observacao, setObservacao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [itens, setItens] = useState<ItemFormulario[]>([]);
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const [excluir, setExcluir] = useState<Entrada | null>(null);
  const proximaChave = useRef(1);
  const limites = limitesData();

  const novoItem = (itemPedido = false): ItemFormulario => ({
    chave: proximaChave.current++, produtoId: "", quantidade: "", lote: "novo",
    codigoLote: "", dataValidade: "", lotes: [], itemPedido,
  });

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      try {
        const usuario = JSON.parse(window.localStorage.getItem("sgea_usuario") || "{}") as { funcionarioNome?: string };
        setResponsavel(usuario.funcionarioNome || "Funcionário logado");
      } catch { setResponsavel("Funcionário logado"); }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setBuscaConsulta(busca.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [busca]);

  const carregarEntradas = useCallback(async () => {
    setCarregando(true);
    setErroLista("");
    try {
      const parametros = new URLSearchParams({ busca: buscaConsulta, dataInicio, dataFim });
      setEntradas(await requisicao<Entrada[]>("entradas", `?${parametros}`));
    } catch { setEntradas([]); }
    finally { setCarregando(false); }
  }, [buscaConsulta, dataInicio, dataFim]);

  const carregarPedidos = useCallback(async () => {
    try { setPedidos(await requisicao<Pedido[]>("pedidos", "?busca=&situacao=Todas")); }
    catch (erro) { setErroLista(mensagemErro(erro)); }
  }, []);

  const carregarProdutos = useCallback(async () => {
    try { setProdutos(await requisicao<Produto[]>("produtos", "?nome=&situacao=ativos")); }
    catch (erro) { setErroLista(mensagemErro(erro)); }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarEntradas(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarEntradas]);
  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarPedidos(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarPedidos]);
  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarProdutos(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarProdutos]);

  const buscarPedido = async (id: number) => requisicao<Pedido>("pedidos", `/${id}`);
  const buscarLotes = async (produtoId: number) => (await requisicao<Produto>("produtos", `/${produtoId}`)).lotes || [];

  const abrirCadastro = () => {
    setSelecionada(null);
    setPedidoSelecionado(null);
    setPossuiPedido("");
    setPedidoId("");
    setSelecionandoVinculo(true);
    setDataEntrada(limites.maxima);
    setObservacao("");
    setItens([]);
    setErroFormulario("");
    setModo("cadastro");
  };

  const alterarPedido = (valor: string) => {
    setPedidoId(valor);
    setErroFormulario("");
  };

  const alterarVinculoPedido = (valor: "" | "sim" | "nao") => {
    setPossuiPedido(valor);
    setPedidoId("");
    setPedidoSelecionado(null);
    setItens([]);
    setErroFormulario("");
  };

  const confirmarVinculo = async () => {
    if (!possuiPedido) { setErroFormulario("Informe se a entrada possui um pedido de compra."); return; }
    if (possuiPedido === "sim" && !pedidoId) { setErroFormulario("Selecione um pedido de compra."); return; }
    setProcessando(true);
    setErroFormulario("");
    try {
      if (possuiPedido === "sim") {
        const pedido = await buscarPedido(Number(pedidoId));
        const itensPedido = pedido.itens.filter(item => item.quantidadePendente > 0);
        if (!itensPedido.length) { setErroFormulario("Este pedido não possui itens pendentes."); return; }
        setPedidoSelecionado(pedido);
        setItens(await Promise.all(itensPedido.map(async item => ({
          chave: proximaChave.current++, produtoId: String(item.produtoId), quantidade: "",
          lote: "novo", codigoLote: "", dataValidade: "", lotes: await buscarLotes(item.produtoId),
          itemPedido: true,
        }))));
      } else {
        setPedidoSelecionado(null);
        setItens([novoItem()]);
      }
      setSelecionandoVinculo(false);
    } catch (erro) { setErroFormulario(mensagemErro(erro)); }
    finally { setProcessando(false); }
  };

  const abrirDetalhes = async (entrada: Entrada) => {
    try {
      setSelecionada(await requisicao<Entrada>("entradas", `/${entrada.id}`));
      setModo("detalhes");
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  };

  const abrirEdicao = async (entrada: Entrada) => {
    try {
      const atual = await requisicao<Entrada>("entradas", `/${entrada.id}`);
      const pedido = atual.pedidoCompraId ? await buscarPedido(atual.pedidoCompraId) : null;
      const itensFormulario = await Promise.all(atual.itens.map(async item => ({
        chave: proximaChave.current++, produtoId: String(item.produtoId), quantidade: String(item.quantidade),
        lote: String(item.loteId), codigoLote: item.codigoLote, dataValidade: item.dataValidade || "",
        lotes: await buscarLotes(item.produtoId),
        itemPedido: Boolean(pedido?.itens.some(produto => produto.produtoId === item.produtoId)),
      })));
      setSelecionada(atual);
      setPedidoSelecionado(pedido);
      setPossuiPedido(atual.pedidoCompraId ? "sim" : "nao");
      setPedidoId(atual.pedidoCompraId ? String(atual.pedidoCompraId) : "");
      setDataEntrada(atual.dataEntrada);
      setObservacao(atual.observacao || "");
      setItens(itensFormulario);
      setErroFormulario("");
      setSelecionandoVinculo(false);
      setModo("edicao");
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  };

  const alterarProduto = async (chave: number, produtoId: string) => {
    setItens(atuais => atuais.map(item => item.chave === chave
      ? { ...item, produtoId, quantidade: "", lote: "novo", codigoLote: "", dataValidade: "", lotes: [] }
      : item));
    setErroFormulario("");
    if (!produtoId) return;
    try {
      const lotes = await buscarLotes(Number(produtoId));
      setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, lotes } : item));
    } catch (erro) { setErroFormulario(mensagemErro(erro)); }
  };

  const alterarItem = (chave: number, alteracao: Partial<ItemFormulario>) => {
    setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, ...alteracao } : item));
    setErroFormulario("");
  };

  const validar = () => {
    if (!possuiPedido) return "Informe se a entrada possui um pedido de compra.";
    if (possuiPedido === "sim" && !pedidoSelecionado) return "Selecione um pedido de compra.";
    if (!dataEntrada || dataEntrada < limites.minima || dataEntrada > limites.maxima) return "A data da entrada deve estar entre um mês atrás e hoje.";
    if (observacao.trim().length > 500) return "A observação deve ter no máximo 500 caracteres.";
    if (!itens.some(item => Number(item.quantidade) > 0)) return "Informe a quantidade recebida de pelo menos um produto.";
    const produtosUtilizados = new Set<number>();
    for (const item of itens) {
      const produtoId = Number(item.produtoId);
      const quantidade = Number(item.quantidade);
      if (item.itemPedido && !quantidade) continue;
      const produtoValido = possuiPedido === "sim" && item.itemPedido
        ? pedidoSelecionado?.itens.some(produto => produto.produtoId === produtoId)
        : produtos.some(produto => produto.id === produtoId && produto.ativo);
      if (!Number.isSafeInteger(produtoId) || !produtoValido) return "Selecione um produto válido em todos os itens.";
      if (produtosUtilizados.has(produtoId)) return "O mesmo produto não pode ser informado mais de uma vez na entrada.";
      if (!Number.isSafeInteger(quantidade) || quantidade <= 0) return "Todas as quantidades recebidas devem ser inteiras e maiores que zero.";
      if (item.lote === "novo" && item.codigoLote.trim().length > 50) return "O código do lote deve ter no máximo 50 caracteres.";
      if (item.lote === "novo" && exigeValidade(item) && !item.dataValidade) return `Informe a data de validade do lote ${item.codigoLote.trim()}.`;
      produtosUtilizados.add(produtoId);
    }
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
        pedidoCompraId: possuiPedido === "sim" ? Number(pedidoId) : null,
        dataEntrada, observacao: observacao.trim() || null,
        itens: itens.filter(item => Number(item.quantidade) > 0).map(item => ({
          produtoId: Number(item.produtoId), quantidade: Number(item.quantidade),
          loteId: item.lote === "novo" ? null : Number(item.lote),
          codigoLote: item.lote === "novo" ? item.codigoLote.trim() || null : null,
          dataValidade: item.lote === "novo" ? item.dataValidade || null : null,
        })),
      };
      await requisicao<Entrada>("entradas", modo === "cadastro" ? "" : `/${selecionada?.id}`, {
        method: modo === "cadastro" ? "POST" : "PUT", body: JSON.stringify(corpo),
      });
      setModo(null);
      await Promise.all([carregarEntradas(), carregarPedidos()]);
    } catch (erroSalvamento) { setErroFormulario(mensagemErro(erroSalvamento)); }
    finally { setProcessando(false); }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setProcessando(true);
    try {
      await requisicao<{ id: number }>("entradas", `/${excluir.id}`, { method: "DELETE" });
      setExcluir(null);
      setModo(null);
      await Promise.all([carregarEntradas(), carregarPedidos()]);
    } catch (erro) { setExcluir(null); setErroLista(mensagemErro(erro)); }
    finally { setProcessando(false); }
  };

  // Na edição, o que esta própria entrada já recebeu volta a contar como pendente.
  const pendenteDoItem = (itemPedido: ItemPedido) => {
    const recebidoNestaEntrada = modo === "edicao"
      ? (selecionada?.itens ?? []).filter(item => item.produtoId === itemPedido.produtoId).reduce((total, item) => total + item.quantidade, 0)
      : 0;
    return itemPedido.quantidade - Math.max(itemPedido.quantidadeRecebida - recebidoNestaEntrada, 0);
  };

  const baixarListaPdf = () => baixarRelatorioPdf({
    titulo: "Relatório de Entradas de Produtos",
    arquivo: "entradas.pdf",
    informacoes: [
      ["Pesquisa", buscaConsulta || "Todas"], ["Período", periodoTexto(dataInicio, dataFim)],
      ["Total", `${entradas.length} entrada(s), ${entradas.reduce((total, entrada) => total + entrada.totalUnidades, 0)} unidade(s)`]
    ],
    tabelas: [{
      colunas: ["Nº", "Pedido", "Data", "Responsável", "Itens", "Unidades"],
      linhas: entradas.map(entrada => [entrada.id, entrada.pedidoCompraId ? `#${entrada.pedidoCompraId}` : "Sem pedido", dataIsoBrasileira(entrada.dataEntrada), entrada.funcionarioNome, entrada.quantidadeItens, entrada.totalUnidades])
    }]
  });

  const baixarEntradaPdf = (entrada: Entrada) => baixarRelatorioPdf({
    titulo: `Entrada de Produtos Nº ${entrada.id}`,
    arquivo: `entrada-${entrada.id}.pdf`,
    informacoes: [
      ["Pedido de compra", entrada.pedidoCompraId ? `#${entrada.pedidoCompraId}` : "Sem pedido"],
      ["Data", dataIsoBrasileira(entrada.dataEntrada)], ["Responsável", entrada.funcionarioNome],
      ["Observação", entrada.observacao || "Sem observação"]
    ],
    tabelas: [{
      titulo: "Itens recebidos",
      colunas: ["Produto", "Quantidade", "Lote", "Validade"],
      linhas: entrada.itens.map(item => [item.produtoNome, item.quantidade, item.codigoLote, item.dataValidade ? dataIsoBrasileira(item.dataValidade) : "Sem validade"])
    }]
  });

  const pedidosDisponiveis = pedidos.filter(pedido => ["Pendente", "Parcialmente Recebido"].includes(pedido.situacao) || pedido.id === selecionada?.pedidoCompraId);
  const hoje = limites.maxima;

  const passosTour: PassoTour[] = [
    { popover: { title: "Entradas de Produtos", description: "Cada entrada registra produtos recebidos e soma as quantidades aos lotes do estoque. Quando vinculada a um pedido, também atualiza o que já foi recebido dele." } },
    { element: campoTour("Pesquisar", ".filter-panel"), popover: { title: "Pesquisar", description: "Busque por número da entrada, pedido, produto ou responsável." } },
    { element: campoTour("De", ".filter-panel"), popover: { title: "Período", description: "Informe as datas De e Até para ver as entradas realizadas nesse intervalo." } },
    { element: ".filter-panel .pdf-button", popover: { title: "Baixar PDF", description: "Gera um PDF com a lista de entradas exibida, respeitando os filtros aplicados." } },
    { element: ".table-panel", popover: { title: "Lista de entradas", description: "Mostra número, pedido vinculado, data, responsável, quantidade de itens e de unidades." } },
    { element: ".table-panel tbody tr:first-child .order-view-action", popover: { title: "Visualizar", description: "Mostra os itens recebidos com lote e validade. Nos detalhes também é possível baixar o PDF da entrada." } },
    { element: ".table-panel tbody tr:first-child .order-edit-action", popover: { title: "Editar", description: "Altera a entrada. O estoque é recalculado automaticamente." } },
    { element: ".table-panel tbody tr:first-child .order-cancel-action", popover: { title: "Excluir", description: "Remove a entrada e desfaz as quantidades nos lotes. Não é possível excluir se parte do que foi recebido já saiu do estoque." } },
    { element: ".filter-panel .new-button", popover: { title: "Nova entrada", description: "Clique aqui para registrar um recebimento. Clique em Próximo para conhecer o formulário.", onNextClick: (...gancho) => avancarApos(abrirCadastro)(...gancho) } },
    { element: elementoTour(".modal-card"), popover: { title: "Vínculo com pedido", description: "Primeiro informe se a entrada é de um pedido de compra.", onPrevClick: voltarApos(() => setModo(null)) } },
    { element: campoTour("A entrada possui pedido"), popover: { title: "Possui pedido de compra? *", description: "Clique em Sim quando os produtos chegaram de um pedido de compra: os itens pendentes dele serão carregados automaticamente. Clique em Não para informar os produtos livremente.", onNextClick: (...gancho) => avancarApos(() => alterarVinculoPedido("sim"))(...gancho) } },
    { element: campoTour("Qual é o pedido"), popover: { title: "Qual é o pedido? *", description: "Este campo só aparece depois de clicar em Sim. Selecione o pedido; só aparecem pedidos Pendentes ou Parcialmente Recebidos.", onPrevClick: (...gancho) => voltarApos(() => alterarVinculoPedido(""))(...gancho) } },
    { element: elementoTour(".modal-card .modal-footer .button-primary"), popover: { title: "Continuar", description: "Clique em Continuar para preencher os itens. Neste tutorial vamos seguir como uma entrada sem pedido.", onNextClick: (...gancho) => avancarApos(() => { setPossuiPedido("nao"); setPedidoSelecionado(null); setItens([novoItem()]); setSelecionandoVinculo(false); })(...gancho) } },
    { element: campoTour("Data da entrada"), popover: { title: "Data da entrada *", description: "Data do recebimento. É permitido informar até 1 mês para trás." } },
    { element: campoTour("Observação"), popover: { title: "Observação", description: "Informação opcional, como o número da nota fiscal." } },
    { element: elementoTour(".modal-card fieldset"), popover: { title: "Itens recebidos *", description: "Para cada produto, informe a quantidade e escolha um lote existente ou crie um novo. Em lotes novos com código diferente de 1, a validade é obrigatória. Se a quantidade passar do pendente do pedido, aparece um aviso no item." } },
    { element: elementoTour(".modal-card button[type='submit']"), popover: { title: "Registrar entrada", description: "Clique para salvar. As quantidades são somadas aos lotes imediatamente." } },
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between">
        <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar entradas" placeholder="Buscar entrada, pedido, produto ou responsável..." value={busca} onChange={evento => setBusca(evento.target.value)}/></label>
        <UsuarioLogado />
      </header>
      <main className="main-content entry-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Entradas</strong></div>
        <div className="title-block title-with-help"><div><h1>Registrar Entrada de Produtos</h1><p>Registre recebimentos vinculados aos pedidos e atualize os lotes automaticamente.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModo(atual => atual === "cadastro" ? null : atual)}/></div>
        <section className="filter-panel entry-filters d-flex align-items-end">
          <label className="field form-label"><span>Pesquisar</span><input className="form-control" placeholder="Número, pedido, produto ou responsável..." value={busca} onChange={evento => setBusca(evento.target.value)}/></label>
          <label className="field form-label"><span>De</span><input className="form-control" type="date" value={dataInicio} max={dataFim || undefined} onChange={evento => setDataInicio(evento.target.value)}/></label><label className="field form-label"><span>Até</span><input className="form-control" type="date" value={dataFim} min={dataInicio || undefined} onChange={evento => setDataFim(evento.target.value)}/></label>
          <button className="button button-secondary btn pdf-button" disabled={carregando || !entradas.length} onClick={baixarListaPdf}><Icone nome="download" tamanho={17}/> Baixar PDF</button>
          <button className="button button-primary btn new-button" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Nova entrada</button>
        </section>
        <section className="table-panel entry-table">
          <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Nº</th><th>Pedido</th><th>Data</th><th>Responsável</th><th>Itens</th><th>Unidades</th><th>Ações</th></tr></thead><tbody>
            {!carregando && !erroLista && entradas.map(entrada => <tr key={entrada.id}><td><strong>{entrada.id}</strong></td><td>{entrada.pedidoCompraId ? `#${entrada.pedidoCompraId}` : "Sem pedido"}</td><td>{dataBrasileira(entrada.dataEntrada)}</td><td>{entrada.funcionarioNome}</td><td>{entrada.quantidadeItens}</td><td>{entrada.totalUnidades}</td><td><div className="order-row-actions"><button className="order-icon-action order-view-action btn" title="Visualizar entrada" onClick={() => void abrirDetalhes(entrada)}><Icone nome="visualizar" tamanho={18}/></button><button className="order-icon-action order-edit-action btn" title="Editar entrada" onClick={() => void abrirEdicao(entrada)}><Icone nome="editar" tamanho={17}/></button><button className="order-icon-action order-cancel-action btn" title="Excluir entrada" onClick={() => setExcluir(entrada)}><Icone nome="lixeira" tamanho={17}/></button></div></td></tr>)}
          </tbody></table></div>
          {carregando && <div className="table-state">Carregando entradas...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregarEntradas()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !entradas.length && <div className="table-state">Nenhuma entrada encontrada.</div>}
        </section>
      </main>
    </div>

    {modo && <div className="modal-overlay"><div className={`modal-card entry-modal card border-0 ${modo === "cadastro" && selecionandoVinculo ? "entry-choice-modal" : modo !== "detalhes" ? "entry-register-modal" : ""}`} role="dialog" aria-modal="true">{modo === "cadastro" && selecionandoVinculo ? <div className="entry-choice-heading"><div className="entry-choice-title"><span className="entry-choice-icon"><Icone nome="pedidos" tamanho={30}/></span><div><h2>Registrar entrada</h2><p>Informe se a entrada possui um pedido de compra e selecione o pedido.</p></div></div><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={28}/></button></div> : modo !== "detalhes" ? <div className="entry-register-heading"><div className="entry-register-title"><span className="entry-register-icon"><Icone nome="caixa" tamanho={24}/></span><div><h2>{modo === "edicao" ? `Editar entrada #${selecionada?.id}` : "Registrar entrada"}</h2><p>{pedidoSelecionado ? "Registre a entrada dos produtos deste pedido de compra." : "Registre os produtos recebidos nesta entrada."}</p></div></div><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div> : <div className="modal-heading"><h2>{`Entrada #${selecionada?.id}`}</h2><button className="icon-button btn" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div>}
      {modo === "detalhes" && selecionada ? <div className="modal-body">
        <div className="entry-summary"><div className="field"><span>Pedido de compra</span><div className="readonly-field">{selecionada.pedidoCompraId ? `#${selecionada.pedidoCompraId}` : "Sem pedido"}</div></div><div className="field"><span>Data da entrada</span><div className="readonly-field">{dataBrasileira(selecionada.dataEntrada)}</div></div><div className="field"><span>Responsável</span><div className="readonly-field">{selecionada.funcionarioNome}</div></div></div>
        <div className="field"><span>Observação</span><div className="readonly-observation">{selecionada.observacao || "Sem observação"}</div></div>
        <div className="lot-section"><h3>Itens recebidos</h3><div className="table-responsive"><table className="table mb-0"><thead><tr><th>Produto</th><th>Quantidade</th><th>Lote</th><th>Validade</th></tr></thead><tbody>{selecionada.itens.map(item => <tr key={item.id}><td>{item.produtoNome}</td><td>{item.quantidade}</td><td>{item.codigoLote}</td><td>{dataBrasileira(item.dataValidade)}</td></tr>)}</tbody></table></div></div>
        <div className="modal-footer"><button className="button button-secondary btn" onClick={() => setModo(null)}>Fechar</button><button className="button button-secondary btn pdf-button" onClick={() => baixarEntradaPdf(selecionada)}><Icone nome="download" tamanho={17}/> Baixar PDF</button><button className="button button-primary btn" onClick={() => void abrirEdicao(selecionada)}>Editar</button><button className="button button-danger btn" onClick={() => setExcluir(selecionada)}>Excluir entrada</button></div>
      </div> : modo === "cadastro" && selecionandoVinculo ? <div className="modal-body entry-choice-body">
        <div className="entry-choice-grid">
          <div className="field"><span>A entrada possui pedido de compra? <em>*</em></span><div className="entry-choice-options"><button type="button" className={`entry-choice-option ${possuiPedido === "sim" ? "active" : ""}`} aria-pressed={possuiPedido === "sim"} onClick={() => alterarVinculoPedido("sim")}><span className="entry-choice-radio"/>Sim</button><button type="button" className={`entry-choice-option ${possuiPedido === "nao" ? "active" : ""}`} aria-pressed={possuiPedido === "nao"} onClick={() => alterarVinculoPedido("nao")}><span className="entry-choice-radio"/>Não</button></div></div>
          {possuiPedido === "sim" && <label className="field form-label"><span>Qual é o pedido? <em>*</em></span><select className="form-select entry-choice-select" value={pedidoId} onChange={evento => alterarPedido(evento.target.value)}><option value="">Selecione um pedido</option>{pedidosDisponiveis.map(pedido => <option key={pedido.id} value={pedido.id}>#{pedido.id} — {pedido.observacao || "Sem observação"}</option>)}</select><small>Serão exibidos apenas pedidos pendentes ou parcialmente recebidos.</small></label>}
        </div>
        {erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}
        <div className="modal-footer"><button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModo(null)}>Cancelar</button><button type="button" className="button button-primary btn" disabled={processando || !possuiPedido || (possuiPedido === "sim" && !pedidoId)} onClick={() => void confirmarVinculo()}>{processando ? "Carregando..." : "Continuar"}</button></div>
      </div> : <form className="modal-body entry-register-body" onSubmit={salvar} noValidate>
        <div className="entry-header-grid entry-register-summary"><div className="field"><span>Pedido de compra</span><div className="readonly-field">{pedidoSelecionado ? `#${pedidoSelecionado.id}` : "Sem pedido"}</div></div><label className="field form-label"><span>Data da entrada <em>*</em></span><input className="form-control" type="date" min={limites.minima} max={limites.maxima} value={dataEntrada} onChange={evento => { setDataEntrada(evento.target.value); setErroFormulario(""); }}/></label><label className="field form-label"><span>Responsável</span><input className="form-control" value={modo === "edicao" ? selecionada?.funcionarioNome || responsavel : responsavel} disabled/></label></div>
        <label className="field form-label entry-register-observation"><span>Observação (opcional)</span><textarea className="form-control entry-observation" maxLength={500} rows={3} value={observacao} onChange={evento => setObservacao(evento.target.value)} placeholder="Informe uma observação..."/><small>{observacao.length}/500</small></label>
        <fieldset className="entry-items entry-register-items"><div className="entry-register-items-heading"><div className="entry-register-items-title"><span><Icone nome="caixa" tamanho={21}/></span><div><legend>{pedidoSelecionado ? "Produtos do pedido" : "Itens recebidos"}</legend><small>Informe a quantidade recebida de cada produto.</small></div></div><button type="button" className="button button-secondary btn" onClick={() => setItens(atuais => [...atuais, novoItem()])}><Icone nome="mais" tamanho={16}/> {pedidoSelecionado ? "Adicionar produto extra" : "Adicionar produto"}</button></div>
          {itens.map((item, indice) => {
            const usados = new Set(itens.filter(outro => outro.chave !== item.chave).map(outro => outro.produtoId));
            const validade = item.lote === "novo" ? item.dataValidade : item.lotes.find(lote => String(lote.id) === item.lote)?.dataValidade || "";
            const itemDoPedido = pedidoSelecionado?.itens.find(produto => produto.produtoId === Number(item.produtoId));
            const opcoesExtras = produtos.filter(produto => !pedidoSelecionado?.itens.some(itemPedido => itemPedido.produtoId === produto.id));
            const pendente = item.itemPedido && itemDoPedido ? pendenteDoItem(itemDoPedido) : null;
            const excedente = pendente !== null ? Number(item.quantidade) - pendente : 0;
            const validadeObrigatoria = exigeValidade(item);
            return <div className={`entry-item ${item.itemPedido ? "entry-order-item" : "entry-extra-item"}`} key={item.chave}>
              <span className="order-item-number">{indice + 1}</span>
              {item.itemPedido && itemDoPedido
                ? <div className="field"><span>Produto do pedido</span><div className="readonly-field">{itemDoPedido.produtoNome}</div><small>Solicitado: {itemDoPedido.quantidade} · Já atendido: {itemDoPedido.quantidadeRecebida} · <strong>Pendente: {pendente}</strong></small></div>
                : <label className="field form-label"><span>{pedidoSelecionado ? "Produto extra" : "Produto"} <em>*</em></span><select className="form-select" value={item.produtoId} onChange={evento => void alterarProduto(item.chave, evento.target.value)}><option value="">Selecione...</option>{opcoesExtras.map(produto => <option key={produto.id} value={produto.id} disabled={usados.has(String(produto.id))}>{produto.nome}</option>)}</select></label>}
              <label className="field form-label"><span>Quantidade recebida {item.itemPedido ? "" : <em>*</em>}</span><input className="form-control" type="number" min={item.itemPedido ? 0 : 1} step={1} placeholder={item.itemPedido ? "0" : undefined} value={item.quantidade} onChange={evento => alterarItem(item.chave, { quantidade: evento.target.value })}/></label>
              <label className="field form-label"><span>Lote {item.itemPedido && !item.quantidade ? "" : <em>*</em>}</span><select className="form-select" disabled={!item.produtoId || (item.itemPedido && !item.quantidade)} value={item.lote} onChange={evento => alterarItem(item.chave, { lote: evento.target.value })}><option value="novo">Novo lote</option>{item.lotes.map(lote => <option key={lote.id} value={lote.id}>{lote.codigoLote} — saldo {lote.quantidadeDisponivel}</option>)}</select></label>
              {!item.itemPedido && <button type="button" className="icon-button order-remove btn" aria-label="Remover item" onClick={() => setItens(atuais => atuais.filter(atual => atual.chave !== item.chave))}><Icone nome="lixeira" tamanho={18}/></button>}
              {item.lote === "novo" && (!item.itemPedido || Boolean(item.quantidade)) && <><label className="field form-label entry-lot-code"><span>Código do lote</span><input className="form-control" maxLength={50} value={item.codigoLote} onChange={evento => alterarItem(item.chave, { codigoLote: evento.target.value })} placeholder="Sem código: será utilizado 1"/></label><label className="field form-label entry-expiration"><span>Validade {validadeObrigatoria ? <em>*</em> : "(opcional)"}</span><input className="form-control" type="date" required={validadeObrigatoria} value={item.dataValidade} onChange={evento => alterarItem(item.chave, { dataValidade: evento.target.value })}/></label></>}
              {validade && validade < hoje && <div className="entry-expired-warning" role="status">⚠ Lote vencido. A entrada pode ser registrada.</div>}
              {excedente > 0 && <div className="entry-expired-warning" role="status">⚠ Quantidade acima do pedido: {excedente} unidade(s) a mais que o pendente.</div>}
            </div>;
          })}
          {!itens.length && <p className="empty-order-items">Nenhum produto adicionado.</p>}
        </fieldset>
        {erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}
        <div className="modal-footer entry-register-footer"><button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModo(null)}>Cancelar</button><button type="submit" className="button button-primary btn" disabled={processando}><Icone nome="pedidos" tamanho={17}/>{processando ? "Salvando..." : modo === "edicao" ? "Salvar alterações" : "Registrar entrada"}</button></div>
      </form>}
    </div></div>}

    {excluir && <div className="modal-overlay alert-layer"><div className="modal-card alert-modal card border-0" role="alertdialog" aria-modal="true"><span className="warning-symbol">!</span><h2>Excluir entrada?</h2><p>As quantidades adicionadas serão revertidas e os lotes que só existiam por causa desta entrada serão excluídos. A exclusão será impedida se parte do estoque recebido já tiver saído do lote.</p><div className="alert-actions"><button className="button button-secondary btn" disabled={processando} onClick={() => setExcluir(null)}>Voltar</button><button className="button button-danger btn" disabled={processando} onClick={() => void confirmarExclusao()}>{processando ? "Excluindo..." : "Excluir entrada"}</button></div></div></div>}
  </>;
}
