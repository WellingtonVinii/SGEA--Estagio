"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import ConfirmacaoInativacao from "../../components/ConfirmacaoInativacao";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, elementoTour, avancarApos, voltarApos, type PassoTour } from "../../components/TourGuia";
import UsuarioLogado from "../../components/UsuarioLogado";

type Usuario = {
  id: number;
  email: string;
  ativo: boolean;
  funcionarioId: number;
  funcionarioNome: string;
  perfilId: number;
  perfil: string;
};
type Funcionario = { id: number; nome: string; ativo: boolean; possuiUsuario: boolean };
type Perfil = { id: number; nome: string };
type Situacao = "todos" | "ativos" | "inativos";
type Modo = "cadastro" | "edicao" | null;
type Erros = Partial<Record<"funcionarioId" | "email" | "senha" | "perfilId", string>>;

const perfis: Perfil[] = [
  { id: 1, nome: "Administrador" },
  { id: 2, nome: "Funcionário do Estoque" },
];

class ApiError extends Error {
  constructor(public status: number, public dados: { erro?: string }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(base: "usuarios" | "funcionarios", caminho: string, opcoes?: RequestInit): Promise<T> {
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

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState("");
  const [perfilFiltro, setPerfilFiltro] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todos");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modo, setModo] = useState<Modo>(null);
  const [selecionado, setSelecionado] = useState<Usuario | null>(null);
  const [funcionarioId, setFuncionarioId] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfilId, setPerfilId] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [erros, setErros] = useState<Erros>({});
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const [usuarioParaInativar, setUsuarioParaInativar] = useState<Usuario | null>(null);
  const [usuarioParaSenha, setUsuarioParaSenha] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [erroAlteracaoSenha, setErroAlteracaoSenha] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroLista("");
    try {
      const [listaUsuarios, listaFuncionarios] = await Promise.all([
        requisicao<Usuario[]>("usuarios", ""),
        requisicao<Funcionario[]>("funcionarios", "?situacao=ativos"),
      ]);
      setUsuarios(listaUsuarios);
      setFuncionarios(listaFuncionarios);
    } catch (erro) {
      setErroLista(erro instanceof ApiError && erro.status < 500
        ? erro.message : "Não foi possível carregar os usuários. Verifique se a API está em execução.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { const temporizador = window.setTimeout(() => void carregar(), 0); return () => window.clearTimeout(temporizador); }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return usuarios.filter(usuario => {
      const correspondeBusca = !termo || usuario.funcionarioNome.toLocaleLowerCase("pt-BR").includes(termo) || usuario.email.toLocaleLowerCase("pt-BR").includes(termo);
      const correspondePerfil = !perfilFiltro || String(usuario.perfilId) === perfilFiltro;
      const correspondeSituacao = situacao === "todos" || (situacao === "ativos" ? usuario.ativo : !usuario.ativo);
      return correspondeBusca && correspondePerfil && correspondeSituacao;
    });
  }, [usuarios, busca, perfilFiltro, situacao]);

  function abrirCadastro() {
    setSelecionado(null); setFuncionarioId(""); setEmail(""); setSenha(""); setPerfilId(""); setAtivo(true); setErros({}); setErroFormulario(""); setModo("cadastro");
  }

  function abrirEdicao(usuario: Usuario) {
    setSelecionado(usuario); setFuncionarioId(String(usuario.funcionarioId)); setEmail(usuario.email); setSenha(""); setPerfilId(String(usuario.perfilId)); setAtivo(usuario.ativo); setErros({}); setErroFormulario(""); setModo("edicao");
  }

  function validar() {
    const novos: Erros = {};
    if (!funcionarioId) novos.funcionarioId = "Selecione um funcionário.";
    if (!email.trim()) novos.email = "Informe o e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) novos.email = "Informe um e-mail válido.";
    if (modo === "cadastro" && senha.length < 6) novos.senha = "A senha deve possuir pelo menos 6 caracteres.";
    if (!perfilId) novos.perfilId = "Selecione um perfil.";
    setErros(novos);
    return !Object.keys(novos).length;
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setErroFormulario("");
    if (!validar()) return;
    setProcessando(true);
    try {
      const corpo: Record<string, string | number | boolean> = {
        email: email.trim().toLowerCase(), perfilId: Number(perfilId),
      };
      if (modo === "cadastro") { corpo.funcionarioId = Number(funcionarioId); corpo.senha = senha; corpo.ativo = ativo; }
      await requisicao<Usuario>("usuarios", modo === "cadastro" ? "" : `/${selecionado?.id}`, {
        method: modo === "cadastro" ? "POST" : "PUT", body: JSON.stringify(corpo),
      });
      setModo(null);
      await carregar();
    } catch (erro) {
      setErroFormulario(erro instanceof ApiError ? erro.message : "Não foi possível salvar o usuário.");
    } finally { setProcessando(false); }
  }

  async function alterarSituacao(usuario: Usuario, reativar: boolean) {
    setProcessando(true);
    try {
      await requisicao<Usuario>("usuarios", `/${usuario.id}/${reativar ? "reativar" : "inativar"}`, { method: "PATCH" });
      setUsuarioParaInativar(null);
      await carregar();
    } catch (erro) {
      setErroLista(erro instanceof ApiError ? erro.message : "Não foi possível alterar a situação do usuário.");
    } finally { setProcessando(false); }
  }

  function abrirAlteracaoSenha(usuario: Usuario) {
    setModo(null);
    setUsuarioParaSenha(usuario);
    setNovaSenha("");
    setConfirmacaoSenha("");
    setErroAlteracaoSenha("");
  }

  async function alterarSenha(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!usuarioParaSenha) return;
    if (novaSenha.length < 6) {
      setErroAlteracaoSenha("A nova senha deve possuir pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmacaoSenha) {
      setErroAlteracaoSenha("As senhas informadas não são iguais.");
      return;
    }

    setProcessando(true);
    setErroAlteracaoSenha("");
    try {
      await requisicao<Usuario>("usuarios", `/${usuarioParaSenha.id}/senha`, {
        method: "PATCH",
        body: JSON.stringify({ senha: novaSenha, confirmacaoSenha }),
      });
      setUsuarioParaSenha(null);
      setNovaSenha("");
      setConfirmacaoSenha("");
    } catch (erro) {
      setErroAlteracaoSenha(erro instanceof ApiError ? erro.message : "Não foi possível alterar a senha.");
    } finally {
      setProcessando(false);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 5));
  const itens = filtrados.slice((pagina - 1) * 5, pagina * 5);
  const inicio = filtrados.length ? (pagina - 1) * 5 + 1 : 0;
  const fim = Math.min(pagina * 5, filtrados.length);
  const funcionariosDisponiveis = funcionarios.filter(funcionario => !funcionario.possuiUsuario);

  const passosTour: PassoTour[] = [
    { popover: { title: "Gerenciar Usuários", description: "Cada usuário é o acesso de um funcionário ao sistema. O perfil define o que ele pode fazer: ADM tem acesso completo e Funcionário do Estoque acessa as operações de estoque." } },
    { element: campoTour("Nome ou e-mail", ".filter-panel"), popover: { title: "Pesquisar", description: "Digite parte do nome do funcionário ou do e-mail." } },
    { element: campoTour("Perfil", ".filter-panel"), popover: { title: "Filtrar por perfil", description: "Mostra apenas os usuários do perfil selecionado." } },
    { element: campoTour("Situação", ".filter-panel"), popover: { title: "Filtrar por situação", description: "Escolha entre usuários ativos, inativos ou todos." } },
    { element: ".table-panel", popover: { title: "Lista de usuários", description: "Mostra o funcionário, o e-mail de acesso, o perfil e a situação." } },
    { element: ".table-panel tbody tr:first-child .action-edit", popover: { title: "Editar", description: "Altera o perfil e o e-mail. Na edição também é possível alterar a senha." } },
    { element: ".table-panel tbody tr:first-child .row-actions .action:last-child", popover: { title: "Inativar ou reativar", description: "Usuários inativos não conseguem entrar no sistema." } },
    { element: ".table-footer", popover: { title: "Paginação", description: "Use as setas para navegar entre as páginas da lista." } },
    { element: ".filter-panel .new-button", popover: { title: "Cadastrar usuário", description: "Clique aqui para criar o acesso de um funcionário. Clique em Próximo para conhecer o formulário.", onNextClick: avancarApos(abrirCadastro) } },
    { element: elementoTour(".modal-card"), popover: { title: "Formulário de cadastro", description: "Preencha os dados de acesso. Os campos marcados com * são obrigatórios.", onPrevClick: voltarApos(() => setModo(null)) } },
    { element: campoTour("Funcionário"), popover: { title: "Funcionário *", description: "Selecione o funcionário que vai usar o sistema. Só aparecem funcionários ativos que ainda não têm usuário." } },
    { element: campoTour("Perfil"), popover: { title: "Perfil *", description: "ADM: acesso completo. Funcionário do Estoque: acesso às operações de estoque." } },
    { element: campoTour("E-mail"), popover: { title: "E-mail *", description: "E-mail usado para entrar no sistema." } },
    { element: campoTour("Senha"), popover: { title: "Senha *", description: "Senha inicial de acesso. O usuário poderá alterá-la depois." } },
    { element: campoTour("Situação"), popover: { title: "Situação", description: "Defina se o acesso já começa ativo." } },
    { element: elementoTour(".modal-card button[type='submit']"), popover: { title: "Salvar", description: "Clique em Salvar para criar o usuário. Use Cancelar para fechar sem salvar." } },
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between">
        <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar usuários no sistema" placeholder="Buscar no sistema..." value={busca} onChange={evento => { setBusca(evento.target.value); setPagina(1); }}/></label>
        <UsuarioLogado />
      </header>
      <main className="main-content user-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Usuários</strong></div>
        <div className="title-block title-with-help"><div><h1>Gerenciar Usuários</h1><p>Cadastre, consulte, edite, inative ou reative os acessos ao sistema.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModo(atual => atual === "cadastro" ? null : atual)}/></div>
        <section className="filter-panel user-filters d-flex align-items-end" aria-label="Filtros de usuários">
          <label className="field form-label"><span>Nome ou e-mail</span><input className="form-control" placeholder="Digite o nome ou e-mail..." value={busca} onChange={evento => { setBusca(evento.target.value); setPagina(1); }}/></label>
          <label className="field form-label"><span>Perfil</span><select className="form-select" value={perfilFiltro} onChange={evento => { setPerfilFiltro(evento.target.value); setPagina(1); }}><option value="">Todos</option>{perfis.map(perfil => <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>)}</select></label>
          <label className="field form-label"><span>Situação</span><select className="form-select" value={situacao} onChange={evento => { setSituacao(evento.target.value as Situacao); setPagina(1); }}><option value="todos">Todas</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
          <button className="button button-primary btn new-button" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Novo Usuário</button>
        </section>
        <section className="table-panel user-table" aria-label="Lista de usuários">
          <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Funcionário</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{!carregando && !erroLista && itens.map(usuario => <tr key={usuario.id}><td>{usuario.funcionarioNome}</td><td>{usuario.email}</td><td>{usuario.perfil}</td><td><Badge ativo={usuario.ativo}/></td><td><div className="row-actions d-flex"><button className="action action-edit btn" onClick={() => abrirEdicao(usuario)}><Icone nome="editar" tamanho={15}/> Editar</button><button className={`action btn ${usuario.ativo ? "action-inactivate" : "action-reactivate"}`} disabled={processando} onClick={() => usuario.ativo ? setUsuarioParaInativar(usuario) : void alterarSituacao(usuario, true)}><Icone nome={usuario.ativo ? "lixeira" : "reativar"} tamanho={15}/>{usuario.ativo ? "Inativar" : "Reativar"}</button></div></td></tr>)}</tbody></table></div>
          {carregando && <div className="table-state" role="status">Carregando usuários...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregar()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !filtrados.length && <div className="table-state">Nenhum usuário encontrado.</div>}
        </section>
        <div className="table-footer d-flex align-items-center justify-content-between"><span>Mostrando {inicio} a {fim} de {filtrados.length} usuários</span><div className="pagination d-flex align-items-center"><button className="btn" aria-label="Página anterior" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}><Icone nome="esquerda" tamanho={16}/></button><span className="current-page">{pagina}</span><button className="btn" aria-label="Próxima página" disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)}><Icone nome="direita" tamanho={16}/></button></div></div>
      </main>
    </div>

    {modo && <div className="modal-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget && !processando) setModo(null); }}><div className="modal-card user-modal card border-0" role="dialog" aria-modal="true" aria-labelledby="user-modal-title"><div className="modal-heading"><h2 id="user-modal-title">{modo === "cadastro" ? "Cadastrar Usuário" : "Editar Usuário"}</h2><button className="icon-button btn" aria-label="Fechar" onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div><form className="modal-body" onSubmit={salvar} noValidate><div className="user-form-grid">
      <Campo rotulo="Funcionário" erro={erros.funcionarioId}><select className={`form-select ${erros.funcionarioId ? "is-invalid" : ""}`} value={funcionarioId} disabled={modo === "edicao"} onChange={evento => { setFuncionarioId(evento.target.value); setErros({...erros, funcionarioId: undefined}); }}><option value="">Selecione um funcionário...</option>{modo === "edicao" && selecionado && <option value={selecionado.funcionarioId}>{selecionado.funcionarioNome}</option>}{funcionariosDisponiveis.map(funcionario => <option key={funcionario.id} value={funcionario.id}>{funcionario.nome}</option>)}</select></Campo>
      <Campo rotulo="Perfil" erro={erros.perfilId}><select className={`form-select ${erros.perfilId ? "is-invalid" : ""}`} value={perfilId} onChange={evento => { setPerfilId(evento.target.value); setErros({...erros, perfilId: undefined}); }}><option value="">Selecione um perfil...</option>{perfis.map(perfil => <option key={perfil.id} value={perfil.id}>{perfil.nome}</option>)}</select></Campo>
      <Campo rotulo="E-mail" erro={erros.email}><input className={`form-control ${erros.email ? "is-invalid" : ""}`} type="email" maxLength={150} placeholder="Digite o e-mail..." value={email} onChange={evento => { setEmail(evento.target.value); setErros({...erros, email: undefined}); }}/></Campo>
      {modo === "cadastro" && <Campo rotulo="Senha" erro={erros.senha}><input className={`form-control ${erros.senha ? "is-invalid" : ""}`} type="password" maxLength={72} placeholder="Digite a senha..." value={senha} onChange={evento => { setSenha(evento.target.value); setErros({...erros, senha: undefined}); }}/></Campo>}
      {modo === "cadastro" && <label className="field form-label"><span>Situação <em>*</em></span><select className="form-select" value={ativo ? "ativo" : "inativo"} onChange={evento => setAtivo(evento.target.value === "ativo")}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>}
    </div>{modo === "edicao" && selecionado && <><div className="info-box alert alert-info mb-0"><span className="info-symbol">i</span><span>A situação e a senha são controladas por ações separadas.</span></div><button type="button" className="button password-change-button btn" onClick={() => abrirAlteracaoSenha(selecionado)}><Icone nome="cadeado" tamanho={17}/> Alterar senha</button></>}{erroFormulario && <p className="form-error alert alert-danger mb-0">{erroFormulario}</p>}<div className="modal-footer">{modo === "edicao" && selecionado?.ativo && <button type="button" className="button button-danger btn footer-left" onClick={() => setUsuarioParaInativar(selecionado)}>Inativar Usuário</button>}<button type="button" className="button button-secondary btn" onClick={() => setModo(null)}>Cancelar</button><button type="submit" className="button button-primary btn" disabled={processando}>{processando ? "Salvando..." : "Salvar"}</button></div></form></div></div>}

    {usuarioParaSenha && <div className="modal-overlay alert-layer" onMouseDown={evento => { if (evento.target === evento.currentTarget && !processando) setUsuarioParaSenha(null); }}><div className="modal-card password-modal card border-0" role="dialog" aria-modal="true" aria-labelledby="password-modal-title"><div className="modal-heading"><h2 id="password-modal-title">Alterar senha</h2><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setUsuarioParaSenha(null)}><Icone nome="fechar" tamanho={22}/></button></div><p className="password-user-name">Defina uma nova senha para <strong>{usuarioParaSenha.funcionarioNome}</strong>.</p><form className="modal-body" onSubmit={alterarSenha} noValidate><label className="field form-label"><span>Nova senha <em>*</em></span><input className={`form-control ${erroAlteracaoSenha ? "is-invalid" : ""}`} type="password" minLength={6} maxLength={72} autoFocus placeholder="Digite a nova senha..." value={novaSenha} onChange={evento => { setNovaSenha(evento.target.value); setErroAlteracaoSenha(""); }}/></label><label className="field form-label"><span>Confirmar nova senha <em>*</em></span><input className={`form-control ${erroAlteracaoSenha ? "is-invalid" : ""}`} type="password" minLength={6} maxLength={72} placeholder="Digite novamente a nova senha..." value={confirmacaoSenha} onChange={evento => { setConfirmacaoSenha(evento.target.value); setErroAlteracaoSenha(""); }}/></label>{erroAlteracaoSenha && <p className="form-error alert alert-danger mb-0" role="alert">{erroAlteracaoSenha}</p>}<div className="modal-footer"><button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setUsuarioParaSenha(null)}>Cancelar</button><button type="submit" className="button button-primary btn" disabled={processando}>{processando ? "Alterando..." : "Confirmar alteração"}</button></div></form></div></div>}

    {usuarioParaInativar && <ConfirmacaoInativacao titulo="Inativar usuário?" mensagem={`Tem certeza de que deseja inativar o acesso de “${usuarioParaInativar.funcionarioNome}”? Essa pessoa não poderá mais entrar no sistema.`} processando={processando} onCancelar={() => setUsuarioParaInativar(null)} onConfirmar={() => void alterarSituacao(usuarioParaInativar, false)}/>}
  </>;
}

function Campo({ rotulo, erro, obrigatorio = true, children }: { rotulo: string; erro?: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return <label className="field form-label"><span>{rotulo} {obrigatorio && <em>*</em>}</span>{children}{erro && <span className="invalid-feedback d-block">{erro}</span>}</label>;
}
