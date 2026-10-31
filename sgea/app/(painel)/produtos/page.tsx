"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "../../components/Icone";
import ConfirmacaoInativacao from "../../components/ConfirmacaoInativacao";
import TourGuia, { type PassoTour } from "../../components/TourGuia";
import UsuarioLogado from "../../components/UsuarioLogado";

type Categoria = { id: number; nome: string; ativo: boolean };
type Lote = { id: number; codigoLote: string; quantidadeDisponivel: number; dataValidade: string | null; produtoId: number };
type Produto = {
  id: number;
  nome: string;
  ativo: boolean;
  categoriaId: number;
  categoriaNome: string;
  quantidadeTotal: number;
  lotes: Lote[];
};
type Situacao = "todos" | "ativos" | "inativos";
type Modo = "cadastro" | "edicao" | "detalhes" | null;
type ErrosCampos = Partial<Record<"nome" | "categoriaId" | "codigoLote" | "quantidadeLote" | "dataValidade", string>>;
type Alerta = { titulo: string; mensagem: string; produto?: Produto; duplicadoInativo?: boolean };

class ApiError extends Error {
  constructor(public status: number, public dados: { erro?: string; produto?: Produto }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(base: "produtos" | "categorias", caminho: string, opcoes?: RequestInit): Promise<T> {
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

function Badge({ ativo }: { ativo: boolean }) {
  return <span className={`badge rounded-pill ${ativo ? "badge-ativa" : "badge-inativa"}`}>{ativo ? "Ativo" : "Inativo"}</span>;
}

function dataBrasileira(data: string | null) {
  if (!data) return "Sem validade";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function dataVencida(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const hoje = new Date();
  const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return data < dataHoje;
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nomeFiltro, setNomeFiltro] = useState("");
  const [nomeConsulta, setNomeConsulta] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todos");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modo, setModo] = useState<Modo>(null);
  const [selecionado, setSelecionado] = useState<Produto | null>(null);
  const [nomeFormulario, setNomeFormulario] = useState("");
  const [categoriaFormulario, setCategoriaFormulario] = useState("");
  const [codigoLote, setCodigoLote] = useState("");
  const [quantidadeLote, setQuantidadeLote] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [errosCampos, setErrosCampos] = useState<ErrosCampos>({});
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [confirmarVencido, setConfirmarVencido] = useState(false);
  const [produtoParaInativar, setProdutoParaInativar] = useState<Produto | null>(null);
  const consultaAtual = useRef(0);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setNomeConsulta(nomeFiltro.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [nomeFiltro]);

  const carregarProdutos = useCallback(async () => {
    const numeroConsulta = ++consultaAtual.current;
    setCarregando(true);
    setErroLista("");
    try {
      const parametros = new URLSearchParams({ nome: nomeConsulta, situacao });
      const dados = await requisicao<Produto[]>("produtos", `?${parametros}`);
      if (numeroConsulta === consultaAtual.current) {
        setProdutos(dados);
        setPagina(1);
      }
    } catch {
      if (numeroConsulta === consultaAtual.current) {
        setProdutos([]);
        setPagina(1);
      }
    } finally {
      if (numeroConsulta === consultaAtual.current) setCarregando(false);
    }
  }, [nomeConsulta, situacao]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarProdutos(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarProdutos]);

  useEffect(() => {
    const carregarCategorias = async () => {
      try {
        const dados = await requisicao<Categoria[]>("categorias", "?nome=&situacao=todas");
        setCategorias(dados);
      } catch (erro) {
        setErroLista(mensagemErro(erro));
      }
    };
    void carregarCategorias();
  }, []);

  useEffect(() => {
    if (!modo && !alerta && !confirmarVencido && !produtoParaInativar) return;
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || processando) return;
      if (produtoParaInativar) setProdutoParaInativar(null);
      else if (confirmarVencido) setConfirmarVencido(false);
      else if (alerta) setAlerta(null);
      else setModo(null);
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [modo, alerta, confirmarVencido, produtoParaInativar, processando]);

  const limparFormulario = () => {
    setNomeFormulario("");
    setCategoriaFormulario("");
    setCodigoLote("");
    setQuantidadeLote("");
    setDataValidade("");
    setErrosCampos({});
    setErroFormulario("");
  };

  const abrirCadastro = () => {
    setSelecionado(null);
    limparFormulario();
    setModo("cadastro");
  };

  const abrirEdicao = (produto: Produto) => {
    setSelecionado(produto);
    setNomeFormulario(produto.nome);
    setCategoriaFormulario(String(produto.categoriaId));
    setErrosCampos({});
    setErroFormulario("");
    setModo("edicao");
  };

  const abrirDetalhes = async (produto: Produto) => {
    try {
      const atual = await requisicao<Produto>("produtos", `/${produto.id}`);
      setSelecionado(atual);
      setModo("detalhes");
    } catch (erro) {
      setAlerta({ titulo: "Não foi possível consultar o produto", mensagem: mensagemErro(erro) });
    }
  };

  // Lotes sem código usam o código 1; qualquer outro código exige a data de validade.
  const exigeValidade = codigoLote.trim() !== "" && codigoLote.trim() !== "1";

  const validarFormulario = () => {
    const erros: ErrosCampos = {};
    const nome = nomeFormulario.trim();
    if (!nome) erros.nome = "Preencha o nome do produto.";
    else if (nome.length > 150) erros.nome = "O nome deve ter no máximo 150 caracteres.";
    if (!categoriaFormulario) erros.categoriaId = "Selecione uma categoria.";

    if (modo === "cadastro") {
      const quantidade = Number(quantidadeLote);
      if (!quantidadeLote) erros.quantidadeLote = "Preencha a quantidade do lote.";
      else if (!Number.isSafeInteger(quantidade) || quantidade <= 0) erros.quantidadeLote = "Informe uma quantidade inteira e positiva.";
      if (dataValidade && !codigoLote.trim()) erros.codigoLote = "Informe o código do lote quando houver data de validade.";
      if (exigeValidade && !dataValidade) erros.dataValidade = "Informe a data de validade para lotes com código diferente de 1.";
      if (dataValidade && !/^\d{4}-\d{2}-\d{2}$/.test(dataValidade)) {
        erros.dataValidade = "Informe uma data válida.";
      }
    }

    setErrosCampos(erros);
    return Object.keys(erros).length === 0;
  };

  const executarSalvamento = async () => {
    setProcessando(true);
    setErroFormulario("");
    try {
      if (modo === "cadastro") {
        await requisicao<Produto>("produtos", "", {
          method: "POST",
          body: JSON.stringify({
            nome: nomeFormulario.trim(),
            categoriaId: Number(categoriaFormulario),
            codigoLote: codigoLote.trim() || null,
            quantidadeLote: Number(quantidadeLote),
            dataValidade: dataValidade || null,
          }),
        });
      } else if (selecionado) {
        await requisicao<Produto>("produtos", `/${selecionado.id}`, {
          method: "PATCH",
          body: JSON.stringify({ nome: nomeFormulario.trim(), categoriaId: Number(categoriaFormulario) }),
        });
      }
      setModo(null);
      await carregarProdutos();
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 409 && erro.dados.produto) {
        setAlerta({
          titulo: "Produto já cadastrado",
          mensagem: erro.message,
          produto: erro.dados.produto,
          duplicadoInativo: !erro.dados.produto.ativo,
        });
      } else if (erro instanceof ApiError && (erro.status === 400 || erro.status === 409)) {
        setErroFormulario(erro.message);
      } else {
        setAlerta({ titulo: "Não foi possível salvar o produto", mensagem: mensagemErro(erro) });
      }
    } finally {
      setProcessando(false);
    }
  };

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!validarFormulario()) return;
    if (modo === "cadastro" && dataValidade && dataVencida(dataValidade)) {
      setConfirmarVencido(true);
      return;
    }
    await executarSalvamento();
  };

