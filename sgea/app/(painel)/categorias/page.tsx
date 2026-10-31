"use client";

import Icone from "../../components/Icone";
import TourGuia, { campoTour, elementoTour, avancarApos, voltarApos, type PassoTour } from "../../components/TourGuia";
import ConfirmacaoInativacao from "../../components/ConfirmacaoInativacao";
import UsuarioLogado from "../../components/UsuarioLogado";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Categoria = { id: number; nome: string; ativo: boolean };
type Situacao = "todas" | "ativas" | "inativas";
type Modo = "cadastro" | "edicao" | "detalhes" | null;
type Alerta = { titulo: string; mensagem: string; categoria?: Categoria; tipo?: "duplicada" | "inativacao" };

class ApiError extends Error {
  constructor(public status: number, public dados: { erro?: string; categoria?: Categoria }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem("sgea_token");
  const resposta = await fetch(`/api/categorias${caminho}`, {
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
  return <span className={`badge rounded-pill ${ativo ? "badge-ativa" : "badge-inativa"}`}>{ativo ? "Ativa" : "Inativa"}</span>;
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nomeFiltro, setNomeFiltro] = useState("");
  const [nomeConsulta, setNomeConsulta] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modo, setModo] = useState<Modo>(null);
  const [selecionada, setSelecionada] = useState<Categoria | null>(null);
  const [nomeFormulario, setNomeFormulario] = useState("");
  const [ativoFormulario, setAtivoFormulario] = useState(true);
  const [erroNomeFormulario, setErroNomeFormulario] = useState("");
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const [categoriaParaInativar, setCategoriaParaInativar] = useState<Categoria | null>(null);
  const consultaAtual = useRef(0);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setNomeConsulta(nomeFiltro.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [nomeFiltro]);

  const carregar = useCallback(async () => {
    const numeroConsulta = ++consultaAtual.current;
    setCarregando(true);
    setErroLista("");
    try {
      const parametros = new URLSearchParams({ nome: nomeConsulta, situacao });
      const dados = await requisicao<Categoria[]>(`?${parametros}`);
      if (numeroConsulta === consultaAtual.current) {
        setCategorias(dados);
        setPagina(1);
      }
    } catch {
      if (numeroConsulta === consultaAtual.current) {
        setCategorias([]);
        setPagina(1);
      }
    } finally {
      if (numeroConsulta === consultaAtual.current) setCarregando(false);
    }
  }, [nomeConsulta, situacao]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregar]);

  useEffect(() => {
    if (!modo && !alerta && !categoriaParaInativar) return;
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !processando) {
        if (categoriaParaInativar) setCategoriaParaInativar(null);
        else if (alerta) setAlerta(null);
        else setModo(null);
      }
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [modo, alerta, categoriaParaInativar, processando]);

  const abrirCadastro = () => {
    setSelecionada(null);
    setNomeFormulario("");
    setAtivoFormulario(true);
    setErroNomeFormulario("");
    setErroFormulario("");
    setModo("cadastro");
  };

  const abrirEdicao = (categoria: Categoria) => {
    setSelecionada(categoria);
    setNomeFormulario(categoria.nome);
    setErroNomeFormulario("");
    setErroFormulario("");
    setModo("edicao");
  };

  const abrirDetalhes = async (categoria: Categoria) => {
    try {
      const atual = await requisicao<Categoria>(`/${categoria.id}`);
      setSelecionada(atual);
      setModo("detalhes");
    } catch (erro) {
      setAlerta({ titulo: "Não foi possível consultar a categoria", mensagem: mensagemErro(erro) });
    }
  };

