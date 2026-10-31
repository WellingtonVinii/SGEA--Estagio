"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import Icone from "../components/Icone";

type RespostaLogin = {
  token?: string;
  usuario?: { funcionarioNome?: string; perfil?: string };
  erro?: string;
};

function tokenAindaValido(token: string) {
  try {
    const base64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!base64) return false;
    const payload = JSON.parse(window.atob(base64)) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function paginaInicial(perfil?: string) {
  const normalizado = String(perfil ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ["adm", "administrador", "adiministrador"].includes(normalizado) ? "/inicio" : "/produtos";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("sgea_token");
    if (token && tokenAindaValido(token)) {
      try {
        const usuario = JSON.parse(window.localStorage.getItem("sgea_usuario") || "{}") as { perfil?: string };
        router.replace(paginaInicial(usuario.perfil));
      } catch { router.replace("/produtos"); }
    }
  }, [router]);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");

    if (!email.trim() || !senha) {
      setErro("Preencha o e-mail e a senha.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/autenticacao/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha })
      });
      const dados = await resposta.json().catch(() => ({})) as RespostaLogin;
      if (!resposta.ok || !dados.token) {
        setErro(dados.erro || "Não foi possível entrar no sistema.");
        return;
      }

      window.localStorage.setItem("sgea_token", dados.token);
      window.localStorage.setItem("sgea_usuario", JSON.stringify(dados.usuario ?? {}));
      router.replace(paginaInicial(dados.usuario?.perfil));
    } catch {
      setErro("Não foi possível conectar ao servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return <main className="login-page">
    <section className="login-card" aria-label="Acesso ao Sistema de Estoque">
      <div className="login-brand">
        <span className="login-brand-icon"><Icone nome="livro" tamanho={48}/></span>
        <strong>Escola Osira</strong>
        <span>Sistema de Estoque</span>
      </div>

      <form onSubmit={entrar} noValidate>
        <div className={`login-field ${erro && !email.trim() ? "login-field-invalid" : ""}`}>
          <label htmlFor="email" aria-label="E-mail"><Icone nome="email" tamanho={18}/></label>
          <input id="email" type="email"
            value={email} onChange={evento => setEmail(evento.target.value)} placeholder="E-mail"
            autoComplete="username" autoFocus disabled={enviando}/>
        </div>
        <div className={`login-field ${erro && !senha ? "login-field-invalid" : ""}`}>
          <label htmlFor="senha" aria-label="Senha"><Icone nome="cadeado" tamanho={18}/></label>
          <input id="senha" type="password"
            value={senha} onChange={evento => setSenha(evento.target.value)} placeholder="Senha"
            autoComplete="current-password" disabled={enviando}/>
        </div>

        {erro && <div className="login-error alert alert-danger py-2" role="alert">{erro}</div>}

        <button className="login-button" type="submit" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </section>
  </main>;
}
