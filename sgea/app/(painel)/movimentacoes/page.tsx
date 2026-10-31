"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, elementoTour, avancarApos, voltarApos, type PassoTour } from "../../components/TourGuia";
import UsuarioLogado from "../../components/UsuarioLogado";

type Funcionario = { id: number; nome: string; cargo: string };
type Lote = { id: number; codigoLote: string; quantidadeDisponivel: number; dataValidade: string | null; produtoId: number };
type Produto = { id: number; nome: string; ativo: boolean; quantidadeTotal: number; lotes?: Lote[] };
type ItemAjuste = {
  id: number; produtoId: number; produtoNome: string; loteId: number; codigoLote: string;
  dataValidade: string | null; quantidadeAnterior: number; quantidadeFisica: number;
  diferenca: number; justificativa: string;
};
type Ajuste = {
  id: number; dataHora: string; funcionarioId: number; funcionarioNome: string;
  solicitanteId: number | null; solicitanteNome: string | null;
  itens?: ItemAjuste[]; quantidadeItens: number; totalDiferenca: number;
};
type ItemFormulario = {
  chave: number; produtoId: string; loteId: string; diferenca: string;
  justificativa: string; lotes: Lote[]; carregando: boolean;
};

class ApiError extends Error {
  constructor(public status: number, dados: { erro?: string }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(base: "ajustes" | "produtos", caminho: string, opcoes?: RequestInit): Promise<T> {
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
  const partes = valor?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]} às ${partes[4]}:${partes[5]}` : "Data não informada";
}

function agoraIso() {
  const data = new Date();
  return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-")
    + ` ${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

function dataBrasileira(valor: string | null) {
  if (!valor) return "Sem validade";
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDiferenca(valor: number) {
  return valor > 0 ? `+${valor}` : String(valor);
}

export default function MovimentacoesPage() {
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaConsulta, setBuscaConsulta] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modal, setModal] = useState<"cadastro" | "detalhes" | null>(null);
  const [selecionado, setSelecionado] = useState<Ajuste | null>(null);
  const [itens, setItens] = useState<ItemFormulario[]>([]);
  const [solicitanteId, setSolicitanteId] = useState("");
  const [dataRegistro, setDataRegistro] = useState("");
  const [responsavel, setResponsavel] = useState("Funcionário logado");
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const proximaChave = useRef(1);

  const novoItem = (): ItemFormulario => ({
    chave: proximaChave.current++, produtoId: "", loteId: "", diferenca: "",
    justificativa: "", lotes: [], carregando: false,
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

  const carregarAjustes = useCallback(async () => {
    setCarregando(true);
    setErroLista("");
    try { setAjustes(await requisicao<Ajuste[]>("ajustes", `?busca=${encodeURIComponent(buscaConsulta)}`)); }
    catch { setAjustes([]); }
    finally { setCarregando(false); }
  }, [buscaConsulta]);

  const carregarOpcoes = useCallback(async () => {
    try {
      const [listaProdutos, listaFuncionarios] = await Promise.all([
        requisicao<Produto[]>("produtos", "?nome=&situacao=ativos"),
        requisicao<Funcionario[]>("ajustes", "/funcionarios"),
      ]);
      setProdutos(listaProdutos);
      setFuncionarios(listaFuncionarios);
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarAjustes(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarAjustes]);
  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarOpcoes(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarOpcoes]);

  const abrirCadastro = () => {
    setItens([novoItem()]);
    setSolicitanteId("");
    setDataRegistro(agoraIso());
    setErroFormulario("");
    setSelecionado(null);
    setModal("cadastro");
  };

  const abrirDetalhes = async (ajuste: Ajuste) => {
    try {
      setSelecionado(await requisicao<Ajuste>("ajustes", `/${ajuste.id}`));
      setModal("detalhes");
    } catch (erro) { setErroLista(mensagemErro(erro)); }
  };

  const alterarProduto = async (chave: number, produtoId: string) => {
    setErroFormulario("");
    setItens(atuais => atuais.map(item => item.chave === chave
      ? { ...item, produtoId, loteId: "", diferenca: "", lotes: [], carregando: Boolean(produtoId) }
      : item));
    if (!produtoId) return;
    try {
      const produto = await requisicao<Produto>("produtos", `/${produtoId}`);
      setItens(atuais => atuais.map(item => item.chave === chave
        ? { ...item, lotes: produto.lotes || [], carregando: false } : item));
    } catch (erro) {
      setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, carregando: false } : item));
      setErroFormulario(mensagemErro(erro));
    }
  };

  const alterarItem = (chave: number, campo: "loteId" | "diferenca" | "justificativa", valor: string) => {
    setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, [campo]: valor } : item));
    setErroFormulario("");
  };

  const loteDoItem = (item: ItemFormulario) => item.lotes.find(lote => lote.id === Number(item.loteId));

  const validar = () => {
    if (!Number.isSafeInteger(Number(solicitanteId)) || Number(solicitanteId) <= 0) return "Selecione o funcionário que solicitou o ajuste.";
    if (!itens.length) return "Adicione pelo menos um item ao ajuste.";
    const lotesUsados = new Set<number>();
    for (const item of itens) {
      const produtoId = Number(item.produtoId);
      const loteId = Number(item.loteId);
      const diferenca = Number(item.diferenca);
      const lote = loteDoItem(item);
      if (!Number.isSafeInteger(produtoId) || produtoId <= 0) return "Selecione o produto de todos os itens.";
      if (!lote || !Number.isSafeInteger(loteId) || loteId <= 0) return "Selecione um lote pertencente ao produto.";
      if (lotesUsados.has(loteId)) return "O mesmo lote não pode ser incluído mais de uma vez.";
      if (item.diferenca.trim() === "" || !Number.isSafeInteger(diferenca) || diferenca === 0) return "Informe a diferença encontrada (ex.: +5 ou -5), diferente de zero.";
      if (lote.quantidadeDisponivel + diferenca < 0) return `O lote ${lote.codigoLote} possui ${lote.quantidadeDisponivel} unidade(s); não é possível remover ${-diferenca}.`;
      if (!item.justificativa.trim()) return "Informe a justificativa de todos os itens.";
      if (item.justificativa.trim().length > 255) return "Cada justificativa deve ter no máximo 255 caracteres.";
      lotesUsados.add(loteId);
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
      await requisicao<Ajuste>("ajustes", "", {
        method: "POST",
        body: JSON.stringify({
          solicitanteId: Number(solicitanteId),
          itens: itens.map(item => ({
            produtoId: Number(item.produtoId), loteId: Number(item.loteId),
            diferenca: Number(item.diferenca), justificativa: item.justificativa.trim(),
          })),
        }),
      });
      setModal(null);
      await Promise.all([carregarAjustes(), carregarOpcoes()]);
    } catch (erroSalvamento) { setErroFormulario(mensagemErro(erroSalvamento)); }
    finally { setProcessando(false); }
  };

  const passosTour: PassoTour[] = [
    { popover: { title: "Ajuste de Estoque", description: "Use o ajuste quando a contagem física for diferente do que o sistema mostra, por exemplo por perda, dano ou vencimento." } },
    { element: campoTour("Pesquisar ajustes", ".filter-panel"), popover: { title: "Pesquisar", description: "Busque por número, produto, lote, justificativa, responsável ou solicitante." } },
    { element: ".table-panel", popover: { title: "Lista de ajustes", description: "Mostra data e hora, responsável, solicitante, lotes ajustados e o total de unidades de diferença." } },
    { element: ".table-panel tbody tr:first-child .order-view-action", popover: { title: "Visualizar", description: "Mostra cada lote ajustado com a quantidade anterior, a diferença e a quantidade após o ajuste." } },
    { element: ".filter-panel .new-button", popover: { title: "Novo ajuste", description: "Clique aqui para corrigir o estoque. Clique em Próximo para conhecer o formulário.", onNextClick: (...gancho) => avancarApos(abrirCadastro)(...gancho) } },
    { element: elementoTour(".modal-card"), popover: { title: "Formulário de ajuste", description: "Preencha os dados do ajuste. Os campos marcados com * são obrigatórios.", onPrevClick: voltarApos(() => setModal(null)) } },
    { element: campoTour("Funcionário solicitante"), popover: { title: "Funcionário solicitante *", description: "Selecione o funcionário que pediu o ajuste." } },
    { element: campoTour("Responsável pelo ajuste"), popover: { title: "Responsável", description: "Preenchido automaticamente com o usuário que está registrando." } },
    { element: campoTour("Data do ajuste"), popover: { title: "Data do ajuste", description: "Registrada automaticamente no momento da confirmação." } },
    { element: elementoTour(".modal-card fieldset"), popover: { title: "Lotes para ajuste *", description: "Escolha o produto e o lote e informe a diferença encontrada: +5 acrescenta 5 unidades e -5 retira 5. O sistema mostra a quantidade atual e a nova quantidade, e a justificativa é obrigatória." } },
    { element: elementoTour(".modal-card button[type='submit']"), popover: { title: "Confirmar ajuste", description: "Clique para aplicar a diferença aos lotes. O lote não pode ficar com quantidade negativa." } },
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between">
        <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar ajustes" placeholder="Buscar ajuste, produto, lote ou responsável..." value={busca} onChange={evento => setBusca(evento.target.value)}/></label>
        <UsuarioLogado />
      </header>
      <main className="main-content adjustment-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Ajuste</strong></div>
        <div className="title-block title-with-help"><div><h1>Ajuste de Estoque</h1><p>Consulte os ajustes concluídos e corrija divergências do estoque físico.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModal(atual => atual === "cadastro" ? null : atual)}/></div>
        <section className="filter-panel adjustment-filters d-flex align-items-end">
          <label className="field form-label"><span>Pesquisar ajustes</span><input className="form-control" placeholder="Número, produto, lote, justificativa, responsável ou solicitante..." value={busca} onChange={evento => setBusca(evento.target.value)}/></label>
          <button className="button button-primary btn new-button" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Novo ajuste</button>
        </section>
        <section className="table-panel adjustment-table"><div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Nº</th><th>Data e hora</th><th>Responsável</th><th>Solicitante</th><th>Lotes ajustados</th><th>Unidades divergentes</th><th>Ações</th></tr></thead><tbody>
          {!carregando && !erroLista && ajustes.map(ajuste => <tr key={ajuste.id}><td><strong>{ajuste.id}</strong></td><td>{dataHoraBrasileira(ajuste.dataHora)}</td><td>{ajuste.funcionarioNome}</td><td>{ajuste.solicitanteNome || "Não informado"}</td><td>{ajuste.quantidadeItens}</td><td>{ajuste.totalDiferenca}</td><td><button className="order-icon-action order-view-action btn" title="Visualizar ajuste" onClick={() => void abrirDetalhes(ajuste)}><Icone nome="visualizar" tamanho={18}/></button></td></tr>)}
        </tbody></table></div>
          {carregando && <div className="table-state">Carregando ajustes...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregarAjustes()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !ajustes.length && <div className="table-state">Nenhum ajuste encontrado.</div>}
        </section>
      </main>
    </div>

    {modal && <div className="modal-overlay"><div className="modal-card output-modal adjustment-modal card border-0" role="dialog" aria-modal="true">
      <div className="output-modal-heading"><div className="output-modal-title"><span><Icone nome="troca" tamanho={25}/></span><div><h2>{modal === "cadastro" ? "Realizar ajuste de estoque" : `Ajuste #${selecionado?.id}`}</h2><p>{modal === "cadastro" ? "Informe a diferença encontrada em cada lote: +5 acrescenta 5 unidades e -5 retira 5." : "Registro concluído e preservado no histórico."}</p></div></div><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModal(null)}><Icone nome="fechar" tamanho={22}/></button></div>
      {modal === "detalhes" && selecionado ? <div className="modal-body output-details-body">
        <div className="output-details-summary"><div><span>Data e hora</span><strong>{dataHoraBrasileira(selecionado.dataHora)}</strong></div><div><span>Responsável</span><strong>{selecionado.funcionarioNome}</strong></div><div><span>Solicitante</span><strong>{selecionado.solicitanteNome || "Não informado"}</strong></div><div><span>Lotes ajustados</span><strong>{selecionado.quantidadeItens}</strong></div></div>
        <div className="output-details-products"><h3>Itens do ajuste</h3>{selecionado.itens?.map(item => <div className="adjustment-detail-item" key={item.id}><div className="adjustment-detail-title"><strong>{item.produtoNome}</strong><span>Lote {item.codigoLote} · {dataBrasileira(item.dataValidade)}</span></div><div className="adjustment-values"><span>Anterior<strong>{item.quantidadeAnterior}</strong></span><span>Diferença<strong className={item.diferenca > 0 ? "positive" : "negative"}>{formatarDiferenca(item.diferenca)}</strong></span><span>Após ajuste<strong>{item.quantidadeFisica}</strong></span></div><p><strong>Justificativa:</strong> {item.justificativa}</p></div>)}</div>
        <div className="modal-footer"><button className="button button-secondary btn" onClick={() => setModal(null)}>Fechar</button></div>
      </div> : <form className="modal-body output-form" onSubmit={salvar} noValidate>
        <div className="output-form-summary"><label className="field form-label"><span>Funcionário solicitante <em>*</em></span><select className="form-select" value={solicitanteId} onChange={evento => { setSolicitanteId(evento.target.value); setErroFormulario(""); }}><option value="">Selecione...</option>{funcionarios.map(funcionario => <option key={funcionario.id} value={funcionario.id}>{funcionario.nome} — {funcionario.cargo}</option>)}</select></label><div className="field"><span>Responsável pelo ajuste</span><div className="readonly-field">{responsavel}</div></div><div className="field"><span>Data do ajuste</span><div className="readonly-field">{dataHoraBrasileira(dataRegistro)}</div><small>Registrada automaticamente ao confirmar.</small></div></div>
        <fieldset className="output-items"><div className="output-items-heading"><div><span className="output-items-icon"><Icone nome="caixa" tamanho={21}/></span><div><legend>Lotes para ajuste</legend><small>Informe quanto a mais (+) ou a menos (-) foi encontrado no estoque físico.</small></div></div><button type="button" className="button button-secondary btn" onClick={() => setItens(atuais => [...atuais, novoItem()])}><Icone nome="mais" tamanho={16}/> Adicionar item</button></div>
          {itens.map((item, indice) => { const lote = loteDoItem(item); const diferenca = item.diferenca.trim() === "" || !lote ? null : Number(item.diferenca); const novaQuantidade = lote && diferenca !== null && Number.isSafeInteger(diferenca) ? lote.quantidadeDisponivel + diferenca : null; const lotesUsados = new Set(itens.filter(outro => outro.chave !== item.chave).map(outro => Number(outro.loteId))); return <div className="adjustment-item" key={item.chave}>
            <span className="order-item-number">{indice + 1}</span>
            <label className="field form-label"><span>Produto <em>*</em></span><select className="form-select" value={item.produtoId} onChange={evento => void alterarProduto(item.chave, evento.target.value)}><option value="">Selecione...</option>{produtos.map(produto => <option key={produto.id} value={produto.id}>{produto.nome} — estoque {produto.quantidadeTotal}</option>)}</select></label>
            <label className="field form-label"><span>Lote <em>*</em></span><select className="form-select" disabled={!item.produtoId || item.carregando} value={item.loteId} onChange={evento => alterarItem(item.chave, "loteId", evento.target.value)}><option value="">{item.carregando ? "Carregando..." : "Selecione..."}</option>{item.lotes.map(opcao => <option key={opcao.id} value={opcao.id} disabled={lotesUsados.has(opcao.id)}>{opcao.codigoLote} — atual {opcao.quantidadeDisponivel}</option>)}</select></label>
            <label className="field form-label"><span>Diferença encontrada <em>*</em></span><input className="form-control" type="number" step={1} disabled={!item.loteId} value={item.diferenca} onChange={evento => alterarItem(item.chave, "diferenca", evento.target.value)} placeholder="+5 ou -5"/></label>
            <button type="button" className="icon-button order-remove btn" aria-label="Remover item" onClick={() => setItens(atuais => atuais.filter(atual => atual.chave !== item.chave))}><Icone nome="lixeira" tamanho={18}/></button>
            {lote && <div className="adjustment-calculation"><span>Quantidade registrada<strong>{lote.quantidadeDisponivel}</strong></span><span className={diferenca === null || diferenca === 0 ? "zero" : diferenca > 0 ? "positive" : "negative"}>Diferença<strong>{diferenca === null ? "—" : formatarDiferenca(diferenca)}</strong></span><Icone nome="direita" tamanho={16}/><span>Nova quantidade<strong>{novaQuantidade === null ? "—" : novaQuantidade}</strong></span>{novaQuantidade !== null && novaQuantidade < 0 && <span className="inline-stock-warning" role="alert">⚠ O lote possui só {lote.quantidadeDisponivel} unidade(s).</span>}</div>}
            <label className="field form-label adjustment-justification"><span>Justificativa <em>*</em></span><textarea className="form-control" maxLength={255} rows={2} value={item.justificativa} onChange={evento => alterarItem(item.chave, "justificativa", evento.target.value)} placeholder="Descreva o motivo da divergência..."/><small>{item.justificativa.length}/255</small></label>
          </div>; })}
          {!itens.length && <p className="empty-order-items">Nenhum item adicionado.</p>}
        </fieldset>
        {erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}
        <div className="modal-footer output-footer"><button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="button button-primary btn" disabled={processando}><Icone nome="troca" tamanho={17}/>{processando ? "Confirmando..." : "Confirmar ajuste"}</button></div>
      </form>}
    </div></div>}
  </>;
}