  const mensagemErro = (erro: unknown) => erro instanceof ApiError && erro.status < 500
    ? erro.message : "Não foi possível conectar ao backend. Tente novamente após iniciar a API.";

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault();
    const nome = nomeFormulario.trim();
    if (!nome) {
      setErroNomeFormulario("Preencha o nome da categoria.");
      return;
    }
    if (nome.length > 100) {
      setErroNomeFormulario("O nome deve ter no máximo 100 caracteres.");
      return;
    }
    setProcessando(true);
    setErroNomeFormulario("");
    setErroFormulario("");
    try {
      if (modo === "cadastro") {
        await requisicao<Categoria>("", { method: "POST", body: JSON.stringify({ nome, ativo: ativoFormulario }) });
      } else if (selecionada) {
        await requisicao<Categoria>(`/${selecionada.id}`, { method: "PATCH", body: JSON.stringify({ nome }) });
      }
      setModo(null);
      await carregar();
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 409 && erro.dados.categoria) {
        setAlerta({ titulo: "Categoria já cadastrada", mensagem: erro.dados.erro || erro.message,
          categoria: erro.dados.categoria, tipo: "duplicada" });
      } else if (erro instanceof ApiError && erro.status === 400) {
        setErroFormulario(erro.message);
      } else {
        setAlerta({ titulo: "Não foi possível salvar a categoria", mensagem: mensagemErro(erro) });
      }
    } finally {
      setProcessando(false);
    }
  };

  const alterarSituacao = async (categoria: Categoria, ativar: boolean) => {
    setProcessando(true);
    try {
      await requisicao<Categoria>(`/${categoria.id}/${ativar ? "reativar" : "inativar"}`, { method: "PATCH" });
      setModo(null);
      setAlerta(null);
      await carregar();
    } catch (erro) {
      if (!ativar && erro instanceof ApiError && erro.status === 409) {
        setAlerta({ titulo: "Não é possível inativar a categoria",
          mensagem: "Esta categoria possui produtos ativos vinculados. Inative ou altere a categoria desses produtos antes de tentar novamente.",
          tipo: "inativacao" });
      } else {
        setAlerta({ titulo: ativar ? "Não foi possível reativar a categoria" : "Não foi possível inativar a categoria",
          mensagem: mensagemErro(erro) });
      }
    } finally {
      setProcessando(false);
    }
  };

  const solicitarAlteracaoSituacao = (categoria: Categoria) => {
    if (categoria.ativo) setCategoriaParaInativar(categoria);
    else void alterarSituacao(categoria, true);
  };

  const confirmarInativacao = async () => {
    if (!categoriaParaInativar) return;
    const categoria = categoriaParaInativar;
    setCategoriaParaInativar(null);
    await alterarSituacao(categoria, false);
  };

  const totalPaginas = Math.max(1, Math.ceil(categorias.length / 5));
  const itens = categorias.slice((pagina - 1) * 5, pagina * 5);
  const inicio = categorias.length ? (pagina - 1) * 5 + 1 : 0;
  const fim = Math.min(pagina * 5, categorias.length);

  const passosTour: PassoTour[] = [
    { popover: { title: "Gerenciar Categorias", description: "As categorias organizam os produtos do almoxarifado (ex.: Limpeza, Escritório). Nesta tela você cadastra, consulta, edita, inativa e reativa categorias." } },
    { element: campoTour("Nome da categoria", ".filter-panel"), popover: { title: "Pesquisar pelo nome", description: "Digite parte do nome da categoria para filtrar a lista." } },
    { element: campoTour("Situação", ".filter-panel"), popover: { title: "Filtrar por situação", description: "Escolha entre categorias ativas, inativas ou todas." } },
    { element: ".table-panel", popover: { title: "Lista de categorias", description: "Mostra o nome e a situação de cada categoria." } },
    { element: ".table-panel tbody tr:first-child .name-link", popover: { title: "Ver detalhes", description: "Clique no nome para ver os dados da categoria." } },
    { element: ".table-panel tbody tr:first-child .action-edit", popover: { title: "Editar", description: "Altera o nome da categoria." } },
    { element: ".table-panel tbody tr:first-child .row-actions .action:last-child", popover: { title: "Inativar ou reativar", description: "Categorias inativas não podem ser usadas em novos produtos. Uma categoria com produtos ativos não pode ser inativada." } },
    { element: ".table-footer", popover: { title: "Paginação", description: "Use as setas para navegar entre as páginas da lista." } },
    { element: ".filter-panel .new-button", popover: { title: "Cadastrar categoria", description: "Clique aqui para cadastrar uma nova categoria. Clique em Próximo para conhecer o formulário.", onNextClick: avancarApos(abrirCadastro) } },
    { element: elementoTour(".modal-card"), popover: { title: "Formulário de cadastro", description: "Preencha os dados da nova categoria. Os campos marcados com * são obrigatórios.", onPrevClick: voltarApos(() => setModo(null)) } },
    { element: campoTour("Nome da categoria"), popover: { title: "Nome da categoria *", description: "Informe um nome que ainda não exista no sistema. Ex.: Material de limpeza." } },
    { element: campoTour("Situação"), popover: { title: "Situação", description: "Defina se a categoria já começa ativa." } },
    { element: elementoTour(".modal-card button[type='submit']"), popover: { title: "Salvar", description: "Clique em Salvar para cadastrar a categoria. Use Cancelar para fechar sem salvar." } },
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between">
        <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar categorias no sistema" placeholder="Buscar no sistema..." value={nomeFiltro} onChange={e => setNomeFiltro(e.target.value)}/></label>
        <UsuarioLogado />
      </header>

      <main className="main-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Categorias</strong></div>
        <div className="title-block title-with-help"><div><h1>Gerenciar Categorias</h1><p>Cadastre, consulte, edite, inative ou reative as categorias de produtos.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModo(atual => atual === "cadastro" ? null : atual)}/></div>

        <section className="filter-panel d-flex align-items-end" aria-label="Filtros de categorias">
          <label className="field form-label"><span>Nome da categoria</span><input className="form-control" placeholder="Digite o nome da categoria..." value={nomeFiltro} onChange={e => setNomeFiltro(e.target.value)}/></label>
          <label className="field field-select form-label"><span>Situação</span><select className="form-select" value={situacao} onChange={e => setSituacao(e.target.value as Situacao)}><option value="todas">Todas</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option></select></label>
          <button className="button button-primary btn new-button" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Nova Categoria</button>
        </section>

        <section className="table-panel" aria-label="Lista de categorias">
          <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Nome da categoria</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
            {!carregando && !erroLista && itens.map(categoria => <tr key={categoria.id}>
              <td><button className="name-link" onClick={() => void abrirDetalhes(categoria)} title="Ver detalhes da categoria">{categoria.nome}</button></td>
              <td><Badge ativo={categoria.ativo}/></td>
              <td><div className="row-actions d-flex"><button className="action action-edit btn" onClick={() => abrirEdicao(categoria)}><Icone nome="editar" tamanho={15}/> Editar</button>
                <button className={`action btn ${categoria.ativo ? "action-inactivate" : "action-reactivate"}`} disabled={processando} onClick={() => solicitarAlteracaoSituacao(categoria)}>
                  <Icone nome={categoria.ativo ? "lixeira" : "reativar"} tamanho={15}/>{categoria.ativo ? "Inativar" : "Reativar"}</button></div></td>
            </tr>)}
          </tbody></table></div>
          {carregando && <div className="table-state" role="status">Carregando categorias...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregar()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !categorias.length && <div className="table-state">Nenhuma categoria encontrada para os filtros informados.</div>}
        </section>

        <div className="table-footer d-flex align-items-center justify-content-between"><span>Mostrando {inicio} a {fim} de {categorias.length} categorias</span><div className="pagination d-flex align-items-center">
          <button className="btn" aria-label="Página anterior" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}><Icone nome="esquerda" tamanho={16}/></button>
          <span className="current-page" aria-label={`Página ${pagina} de ${totalPaginas}`}>{pagina}</span>
          <button className="btn" aria-label="Próxima página" disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)}><Icone nome="direita" tamanho={16}/></button>
        </div></div>
      </main>
    </div>

    {modo && <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !processando) setModo(null); }}>
      <div className="modal-card card border-0" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading d-flex align-items-center justify-content-between"><h2 id="modal-title">{modo === "cadastro" ? "Cadastrar Categoria" : modo === "edicao" ? "Editar Categoria" : "Detalhes da Categoria"}</h2><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div>
        {modo === "detalhes" && selecionada ? <div className="modal-body">
          <div className="field"><span>Nome da categoria</span><div className="readonly-field form-control">{selecionada.nome}</div></div>
          <div className="details-status d-flex align-items-center"><strong>Situação</strong><Badge ativo={selecionada.ativo}/></div>
          {!selecionada.ativo && <div className="info-box alert alert-info d-flex align-items-center mb-0"><span className="info-symbol">i</span><span>Esta categoria está inativa. Para utilizá-la novamente, clique em Reativar Categoria.</span></div>}
          <div className="modal-footer d-flex align-items-center justify-content-end"><button className="button button-secondary btn" onClick={() => setModo(null)}>Fechar</button>
            {!selecionada.ativo && <button className="button button-success btn" disabled={processando} onClick={() => void alterarSituacao(selecionada, true)}>{processando ? "Reativando..." : "Reativar Categoria"}</button>}</div>
        </div> : <form className="modal-body" onSubmit={salvar} noValidate>
          <label className="field form-label"><span>Nome da categoria <em>*</em></span><input className={`form-control ${erroNomeFormulario ? "is-invalid" : ""}`} autoFocus maxLength={100} placeholder="Digite o nome da categoria..." value={nomeFormulario} aria-invalid={Boolean(erroNomeFormulario)} aria-describedby={erroNomeFormulario ? "erro-nome-categoria" : undefined} onChange={e => { setNomeFormulario(e.target.value); if (erroNomeFormulario) setErroNomeFormulario(""); }}/>{erroNomeFormulario && <span id="erro-nome-categoria" className="invalid-feedback d-block" role="alert">{erroNomeFormulario}</span>}</label>
          {modo === "cadastro" ? <label className="field form-label"><span>Situação <em>*</em></span><select className="form-select" value={ativoFormulario ? "ativa" : "inativa"} onChange={e => setAtivoFormulario(e.target.value === "ativa")}><option value="ativa">Ativa</option><option value="inativa">Inativa</option></select></label>
            : <div className="info-box alert alert-info d-flex align-items-center mb-0"><span className="info-symbol">i</span><span>A situação da categoria é controlada por meio da inativação e reativação e não pode ser alterada nesta tela.</span></div>}
          {erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}
          <div className="modal-footer d-flex align-items-center justify-content-end">{modo === "edicao" && selecionada?.ativo && <button type="button" className="button button-danger btn footer-left" disabled={processando} onClick={() => setCategoriaParaInativar(selecionada)}>Inativar Categoria</button>}
            <button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModo(null)}>Cancelar</button>
            <button type="submit" className="button button-primary btn" disabled={processando}>{processando ? "Salvando..." : "Salvar"}</button></div>
        </form>}
      </div>
    </div>}

    {alerta && <div className="modal-overlay alert-layer" onMouseDown={e => { if (e.target === e.currentTarget) setAlerta(null); }}><div className="modal-card card border-0 alert-modal" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
      <button className="icon-button btn alert-close" aria-label="Fechar aviso" onClick={() => setAlerta(null)}><Icone nome="fechar" tamanho={20}/></button>
      <span className="warning-symbol">!</span><h2 id="alert-title">{alerta.titulo}</h2><p>{alerta.mensagem}</p>
      {alerta.tipo === "duplicada" && alerta.categoria && !alerta.categoria.ativo && <p className="alert-hint">Você pode reativar a categoria existente.</p>}
      <div className="alert-actions d-flex justify-content-end">{alerta.tipo === "duplicada" && alerta.categoria && !alerta.categoria.ativo && <button className="button button-success btn" disabled={processando} onClick={() => void alterarSituacao(alerta.categoria!, true)}>Reativar existente</button>}
        <button className="button button-primary btn" onClick={() => setAlerta(null)}>OK</button></div>
    </div></div>}

    {categoriaParaInativar && <ConfirmacaoInativacao
      titulo="Inativar categoria?"
      mensagem={`Tem certeza de que deseja inativar a categoria “${categoriaParaInativar.nome}”?`}
      processando={processando}
      onCancelar={() => setCategoriaParaInativar(null)}
      onConfirmar={() => void confirmarInativacao()}
    />}
  </>;
}
