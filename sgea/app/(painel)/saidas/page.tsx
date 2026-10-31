"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, elementoTour, avancarApos, voltarApos, type PassoTour } from "../../components/TourGuia";
import { baixarRelatorioPdf, dataIsoBrasileira, periodoTexto } from "../../components/relatorioPdf";
import UsuarioLogado from "../../components/UsuarioLogado";

type Funcionario = { id: number; nome: string; cargo: string };
type Lote = { id: number; codigoLote: string; quantidadeDisponivel: number; dataValidade: string | null; produtoId: number };
type Produto = { id: number; nome: string; ativo: boolean; quantidadeTotal: number; lotes?: Lote[] };
type LoteSaida = { itemId: number; loteId: number; codigoLote: string; dataValidade: string | null; quantidade: number };
type ProdutoSaida = { produtoId: number; produtoNome: string; quantidade: number; lotes: LoteSaida[] };
type Saida = {
  id: number; dataSaida: string; observacao: string | null;
  funcionarioId: number; funcionarioNome: string; destinatarioId: number; destinatarioNome: string;
  produtos: ProdutoSaida[]; quantidadeProdutos: number; totalUnidades: number;
};
type ProdutoFormulario = {
  chave: number; produtoId: string; quantidade: string; lotes: Lote[];
  distribuicao: Record<number, string>; carregando: boolean;
};