  const alterarSituacao = async (produto: Produto, ativar: boolean) => {
    setProcessando(true);
    try {
      await requisicao<Produto>("produtos", `/${produto.id}/${ativar ? "reativar" : "inativar"}`, { method: "PATCH" });
      setModo(null);
      setAlerta(null);
      await carregarProdutos();
    } catch (erro) {
      setAlerta({
        titulo: ativar ? "Não foi possível reativar o produto" : "Não foi possível inativar o produto",
        mensagem: mensagemErro(erro),
      });
    } finally {
      setProcessando(false);
    }
  };

  const solicitarAlteracaoSituacao = (produto: Produto) => {
    if (produto.ativo) setProdutoParaInativar(produto);
    else void alterarSituacao(produto, true);
  };

  const confirmarInativacao = async () => {
    if (!produtoParaInativar) return;
    const produto = produtoParaInativar;
    setProdutoParaInativar(null);
    await alterarSituacao(produto, false);
  };

  const categoriasAtivas = categorias.filter(categoria => categoria.ativo);
  const produtosFiltrados = categoriaFiltro
    ? produtos.filter(produto => produto.categoriaId === Number(categoriaFiltro))
    : produtos;
  const totalPaginas = Math.max(1, Math.ceil(produtosFiltrados.length / 5));
  const itens = produtosFiltrados.slice((pagina - 1) * 5, pagina * 5);
  const inicio = produtosFiltrados.length ? (pagina - 1) * 5 + 1 : 0;
  const fim = Math.min(pagina * 5, produtosFiltrados.length);

