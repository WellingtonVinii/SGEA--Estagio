"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icone from "../../components/Icone";
import TourGuia, { campoTour, elementoTour, avancarApos, voltarApos, type PassoTour } from "../../components/TourGuia";
import UsuarioLogado from "../../components/UsuarioLogado";

type Funcionario = {
  id: number;
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
  email: string;
  ativo: boolean;
  possuiUsuario: boolean;
};
type Situacao = "todos" | "ativos" | "inativos";
type Modo = "cadastro" | "edicao" | "detalhes" | null;
type Campo = "nome" | "cpf" | "cargo" | "telefone" | "email";
type ErrosCampos = Partial<Record<Campo, string>>;
type Alerta = { titulo: string; mensagem: string };

class ApiError extends Error {
  constructor(public status: number, public dados: { erro?: string; funcionario?: Funcionario }) {
    super(dados.erro || "Não foi possível concluir a operação.");
  }
}

async function requisicao<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem("sgea_token");
  const resposta = await fetch(`/api/funcionarios${caminho}`, {
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

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor: string) {
  const digitos = somenteDigitos(valor).slice(0, 11);
  return digitos
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarTelefone(valor: string) {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos ? `(${digitos}` : "";
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function cpfValido(valor: string) {
  const cpf = somenteDigitos(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    for (let indice = 0; indice < tamanho; indice++) soma += Number(cpf[indice]) * (tamanho + 1 - indice);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

function mensagemErro(erro: unknown) {
  return erro instanceof ApiError && erro.status < 500
    ? erro.message
    : "Não foi possível conectar ao backend. Verifique se a API está em execução na porta 5001.";
}

export default function FuncionariosPage() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [nomeFiltro, setNomeFiltro] = useState("");
  const [nomeConsulta, setNomeConsulta] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("todos");
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [modo, setModo] = useState<Modo>(null);
  const [selecionado, setSelecionado] = useState<Funcionario | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [errosCampos, setErrosCampos] = useState<ErrosCampos>({});
  const [erroFormulario, setErroFormulario] = useState("");
  const [processando, setProcessando] = useState(false);
  const [alerta, setAlerta] = useState<Alerta | null>(null);
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
      const parametros = new URLSearchParams({ nome: nomeConsulta, cargo: cargoFiltro, situacao });
      const dados = await requisicao<Funcionario[]>(`?${parametros}`);
      if (numeroConsulta === consultaAtual.current) {
        setFuncionarios(dados);
        setPagina(1);
      }
    } catch {
      if (numeroConsulta === consultaAtual.current) {
        setFuncionarios([]);
        setPagina(1);
      }
    } finally {
      if (numeroConsulta === consultaAtual.current) setCarregando(false);
    }
  }, [nomeConsulta, cargoFiltro, situacao]);

  const carregarCargos = useCallback(async () => {
    try {
      setCargos(await requisicao<string[]>("/cargos"));
    } catch (erro) {
      setErroLista(mensagemErro(erro));
    }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregar]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void carregarCargos(), 0);
    return () => window.clearTimeout(temporizador);
  }, [carregarCargos]);

  useEffect(() => {
    if (!modo && !alerta) return;
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || processando) return;
      if (alerta) setAlerta(null);
      else setModo(null);
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [modo, alerta, processando]);

  const limparErro = (campo: Campo) => setErrosCampos(erros => ({ ...erros, [campo]: undefined }));

  const limparFormulario = () => {
    setNome("");
    setCpf("");
    setCargo("");
    setTelefone("");
    setEmail("");
    setAtivo(true);
    setErrosCampos({});
    setErroFormulario("");
  };

  const abrirCadastro = () => {
    setSelecionado(null);
    limparFormulario();
    setModo("cadastro");
  };

  const abrirEdicao = (funcionario: Funcionario) => {
    setSelecionado(funcionario);
    setNome(funcionario.nome);
    setCpf(formatarCpf(funcionario.cpf));
    setCargo(funcionario.cargo);
    setTelefone(formatarTelefone(funcionario.telefone));
    setEmail(funcionario.email);
    setAtivo(funcionario.ativo);
    setErrosCampos({});
    setErroFormulario("");
    setModo("edicao");
  };

  const abrirDetalhes = async (funcionario: Funcionario) => {
    try {
      setSelecionado(await requisicao<Funcionario>(`/${funcionario.id}`));
      setModo("detalhes");
    } catch (erro) {
      setAlerta({ titulo: "Não foi possível consultar o funcionário", mensagem: mensagemErro(erro) });
    }
  };

  const validar = () => {
    const erros: ErrosCampos = {};
    if (!nome.trim()) erros.nome = "Preencha o nome completo.";
    else if (nome.trim().length > 150) erros.nome = "O nome deve ter no máximo 150 caracteres.";
    if (!cpfValido(cpf)) erros.cpf = "Informe um CPF válido.";
    if (!cargo.trim()) erros.cargo = "Preencha o cargo ou função.";
    else if (cargo.trim().length > 100) erros.cargo = "O cargo deve ter no máximo 100 caracteres.";
    if (!/^\d{10,11}$/.test(somenteDigitos(telefone))) erros.telefone = "Informe um telefone com DDD.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 150) erros.email = "Informe um e-mail válido.";
    setErrosCampos(erros);
    return Object.keys(erros).length === 0;
  };

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!validar()) return;

    setProcessando(true);
    setErroFormulario("");
    try {
      const dados = {
        nome: nome.trim(),
        cpf,
        cargo: cargo.trim(),
        telefone,
        email: email.trim(),
      };
      if (modo === "cadastro") {
        await requisicao<Funcionario>("", { method: "POST", body: JSON.stringify(dados) });
      } else if (selecionado) {
        await requisicao<Funcionario>(`/${selecionado.id}`, { method: "PATCH", body: JSON.stringify(dados) });
        if (selecionado.ativo !== ativo) {
          await requisicao<Funcionario>(`/${selecionado.id}/${ativo ? "reativar" : "inativar"}`, { method: "PATCH" });
        }
      }
      setModo(null);
      await Promise.all([carregar(), carregarCargos()]);
    } catch (erro) {
      if (erro instanceof ApiError && erro.status === 409 && erro.dados.funcionario) {
        setAlerta({
          titulo: "Funcionário já cadastrado",
          mensagem: erro.message,
        });
      } else if (erro instanceof ApiError && erro.status === 400) {
        setErroFormulario(erro.message);
      } else {
        setAlerta({ titulo: "Não foi possível salvar o funcionário", mensagem: mensagemErro(erro) });
      }
    } finally {
      setProcessando(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(funcionarios.length / 5));
  const itens = funcionarios.slice((pagina - 1) * 5, pagina * 5);
  const inicio = funcionarios.length ? (pagina - 1) * 5 + 1 : 0;
  const fim = Math.min(pagina * 5, funcionarios.length);

  const passosTour: PassoTour[] = [
    { popover: { title: "Gerenciar Funcionários", description: "Aqui ficam os funcionários da escola. Eles podem ser responsáveis por movimentações, destinatários de saídas, solicitantes de ajustes e usuários do sistema." } },
    { element: campoTour("Nome do funcionário", ".filter-panel"), popover: { title: "Pesquisar pelo nome", description: "Digite parte do nome para filtrar a lista." } },
    { element: campoTour("Cargo", ".filter-panel"), popover: { title: "Filtrar por cargo", description: "Mostra apenas os funcionários do cargo selecionado." } },
    { element: campoTour("Situação", ".filter-panel"), popover: { title: "Filtrar por situação", description: "Escolha entre funcionários ativos, inativos ou todos." } },
    { element: ".table-panel", popover: { title: "Lista de funcionários", description: "Mostra nome, CPF, cargo, telefone, e-mail e situação de cada funcionário." } },
    { element: ".table-panel tbody tr:first-child .name-link", popover: { title: "Ver detalhes", description: "Clique no nome para ver todos os dados do funcionário." } },
    { element: ".table-panel tbody tr:first-child .action-edit", popover: { title: "Editar", description: "Altera os dados do funcionário, inclusive a situação (ativo ou inativo)." } },
    { element: ".table-footer", popover: { title: "Paginação", description: "Use as setas para navegar entre as páginas da lista." } },
    { element: ".filter-panel .new-button", popover: { title: "Cadastrar funcionário", description: "Clique aqui para cadastrar um novo funcionário. Clique em Próximo para conhecer o formulário.", onNextClick: avancarApos(abrirCadastro) } },
    { element: elementoTour(".modal-card"), popover: { title: "Formulário de cadastro", description: "Preencha os dados do funcionário. Todos os campos marcados com * são obrigatórios.", onPrevClick: voltarApos(() => setModo(null)) } },
    { element: campoTour("Nome completo"), popover: { title: "Nome completo *", description: "Informe o nome completo do funcionário." } },
    { element: campoTour("CPF"), popover: { title: "CPF *", description: "Digite apenas os números; a máscara é aplicada automaticamente. O CPF não pode se repetir." } },
    { element: campoTour("Cargo"), popover: { title: "Cargo *", description: "Digite o cargo ou escolha um dos cargos já cadastrados." } },
    { element: campoTour("Telefone"), popover: { title: "Telefone *", description: "Informe o telefone com DDD." } },
    { element: campoTour("E-mail"), popover: { title: "E-mail *", description: "Informe um e-mail válido para contato." } },
    { element: campoTour("Situação"), popover: { title: "Situação", description: "Funcionários inativos não aparecem nas listas de seleção das outras telas." } },
    { element: elementoTour(".modal-card button[type='submit']"), popover: { title: "Salvar", description: "Clique em Salvar para cadastrar o funcionário. Use Cancelar para fechar sem salvar." } },
  ];

  return <>
    <div className="content-shell">
      <header className="topbar d-flex align-items-center justify-content-between">
        <label className="top-search d-flex align-items-center"><Icone nome="busca" tamanho={17}/><input className="form-control" aria-label="Buscar funcionários no sistema" placeholder="Buscar no sistema..." value={nomeFiltro} onChange={evento => setNomeFiltro(evento.target.value)}/></label>
        <UsuarioLogado />
      </header>

      <main className="main-content employee-content">
        <div className="breadcrumb d-flex align-items-center">Início <Icone nome="direita" tamanho={12}/> <strong>Funcionários</strong></div>
        <div className="title-block title-with-help"><div><h1>Gerenciar Funcionários</h1><p>Cadastre, consulte, edite, inative ou reative os funcionários da escola.</p></div><TourGuia passos={passosTour} aoFinalizar={() => setModo(atual => atual === "cadastro" ? null : atual)}/></div>

        <section className="filter-panel employee-filters d-flex align-items-end" aria-label="Filtros de funcionários">
          <label className="field form-label"><span>Nome do funcionário</span><input className="form-control" placeholder="Digite o nome do funcionário..." value={nomeFiltro} onChange={evento => setNomeFiltro(evento.target.value)}/></label>
          <label className="field form-label"><span>Cargo</span><select className="form-select" value={cargoFiltro} onChange={evento => setCargoFiltro(evento.target.value)}><option value="">Todos</option>{cargos.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field form-label"><span>Situação</span><select className="form-select" value={situacao} onChange={evento => setSituacao(evento.target.value as Situacao)}><option value="todos">Todas</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select></label>
          <button className="button button-primary btn new-button" onClick={abrirCadastro}><Icone nome="mais" tamanho={18}/> Novo Funcionário</button>
        </section>

        <section className="table-panel employee-table" aria-label="Lista de funcionários">
          <div className="table-scroll table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Nome</th><th>CPF</th><th>Cargo</th><th>Telefone</th><th>E-mail</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{!carregando && !erroLista && itens.map(funcionario => <tr key={funcionario.id}><td><button className="name-link" onClick={() => void abrirDetalhes(funcionario)}>{funcionario.nome}</button></td><td>{formatarCpf(funcionario.cpf)}</td><td>{funcionario.cargo}</td><td>{formatarTelefone(funcionario.telefone)}</td><td>{funcionario.email}</td><td><Badge ativo={funcionario.ativo}/></td><td><div className="row-actions d-flex"><button className="action action-edit btn" onClick={() => abrirEdicao(funcionario)}><Icone nome="editar" tamanho={15}/> Editar</button></div></td></tr>)}</tbody></table></div>
          {carregando && <div className="table-state" role="status">Carregando funcionários...</div>}
          {erroLista && <div className="table-state error-state" role="alert">{erroLista}<button className="button button-secondary btn" onClick={() => void carregar()}>Tentar novamente</button></div>}
          {!carregando && !erroLista && !funcionarios.length && <div className="table-state">Nenhum funcionário encontrado para os filtros informados.</div>}
        </section>

        <div className="table-footer d-flex align-items-center justify-content-between"><span>Mostrando {inicio} a {fim} de {funcionarios.length} funcionários</span><div className="pagination d-flex align-items-center"><button className="btn" aria-label="Página anterior" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}><Icone nome="esquerda" tamanho={16}/></button><span className="current-page" aria-label={`Página ${pagina} de ${totalPaginas}`}>{pagina}</span><button className="btn" aria-label="Próxima página" disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)}><Icone nome="direita" tamanho={16}/></button></div></div>
      </main>
    </div>

    {modo && <div className="modal-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget && !processando) setModo(null); }}><div className="modal-card employee-modal card border-0" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title"><div className="modal-heading d-flex align-items-center justify-content-between"><h2 id="employee-modal-title">{modo === "cadastro" ? "Cadastrar Funcionário" : modo === "edicao" ? "Editar Funcionário" : "Detalhes do Funcionário"}</h2><button className="icon-button btn" aria-label="Fechar" disabled={processando} onClick={() => setModo(null)}><Icone nome="fechar" tamanho={22}/></button></div>
      {modo === "detalhes" && selecionado ? <div className="modal-body"><div className="employee-form-grid"><div className="field"><span>Nome completo</span><div className="readonly-field form-control">{selecionado.nome}</div></div><div className="field"><span>CPF</span><div className="readonly-field form-control">{formatarCpf(selecionado.cpf)}</div></div><div className="field"><span>Cargo</span><div className="readonly-field form-control">{selecionado.cargo}</div></div><div className="field"><span>Telefone</span><div className="readonly-field form-control">{formatarTelefone(selecionado.telefone)}</div></div><div className="field"><span>E-mail</span><div className="readonly-field form-control">{selecionado.email}</div></div><div className="field"><span>Situação</span><div className="employee-status-field"><Badge ativo={selecionado.ativo}/></div></div></div><div className="modal-footer d-flex align-items-center justify-content-end"><button className="button button-secondary btn" onClick={() => setModo(null)}>Fechar</button></div></div> : <form className="modal-body" onSubmit={salvar} noValidate><div className="employee-form-grid">
        <CampoFormulario rotulo="Nome completo" erro={errosCampos.nome}><input className={`form-control ${errosCampos.nome ? "is-invalid" : ""}`} autoFocus maxLength={150} placeholder="Digite o nome completo..." value={nome} onChange={evento => { setNome(evento.target.value); limparErro("nome"); }}/></CampoFormulario>
        <CampoFormulario rotulo="CPF" erro={errosCampos.cpf}><input className={`form-control ${errosCampos.cpf ? "is-invalid" : ""}`} inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={evento => { setCpf(formatarCpf(evento.target.value)); limparErro("cpf"); }}/></CampoFormulario>
        <CampoFormulario rotulo="Cargo" erro={errosCampos.cargo}><input className={`form-control ${errosCampos.cargo ? "is-invalid" : ""}`} list="lista-cargos" maxLength={100} placeholder="Digite ou selecione um cargo..." value={cargo} onChange={evento => { setCargo(evento.target.value); limparErro("cargo"); }}/><datalist id="lista-cargos">{cargos.map(item => <option key={item} value={item}/>)}</datalist></CampoFormulario>
        <CampoFormulario rotulo="Telefone" erro={errosCampos.telefone}><input className={`form-control ${errosCampos.telefone ? "is-invalid" : ""}`} inputMode="tel" placeholder="(00) 00000-0000" value={telefone} onChange={evento => { setTelefone(formatarTelefone(evento.target.value)); limparErro("telefone"); }}/></CampoFormulario>
        <CampoFormulario rotulo="E-mail" erro={errosCampos.email}><input className={`form-control ${errosCampos.email ? "is-invalid" : ""}`} type="email" maxLength={150} placeholder="Digite o e-mail..." value={email} onChange={evento => { setEmail(evento.target.value); limparErro("email"); }}/></CampoFormulario>
        {modo === "edicao" && <label className="field form-label"><span>Situação <em>*</em></span><select className="form-select" value={ativo ? "ativo" : "inativo"} onChange={evento => setAtivo(evento.target.value === "ativo")}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>}
      </div>{erroFormulario && <p className="form-error alert alert-danger mb-0" role="alert">{erroFormulario}</p>}<div className="modal-footer d-flex align-items-center justify-content-end"><button type="button" className="button button-secondary btn" disabled={processando} onClick={() => setModo(null)}>Cancelar</button><button type="submit" className="button button-primary btn" disabled={processando}>{processando ? "Salvando..." : "Salvar"}</button></div></form>}
    </div></div>}

    {alerta && <div className="modal-overlay alert-layer" onMouseDown={evento => { if (evento.target === evento.currentTarget) setAlerta(null); }}><div className="modal-card card border-0 alert-modal" role="alertdialog" aria-modal="true" aria-labelledby="employee-alert-title"><button className="icon-button btn alert-close" aria-label="Fechar aviso" onClick={() => setAlerta(null)}><Icone nome="fechar" tamanho={20}/></button><span className="warning-symbol">!</span><h2 id="employee-alert-title">{alerta.titulo}</h2><p>{alerta.mensagem}</p><div className="alert-actions d-flex justify-content-end"><button className="button button-primary btn" onClick={() => setAlerta(null)}>OK</button></div></div></div>}
  </>;
}

function CampoFormulario({ rotulo, erro, children }: { rotulo: string; erro?: string; children: React.ReactNode }) {
  return <label className="field form-label"><span>{rotulo} <em>*</em></span>{children}{erro && <span className="invalid-feedback d-block" role="alert">{erro}</span>}</label>;
}