class ApiError extends Error {
  constructor(public status: number, dados: { erro?: string }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(base: "saidas" | "produtos", caminho: string, opcoes?: RequestInit): Promise<T> {
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

function mensagemErro(erro: unknown) {
  return erro instanceof ApiError ? erro.message : "Não foi possível conectar ao backend.";
}

function dataHoraBrasileira(valor: string) {
  const correspondencia = valor?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!correspondencia) return "Data não informada";
  const [, ano, mes, dia, hora, minuto] = correspondencia;
  return `${dia}/${mes}/${ano}${hora ? ` às ${hora}:${minuto}` : ""}`;
}

function dataBrasileira(valor: string | null) {
  if (!valor) return "Sem validade";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function agoraIso() {
  const data = new Date();
  return `${hojeIso()} ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

function hojeIso() {
  const data = new Date();
  return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
}

function lotesFefo(lotes: Lote[]) {
  const hoje = hojeIso();
  return lotes
    .filter(lote => lote.quantidadeDisponivel > 0 && (!lote.dataValidade || lote.dataValidade >= hoje))
    .sort((a, b) => {
      if (a.dataValidade && b.dataValidade) return a.dataValidade.localeCompare(b.dataValidade) || a.id - b.id;
      if (a.dataValidade) return -1;
      if (b.dataValidade) return 1;
      return a.id - b.id;
    });
}

function sugerirDistribuicao(lotes: Lote[], quantidade: number) {
  const distribuicao: Record<number, string> = {};
  let restante = Number.isSafeInteger(quantidade) && quantidade > 0 ? quantidade : 0;
  for (const lote of lotesFefo(lotes)) {
    const retirada = Math.min(restante, lote.quantidadeDisponivel);
    distribuicao[lote.id] = retirada ? String(retirada) : "";
    restante -= retirada;
  }
  return distribuicao;
}

export default function SaidasPage() {
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaConsulta, setBuscaConsulta] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modal, setModal] = useState<"cadastro" | "detalhes" | null>(null);
  const [selecionada, setSelecionada] = useState<Saida | null>(null);
  const [destinatarioId, setDestinatarioId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [dataRegistro, setDataRegistro] = useState("");
  const [itens, setItens] = useState<ProdutoFormulario[]>([]);
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const proximaChave = useRef(1);

  const novoItem = (): ProdutoFormulario => ({
    chave: proximaChave.current++, produtoId: "", quantidade: "", lotes: [], distribuicao: {}, carregando: false,
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

  const carregarSaidas = useCallback(async () => {
    setCarregando(true);
    setErroLista("");
    try { setSaidas(await requisicao<Saida[]>("saidas", `?${new URLSearchParams({ busca: buscaConsulta, dataInicio, dataFim })}`)); }
    catch { setSaidas([]); }
    finally { setCarregando(false); }
  }, [buscaConsulta, dataInicio, dataFim]);

  const carregarOpcoes = useCallback(async () => {
    try {
      const [listaProdutos, listaFuncionarios] = await Promise.all([
        requisicao<Produto[]>("produtos", "?nome=&situacao=ativos"),
        requisicao<Funcionario[]>("saidas", "/destinatarios"),
      ]);
      setProdutos(listaProdutos);
      setFuncionarios(listaFuncionarios);
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarSaidas(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarSaidas]);
  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarOpcoes(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarOpcoes]);

  const abrirCadastro = () => {
    setSelecionada(null);
    setDestinatarioId("");
    setDataRegistro(agoraIso());
    setObservacao("");
    setItens([novoItem()]);
    setErroFormulario("");
    setModal("cadastro");
  };

  const abrirDetalhes = async (saida: Saida) => {
    try {
      setSelecionada(await requisicao<Saida>("saidas", `/${saida.id}`));
      setModal("detalhes");
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  };

  const alterarProduto = async (chave: number, produtoId: string) => {
    setErroFormulario("");
    setItens(atuais => atuais.map(item => item.chave === chave
      ? { ...item, produtoId, quantidade: "", lotes: [], distribuicao: {}, carregando: Boolean(produtoId) }
      : item));
    if (!produtoId) return;
    try {
      const produto = await requisicao<Produto>("produtos", `/${produtoId}`);
      const lotes = lotesFefo(produto.lotes || []);
      setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, lotes, carregando: false } : item));
    } catch (erro) {
      setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, carregando: false } : item));
      setErroFormulario(mensagemErro(erro));
    }
  };

  const alterarQuantidade = (chave: number, valor: string) => {
    setItens(atuais => atuais.map(item => item.chave === chave
      ? { ...item, quantidade: valor, distribuicao: sugerirDistribuicao(item.lotes, Number(valor)) }
      : item));
    setErroFormulario("");
  };

  const alterarLote = (chave: number, loteId: number, valor: string) => {
    setItens(atuais => atuais.map(item => item.chave === chave
      ? { ...item, distribuicao: { ...item.distribuicao, [loteId]: valor } }
      : item));
    setErroFormulario("");
  };

  const validar = () => {
    if (!Number.isSafeInteger(Number(destinatarioId)) || Number(destinatarioId) <= 0) return "Selecione o funcionário que receberá os materiais.";
    if (observacao.trim().length > 255) return "A observação deve ter no máximo 255 caracteres.";
    if (!itens.length) return "Adicione pelo menos um produto.";
    const usados = new Set<number>();
    for (const item of itens) {
      const produtoId = Number(item.produtoId);
      const quantidade = Number(item.quantidade);
      if (!Number.isSafeInteger(produtoId) || produtoId <= 0 || usados.has(produtoId)) return "Selecione produtos válidos e não repetidos.";
      if (!Number.isSafeInteger(quantidade) || quantidade <= 0) return "As quantidades devem ser inteiras e maiores que zero.";
      const disponivel = item.lotes.reduce((total, lote) => total + lote.quantidadeDisponivel, 0);
      if (quantidade > disponivel) return "A quantidade solicitada é superior ao estoque válido disponível.";
      const soma = item.lotes.reduce((total, lote) => total + Number(item.distribuicao[lote.id] || 0), 0);
      if (soma !== quantidade) return "A soma das quantidades dos lotes deve corresponder ao total solicitado.";
      for (const lote of item.lotes) {
        const retirada = Number(item.distribuicao[lote.id] || 0);
        if (!Number.isSafeInteger(retirada) || retirada < 0 || retirada > lote.quantidadeDisponivel) return `Confira a quantidade informada para o lote ${lote.codigoLote}.`;
      }
      usados.add(produtoId);
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
      await requisicao<Saida>("saidas", "", {
        method: "POST",
        body: JSON.stringify({
          destinatarioId: Number(destinatarioId), observacao: observacao.trim() || null,
          produtos: itens.map(item => ({
            produtoId: Number(item.produtoId), quantidade: Number(item.quantidade),
            lotes: item.lotes.filter(lote => Number(item.distribuicao[lote.id]) > 0).map(lote => ({
              loteId: lote.id, quantidade: Number(item.distribuicao[lote.id]),
            })),
          })),
        }),
      });
      setModal(null);
      await Promise.all([carregarSaidas(), carregarOpcoes()]);
    } catch (erroSalvamento) { setErroFormulario(mensagemErro(erroSalvamento)); }
    finally { setProcessando(false); }
  };

  const baixarListaPdf = () => baixarRelatorioPdf({
    titulo: "Relatório de Saídas de Produtos",
    arquivo: "saidas.pdf",
    informacoes: [
      ["Pesquisa", buscaConsulta || "Todas"], ["Período", periodoTexto(dataInicio, dataFim)],
      ["Total", `${saidas.length} saída(s), ${saidas.reduce((total, saida) => total + saida.totalUnidades, 0)} unidade(s)`]
    ],
    tabelas: [{
      colunas: ["Nº", "Data", "Responsável", "Destinatário", "Produtos", "Unidades"],
      linhas: saidas.map(saida => [saida.id, dataIsoBrasileira(saida.dataSaida), saida.funcionarioNome, saida.destinatarioNome, saida.quantidadeProdutos, saida.totalUnidades])
    }]
  });

  const baixarSaidaPdf = (saida: Saida) => baixarRelatorioPdf({
    titulo: `Saída de Produtos Nº ${saida.id}`,
    arquivo: `saida-${saida.id}.pdf`,
    informacoes: [
      ["Data", dataIsoBrasileira(saida.dataSaida)], ["Responsável", saida.funcionarioNome],
      ["Destinatário", saida.destinatarioNome], ["Observação", saida.observacao || "Sem observação"]
    ],
    tabelas: [{
      titulo: "Produtos retirados",
      colunas: ["Produto", "Lote", "Validade", "Quantidade"],
      linhas: saida.produtos.flatMap(produto => produto.lotes.map(lote => [produto.produtoNome, lote.codigoLote, lote.dataValidade ? dataIsoBrasileira(lote.dataValidade) : "Sem validade", lote.quantidade]))
    }]
  });

  const passosTour: PassoTour[] = [
    { popover: { title: "Saídas de Produtos", description: "Cada saída registra materiais retirados do almoxarifado para um funcionário e desconta as quantidades dos lotes." } },
    { element: campoTour("Pesquisar", ".filter-panel"), popover: { title: "Pesquisar", description: "Busque por número da saída, produto, responsável ou destinatário." } },
    { element: campoTour("De", ".filter-panel"), popover: { title: "Período", description: "Informe as datas De e Até para ver as saídas realizadas nesse intervalo." } },
    { element: ".filter-panel .pdf-button", popover: { title: "Baixar PDF", description: "Gera um PDF com a lista de saídas exibida, respeitando os filtros aplicados." } },
    { element: ".table-panel", popover: { title: "Lista de saídas", description: "Mostra número, data, responsável, destinatário, quantidade de produtos e de unidades." } },
    { element: ".table-panel tbody tr:first-child .order-view-action", popover: { title: "Visualizar", description: "Mostra os produtos e os lotes de onde saiu cada quantidade. Nos detalhes também é possível baixar o PDF da saída." } },
    { element: ".filter-panel .new-button", popover: { title: "Nova saída", description: "Clique aqui para registrar uma retirada de materiais. Clique em Próximo para conhecer o formulário.", onNextClick: (...gancho) => avancarApos(abrirCadastro)(...gancho) } },
    { element: elementoTour(".modal-card"), popover: { title: "Formulário de saída", description: "Preencha os dados da retirada. Os campos marcados com * são obrigatórios.", onPrevClick: voltarApos(() => setModal(null)) } },
    { element: campoTour("Funcionário destinatário"), popover: { title: "Funcionário destinatário *", description: "Selecione quem está recebendo os materiais." } },
    { element: campoTour("Responsável pelo registro"), popover: { title: "Responsável", description: "Preenchido automaticamente com o usuário que está registrando a saída." } },
    { element: campoTour("Data da saída"), popover: { title: "Data da saída", description: "Registrada automaticamente no momento da confirmação." } },
    { element: campoTour("Observação"), popover: { title: "Observação", description: "Informação opcional sobre a retirada." } },
    { element: elementoTour(".modal-card fieldset"), popover: { title: "Produtos retirados *", description: "Escolha o produto e a quantidade total. O sistema sugere de quais lotes retirar, começando pela validade mais próxima, e você pode ajustar a distribuição. Se faltar estoque, o aviso aparece no próprio item." } },
    { element: elementoTour(".modal-card button[type='submit']"), popover: { title: "Registrar saída", description: "Clique para salvar. As quantidades são descontadas dos lotes imediatamente." } },
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between"><label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar saídas" placeholder="Buscar saída, produto, responsável ou destinatário..." value={busca} onChange={evento => setBusca(evento.target.value)}/></label><UsuarioLogado /></header>
      <main className="main-content output-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Saídas</strong></div>
        <div className="title-block title-with-help"><div><h1>Saída de Produtos</h1><p>Registre a distribuição de materiais e acompanhe o histórico de retiradas.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModal(atual => atual === "cadastro" ? null : atual)}/></div>
        <section className="filter-panel output-filters d-flex align-items-end"><label className="field form-label"><span>Pesquisar</span><input className="form-control" placeholder="Número, produto, responsável ou destinatário..." value={busca} onChange={evento => setBusca(evento.target.value)}/></label><label className="field form-label"><span>De</span><input className="form-control" type="date" value={dataInicio} max={dataFim || undefined} onChange={evento => setDataInicio(evento.target.value)}/></label><label className="field form-label"><span>Até</span><input className="form-control" type="date" value={dataFim} min={dataInicio || undefined} onChange={evento => setDataFim(evento.target.value)}/></label><button className="button button-secondary btn pdf-button" disabled={carregando || !saidas.length} onClick={baixarListaPdf}><Icone nome="download" tamanho={17}/> Baixar PDF</button><button className="button button-primary btn new-button" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Nova saída</button></section>
        <section className="table-panel output-table"><div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Nº</th><th>Data</th><th>Responsável</th><th>Destinatário</th><th>Produtos</th><th>Unidades</th><th>Ações</th></tr></thead><tbody>{!carregando && !erroLista && saidas.map(saida => <tr key={saida.id}><td><strong>{saida.id}</strong></td><td>{dataHoraBrasileira(saida.dataSaida)}</td><td>{saida.funcionarioNome}</td><td>{saida.destinatarioNome}</td><td>{saida.quantidadeProdutos}</td><td>{saida.totalUnidades}</td><td><button className="order-icon-action order-view-action btn" title="Visualizar saída" onClick={() => void abrirDetalhes(saida)}><Icone nome="visualizar" tamanho={18}/></button></td></tr>)}</tbody></table></div>
          {carregando && <div className="table-state">Carregando saídas...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregarSaidas()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !saidas.length && <div className="table-state">Nenhuma saída encontrada.</div>}
        </section>
      </main>
    </div>

    {modal && <div className="modal-overlay"><div className="modal-card output-modal card border-0" role="dialog" aria-modal="true"><div className="output-modal-heading"><div className="output-modal-title"><span><Icone nome="saida" tamanho={25}/></span><div><h2>{modal === "cadastro" ? "Registrar saída" : "Detalhes da saída"}</h2><p>{modal === "cadastro" ? "Informe o destinatário e os produtos que serão retirados." : `Saída #${selecionada?.id}`}</p></div></div><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModal(null)}><Icone nome="fechar" tamanho={22}/></button></div>
      {modal === "detalhes" && selecionada ? <div className="modal-body output-details-body">
        <div className="output-details-summary"><div><span>Data da saída</span><strong>{dataHoraBrasileira(selecionada.dataSaida)}</strong></div><div><span>Responsável</span><strong>{selecionada.funcionarioNome}</strong></div><div><span>Destinatário</span><strong>{selecionada.destinatarioNome}</strong></div></div>
        <div className="field"><span>Observação</span><div className="readonly-observation">{selecionada.observacao || "Sem observação"}</div></div>
        <div className="output-details-products"><h3>Produtos retirados</h3>{selecionada.produtos.map(produto => <div className="output-detail-product" key={produto.produtoId}><div><strong>{produto.produtoNome}</strong><span>Total: {produto.quantidade}</span></div><table><thead><tr><th>Lote</th><th>Validade</th><th>Retirada</th></tr></thead><tbody>{produto.lotes.map(lote => <tr key={lote.loteId}><td>{lote.codigoLote}</td><td>{dataBrasileira(lote.dataValidade)}</td><td>{lote.quantidade}</td></tr>)}</tbody></table></div>)}</div>
        <div className="modal-footer"><button className="button button-secondary btn" onClick={() => setModal(null)}>Fechar</button><button className="button button-secondary btn pdf-button" onClick={() => baixarSaidaPdf(selecionada)}><Icone nome="download" tamanho={17}/> Baixar PDF</button></div>
      </div> : <form className="modal-body output-form" onSubmit={salvar} noValidate>
        <div className="output-form-summary"><label className="field form-label"><span>Funcionário destinatário <em>*</em></span><select className="form-select" value={destinatarioId} onChange={evento => { setDestinatarioId(evento.target.value); setErroFormulario(""); }}><option value="">Selecione...</option>{funcionarios.map(funcionario => <option key={funcionario.id} value={funcionario.id}>{funcionario.nome} — {funcionario.cargo}</option>)}</select></label><div className="field"><span>Responsável pelo registro</span><div className="readonly-field">{responsavel}</div></div><div className="field"><span>Data da saída</span><div className="readonly-field">{dataHoraBrasileira(dataRegistro)}</div><small>Registrada automaticamente ao confirmar.</small></div></div>
        <label className="field form-label output-observation"><span>Observação (opcional)</span><textarea className="form-control" maxLength={255} rows={2} value={observacao} onChange={evento => setObservacao(evento.target.value)} placeholder="Informe uma observação..."/><small>{observacao.length}/255</small></label>
        <fieldset className="output-items"><div className="output-items-heading"><div><span className="output-items-icon"><Icone nome="caixa" tamanho={21}/></span><div><legend>Produtos retirados</legend><small>Os lotes são sugeridos pela validade mais próxima.</small></div></div><button type="button" className="button button-secondary btn" onClick={() => setItens(atuais => [...atuais, novoItem()])}><Icone nome="mais" tamanho={16}/> Adicionar produto</button></div>
          {itens.map((item, indice) => { const usados = new Set(itens.filter(outro => outro.chave !== item.chave).map(outro => outro.produtoId)); const totalDisponivel = item.lotes.reduce((total, lote) => total + lote.quantidadeDisponivel, 0); const totalDistribuido = item.lotes.reduce((total, lote) => total + Number(item.distribuicao[lote.id] || 0), 0); return <div className="output-item" key={item.chave}><span className="order-item-number">{indice + 1}</span><label className="field form-label"><span>Produto <em>*</em></span><select className="form-select" value={item.produtoId} onChange={evento => void alterarProduto(item.chave, evento.target.value)}><option value="">Selecione...</option>{produtos.filter(produto => produto.quantidadeTotal > 0).map(produto => <option key={produto.id} value={produto.id} disabled={usados.has(String(produto.id))}>{produto.nome} — estoque {produto.quantidadeTotal}</option>)}</select></label><label className="field form-label"><span>Quantidade total <em>*</em></span><input className="form-control" type="number" min={1} max={totalDisponivel || undefined} step={1} value={item.quantidade} disabled={!item.produtoId || item.carregando} onChange={evento => alterarQuantidade(item.chave, evento.target.value)} placeholder="0"/><small>Disponível válido: {totalDisponivel}</small>{Number(item.quantidade) > totalDisponivel && !item.carregando && <small className="inline-stock-warning" role="alert">⚠ Quantidade maior que o estoque disponível ({totalDisponivel}).</small>}</label><button type="button" className="icon-button order-remove btn" aria-label="Remover produto" onClick={() => setItens(atuais => atuais.filter(atual => atual.chave !== item.chave))}><Icone nome="lixeira" tamanho={18}/></button>
            {item.produtoId && <div className="output-lots"><div className="output-lots-title"><strong>Distribuição por lotes</strong><span className={totalDistribuido === Number(item.quantidade) ? "balanced" : "unbalanced"}>Distribuído: {totalDistribuido} de {Number(item.quantidade) || 0}</span></div>{item.carregando ? <p>Carregando lotes...</p> : item.lotes.length ? item.lotes.map(lote => <div className="output-lot" key={lote.id}><div><strong>{lote.codigoLote}</strong><small>Validade: {dataBrasileira(lote.dataValidade)} · Disponível: {lote.quantidadeDisponivel}</small></div><label><span>Retirar</span><input className="form-control" type="number" min={0} max={lote.quantidadeDisponivel} step={1} value={item.distribuicao[lote.id] || ""} onChange={evento => alterarLote(item.chave, lote.id, evento.target.value)} placeholder="0"/></label>{Number(item.distribuicao[lote.id] || 0) > lote.quantidadeDisponivel && <small className="inline-stock-warning" role="alert">⚠ Retirada maior que o saldo do lote ({lote.quantidadeDisponivel}).</small>}</div>) : <p className="output-no-stock">Nenhum lote válido com estoque disponível.</p>}</div>}
          </div>; })}
          {!itens.length && <p className="empty-order-items">Nenhum produto adicionado.</p>}
        </fieldset>
        {erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}
        <div className="modal-footer output-footer"><button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="button button-primary btn" disabled={processando}><Icone nome="saida" tamanho={17}/>{processando ? "Registrando..." : "Registrar saída"}</button></div>
      </form>}
    </div></div>}
  </>;
}