  const elementoTour = (nome: string) => () => document.querySelector(`[data-tour='${nome}']`) as Element;
  const passosTour: PassoTour[] = [
    { popover: { title: "Gerenciar Produtos", description: "Nesta tela você cadastra, consulta, edita, inativa e reativa os produtos do almoxarifado. Use os botões abaixo para conhecer cada parte." } },
    { element: "[data-tour='filtro-nome']", popover: { title: "Pesquisar pelo nome", description: "Digite parte do nome do produto. A lista é atualizada automaticamente enquanto você digita." } },
    { element: "[data-tour='filtro-categoria']", popover: { title: "Filtrar por categoria", description: "Selecione uma categoria para ver apenas os produtos dela." } },
    { element: "[data-tour='filtro-situacao']", popover: { title: "Filtrar por situação", description: "Escolha entre produtos ativos, inativos ou todos." } },
    { element: "[data-tour='lista-produtos']", popover: { title: "Lista de produtos", description: "Mostra o nome, a categoria, a quantidade total em estoque (soma de todos os lotes) e a situação de cada produto." } },
    { element: ".product-table tbody tr:first-child .name-link", popover: { title: "Ver detalhes", description: "Clique no nome do produto para ver seus dados e todos os lotes com quantidade e validade." } },
    { element: ".product-table tbody tr:first-child .action-edit", popover: { title: "Editar", description: "Altera o nome ou a categoria do produto." } },
    { element: ".product-table tbody tr:first-child .row-actions .action:last-child", popover: { title: "Inativar ou reativar", description: "Produtos inativos deixam de aparecer nas entradas, saídas e pedidos, mas o histórico é mantido. Você pode reativá-los quando precisar." } },
    { element: "[data-tour='paginacao']", popover: { title: "Paginação", description: "Use as setas para navegar entre as páginas da lista." } },
    {
      element: "[data-tour='novo-produto']",
      popover: {
        title: "Cadastrar produto",
        description: "Clique aqui para cadastrar um novo produto. Clique em Próximo para ver o formulário de cadastro.",
        // Abre o formulário e só avança depois que ele estiver na tela.
        onNextClick: (_elemento, _passo, { driver }) => { abrirCadastro(); window.setTimeout(() => driver.moveNext(), 150); }
      }
    },
    {
      element: elementoTour("form-produto"),
      popover: {
        title: "Formulário de cadastro",
        description: "Preencha os dados do novo produto. Os campos marcados com * são obrigatórios.",
        onPrevClick: (_elemento, _passo, { driver }) => { setModo(null); window.setTimeout(() => driver.movePrevious(), 150); }
      }
    },
    { element: elementoTour("form-nome"), popover: { title: "Nome do produto *", description: "Informe o nome do produto, com até 150 caracteres. Ex.: Detergente neutro 500 ml." } },
    { element: elementoTour("form-categoria"), popover: { title: "Categoria *", description: "Selecione a categoria do produto. Apenas categorias ativas aparecem nesta lista." } },
    { element: elementoTour("form-lote"), popover: { title: "Lote inicial", description: "Registra o estoque que já existe do produto no momento do cadastro. Novos recebimentos devem ser lançados pela tela de Entradas." } },
    { element: elementoTour("form-codigo"), popover: { title: "Código do lote", description: "Informe o código impresso na embalagem. Se o produto não tiver código de lote, deixe em branco: o sistema usará o código 1." } },
    { element: elementoTour("form-quantidade"), popover: { title: "Quantidade *", description: "Quantidade disponível deste lote no estoque." } },
    { element: elementoTour("form-validade"), popover: { title: "Data de validade", description: "Obrigatória quando o código do lote for diferente de 1. Se a data já estiver vencida, o sistema pedirá uma confirmação antes de salvar." } },
    { element: elementoTour("form-salvar"), popover: { title: "Salvar", description: "Confira os dados e clique em Salvar para cadastrar o produto. Use Cancelar para fechar sem salvar." } },
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between">
        <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar produtos no sistema" placeholder="Buscar no sistema..." value={nomeFiltro} onChange={evento => setNomeFiltro(evento.target.value)}/></label>
        <UsuarioLogado />
      </header>

      <main className="main-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Produtos</strong></div>
        <div className="title-block title-with-help"><div><h1>Gerenciar Produtos</h1><p>Cadastre, consulte, edite, inative ou reative os produtos do estoque.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModo(atual => atual === "cadastro" ? null : atual)}/></div>

        <section className="filter-panel product-filters d-flex align-items-end" aria-label="Filtros de produtos">
          <label className="field form-label" data-tour="filtro-nome"><span>Nome do produto</span><input className="form-control" placeholder="Digite o nome do produto..." value={nomeFiltro} onChange={evento => setNomeFiltro(evento.target.value)}/></label>
          <label className="field form-label" data-tour="filtro-categoria"><span>Categoria</span><select className="form-select" value={categoriaFiltro} onChange={evento => { setCategoriaFiltro(evento.target.value); setPagina(1); }}><option value="">Todas</option>{categorias.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select></label>
          <label className="field form-label" data-tour="filtro-situacao"><span>Situação</span><select className="form-select" value={situacao} onChange={evento => setSituacao(evento.target.value as Situacao)}><option value="todos">Todas</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
          <button className="button button-primary btn new-button" data-tour="novo-produto" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Novo Produto</button>
        </section>

        <section className="table-panel product-table" aria-label="Lista de produtos" data-tour="lista-produtos">
          <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Nome</th><th>Categoria</th><th>Quantidade Total</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
            {!carregando && !erroLista && itens.map(produto => <tr key={produto.id}>
              <td><button className="name-link" onClick={() => void abrirDetalhes(produto)} title="Ver detalhes e lotes do produto">{produto.nome}</button></td>
              <td>{produto.categoriaNome}</td>
              <td>{produto.quantidadeTotal}</td>
              <td><Badge ativo={produto.ativo}/></td>
              <td><div className="row-actions d-flex"><button className="action action-edit btn" onClick={() => abrirEdicao(produto)}><Icone nome="editar" tamanho={15}/> Editar</button><button className={`action btn ${produto.ativo ? "action-inactivate" : "action-reactivate"}`} disabled={processando} onClick={() => solicitarAlteracaoSituacao(produto)}><Icone nome={produto.ativo ? "lixeira" : "reativar"} tamanho={15}/>{produto.ativo ? "Inativar" : "Reativar"}</button></div></td>
            </tr>)}
          </tbody></table></div>
          {carregando && <div className="table-state" role="status">Carregando produtos...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregarProdutos()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !produtosFiltrados.length && <div className="table-state">Nenhum produto encontrado para os filtros informados.</div>}
        </section>

        <div className="table-footer d-flex align-items-center justify-content-between" data-tour="paginacao"><span>Mostrando {inicio} a {fim} de {produtosFiltrados.length} produtos</span><div className="pagination d-flex align-items-center"><button className="btn" aria-label="Página anterior" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}><Icone nome="esquerda" tamanho={16}/></button><span className="current-page" aria-label={`Página ${pagina} de ${totalPaginas}`}>{pagina}</span><button className="btn" aria-label="Próxima página" disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)}><Icone nome="direita" tamanho={16}/></button></div></div>
      </main>
    </div>

    {modo && <div className="modal-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget && !processando) setModo(null); }}>
      <div className="modal-card product-modal card border-0" data-tour="form-produto" role="dialog" aria-modal="true" aria-labelledby="produto-modal-title">
        <div className="modal-heading d-flex align-items-center justify-content-between"><h2 id="produto-modal-title">{modo === "cadastro" ? "Cadastrar Produto" : modo === "edicao" ? "Editar Produto" : "Detalhes do Produto"}</h2><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div>

        {modo === "detalhes" && selecionado ? <div className="modal-body">
          <div className="product-detail-grid"><div className="field"><span>Nome do produto</span><div className="readonly-field form-control">{selecionado.nome}</div></div><div className="field"><span>Categoria</span><div className="readonly-field form-control">{selecionado.categoriaNome}</div></div></div>
          <div className="details-status d-flex align-items-center"><strong>Situação</strong><Badge ativo={selecionado.ativo}/><strong className="ms-auto">Quantidade total: {selecionado.quantidadeTotal}</strong></div>
          {!selecionado.ativo && <div className="info-box alert alert-info d-flex align-items-center mb-0"><span className="info-symbol">i</span><span>Este produto está inativo. Para utilizá-lo novamente, clique em Reativar Produto.</span></div>}
          <div className="lot-section"><h3>Lotes vinculados</h3><div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Código</th><th>Quantidade disponível</th><th>Data de validade</th></tr></thead><tbody>{selecionado.lotes?.length ? selecionado.lotes.map(lote => <tr key={lote.id}><td>{lote.codigoLote}</td><td>{lote.quantidadeDisponivel}</td><td>{dataBrasileira(lote.dataValidade)}</td></tr>) : <tr><td colSpan={3}>Nenhum lote vinculado.</td></tr>}</tbody></table></div></div>
          <div className="modal-footer d-flex align-items-center justify-content-end"><button className="button button-secondary btn" onClick={() => setModo(null)}>Fechar</button>{!selecionado.ativo && <button className="button button-success btn" disabled={processando} onClick={() => void alterarSituacao(selecionado, true)}>{processando ? "Reativando..." : "Reativar Produto"}</button>}</div>
        </div> : <form className="modal-body" onSubmit={salvar} noValidate>
          <label className="field form-label" data-tour="form-nome"><span>Nome do produto <em>*</em></span><input className={`form-control ${errosCampos.nome ? "is-invalid" : ""}`} autoFocus maxLength={150} placeholder="Digite o nome do produto..." value={nomeFormulario} onChange={evento => { setNomeFormulario(evento.target.value); setErrosCampos(erros => ({ ...erros, nome: undefined })); }}/>{errosCampos.nome && <span className="invalid-feedback d-block" role="alert">{errosCampos.nome}</span>}</label>
          <label className="field form-label" data-tour="form-categoria"><span>Categoria <em>*</em></span><select className={`form-select ${errosCampos.categoriaId ? "is-invalid" : ""}`} value={categoriaFormulario} onChange={evento => { setCategoriaFormulario(evento.target.value); setErrosCampos(erros => ({ ...erros, categoriaId: undefined })); }}><option value="">Selecione uma categoria...</option>{categoriasAtivas.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}</select>{errosCampos.categoriaId && <span className="invalid-feedback d-block" role="alert">{errosCampos.categoriaId}</span>}</label>

          {modo === "cadastro" ? <fieldset className="lot-form" data-tour="form-lote"><legend>Lote inicial</legend><div className="lot-form-grid"><label className="field form-label" data-tour="form-codigo"><span>Código do lote</span><input className={`form-control ${errosCampos.codigoLote ? "is-invalid" : ""}`} maxLength={50} placeholder="Código da embalagem" value={codigoLote} onChange={evento => { setCodigoLote(evento.target.value); setErrosCampos(erros => ({ ...erros, codigoLote: undefined })); }}/>{errosCampos.codigoLote && <span className="invalid-feedback d-block" role="alert">{errosCampos.codigoLote}</span>}</label><label className="field form-label" data-tour="form-quantidade"><span>Quantidade <em>*</em></span><input className={`form-control ${errosCampos.quantidadeLote ? "is-invalid" : ""}`} type="number" min={1} step={1} placeholder="Digite a quantidade" value={quantidadeLote} onChange={evento => { setQuantidadeLote(evento.target.value); setErrosCampos(erros => ({ ...erros, quantidadeLote: undefined })); }}/>{errosCampos.quantidadeLote && <span className="invalid-feedback d-block" role="alert">{errosCampos.quantidadeLote}</span>}</label><label className="field form-label" data-tour="form-validade"><span>Data de validade {exigeValidade ? <em>*</em> : "(opcional)"}</span><input className={`form-control ${errosCampos.dataValidade ? "is-invalid" : ""}`} type="date" value={dataValidade} onChange={evento => { setDataValidade(evento.target.value); setErrosCampos(erros => ({ ...erros, dataValidade: undefined })); }}/>{errosCampos.dataValidade && <span className="invalid-feedback d-block" role="alert">{errosCampos.dataValidade}</span>}</label></div><div className="info-box alert alert-info d-flex align-items-center mb-0"><span className="info-symbol">i</span><span>Para produtos sem código de lote e sem validade, o sistema atribuirá o código 1.</span></div></fieldset> : <div className="info-box alert alert-info d-flex align-items-center mb-0"><span className="info-symbol">i</span><span>A quantidade e a validade são controladas pelos lotes e não podem ser alteradas nesta tela.</span></div>}

          {erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}
          <div className="modal-footer d-flex align-items-center justify-content-end">{modo === "edicao" && selecionado?.ativo && <button type="button" className="button button-danger btn footer-left" disabled={processando} onClick={() => setProdutoParaInativar(selecionado)}>Inativar Produto</button>}<button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModo(null)}>Cancelar</button><button type="submit" className="button button-primary btn" data-tour="form-salvar" disabled={processando}>{processando ? "Salvando..." : "Salvar"}</button></div>
        </form>}
      </div>
    </div>}

    {alerta && <div className="modal-overlay alert-layer" onMouseDown={evento => { if (evento.target === evento.currentTarget) setAlerta(null); }}><div className="modal-card card border-0 alert-modal" role="alertdialog" aria-modal="true" aria-labelledby="produto-alert-title"><button className="icon-button btn alert-close" aria-label="Fechar aviso" onClick={() => setAlerta(null)}><Icone nome="fechar" tamanho={20}/></button><span className="warning-symbol">!</span><h2 id="produto-alert-title">{alerta.titulo}</h2><p>{alerta.mensagem}</p>{alerta.duplicadoInativo && <p className="alert-hint">Você pode reativar o produto existente.</p>}<div className="alert-actions d-flex justify-content-end">{alerta.duplicadoInativo && alerta.produto && <button className="button button-success btn" disabled={processando} onClick={() => void alterarSituacao(alerta.produto!, true)}>Reativar existente</button>}<button className="button button-primary btn" onClick={() => setAlerta(null)}>OK</button></div></div></div>}

    {confirmarVencido && <div className="modal-overlay alert-layer" onMouseDown={evento => { if (evento.target === evento.currentTarget && !processando) setConfirmarVencido(false); }}><div className="modal-card card border-0 alert-modal" role="alertdialog" aria-modal="true" aria-labelledby="produto-vencido-title"><button className="icon-button btn alert-close" aria-label="Fechar aviso" disabled={processando} onClick={() => setConfirmarVencido(false)}><Icone nome="fechar" tamanho={20}/></button><span className="warning-symbol">!</span><h2 id="produto-vencido-title">Produto com validade vencida</h2><p>A data de validade informada já venceu. Deseja cadastrar este produto mesmo assim?</p><div className="alert-actions d-flex justify-content-end"><button className="button button-secondary btn" disabled={processando} onClick={() => setConfirmarVencido(false)}>Cancelar</button><button className="button button-primary btn" disabled={processando} onClick={() => { setConfirmarVencido(false); void executarSalvamento(); }}>Cadastrar mesmo assim</button></div></div></div>}

    {produtoParaInativar && <ConfirmacaoInativacao titulo="Inativar produto?" mensagem={`Tem certeza de que deseja inativar o produto “${produtoParaInativar.nome}”? Ele só será inativado se a quantidade total disponível for zero.`} processando={processando} onCancelar={() => setProdutoParaInativar(null)} onConfirmar={() => void confirmarInativacao()}/>}
  </>;
}

function mensagemErro(erro: unknown) {
  return erro instanceof ApiError
    ? erro.message
    : "Não foi possível conectar ao backend. Verifique se a API está em execução na porta 5001.";
}
