import bcrypt from "bcryptjs";
import Database from "../database/database.js";
import UsuarioModel from "../model/usuarioModel.js";

export default class UsuarioController {
    #banco;
    #model;

    constructor() {
        this.#banco = new Database();
        this.#model = new UsuarioModel();
    }

    async listar(req, res, next) {
        try {
            return res.json(await this.#model.listar(this.#banco));
        } catch (erro) { next(erro); }
    }

    async cadastrar(req, res, next) {
        let transacaoAberta = false;
        try {
            const dados = this.#dadosCadastro(req.body);
            if (!dados) return res.status(400).json({ erro: "Informe funcionário, e-mail, senha, perfil e situação válidos." });

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            if (!await this.#model.funcionarioAtivoExiste(this.#banco, dados.funcionarioId)) {
                return await this.#responderRollback(res, 400, "O funcionário selecionado não existe ou está inativo.");
            }
            if (!await this.#model.perfilExiste(this.#banco, dados.perfilId)) {
                return await this.#responderRollback(res, 400, "O perfil selecionado não existe.");
            }
            if (await this.#model.buscarPorFuncionarioId(this.#banco, dados.funcionarioId)) {
                return await this.#responderRollback(res, 409, "Este funcionário já possui um usuário associado.");
            }
            if (await this.#model.emailEmUso(this.#banco, dados.email)) {
                return await this.#responderRollback(res, 409, "Já existe um usuário cadastrado com este e-mail.");
            }

            const usuario = new UsuarioModel(0, dados.email, await bcrypt.hash(dados.senha, 12), dados.ativo, dados.funcionarioId, "", true, dados.perfilId, "");
            if (!await this.#model.cadastrar(this.#banco, usuario)) throw new Error("Erro ao cadastrar usuário.");
            const cadastrado = await this.#model.buscarPorId(this.#banco, usuario.id);
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.status(201).json(cadastrado);
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    async alterar(req, res, next) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            const dados = this.#dadosAlteracao(req.body);
            if (!id || !dados) return res.status(400).json({ erro: "Dados do usuário inválidos." });

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const atual = await this.#model.buscarPorId(this.#banco, id);
            if (!atual) return await this.#responderRollback(res, 404, "Usuário não encontrado.");
            if (!await this.#model.perfilExiste(this.#banco, dados.perfilId)) {
                return await this.#responderRollback(res, 400, "O perfil selecionado não existe.");
            }
            if (await this.#model.emailEmUso(this.#banco, dados.email, id)) {
                return await this.#responderRollback(res, 409, "Já existe outro usuário cadastrado com este e-mail.");
            }

            atual.email = dados.email;
            atual.perfilId = dados.perfilId;
            if (!await this.#model.atualizar(this.#banco, atual)) throw new Error("Erro ao atualizar usuário.");
            const atualizado = await this.#model.buscarPorId(this.#banco, id);
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(atualizado);
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    async inativar(req, res, next) { return this.#situacao(req, res, next, false); }
    async reativar(req, res, next) { return this.#situacao(req, res, next, true); }

    async alterarSenha(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            const chaves = Object.keys(req.body ?? {});
            const senha = req.body?.senha;
            const confirmacaoSenha = req.body?.confirmacaoSenha;
            if (!id || chaves.length !== 2 || !chaves.includes("senha") || !chaves.includes("confirmacaoSenha") ||
                this.#senha(senha, true) === null || senha !== confirmacaoSenha) {
                return res.status(400).json({ erro: "Informe a nova senha duas vezes, com valores iguais e pelo menos 6 caracteres." });
            }

            const usuario = await this.#model.buscarPorId(this.#banco, id);
            if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
            const senhaCriptografada = await bcrypt.hash(senha, 12);
            if (!await this.#model.atualizarSenha(this.#banco, id, senhaCriptografada)) {
                return res.status(404).json({ erro: "Usuário não encontrado." });
            }
            return res.json(usuario);
        } catch (erro) { next(erro); }
    }

    async #situacao(req, res, next, ativo) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do usuário inválido." });
            if (!ativo && id === req.usuario?.id) return res.status(409).json({ erro: "Você não pode inativar o próprio usuário enquanto está conectado." });

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const resultado = await this.#model.alterarSituacao(this.#banco, id, ativo);
            if (resultado.tipo === "nao_encontrado") return await this.#responderRollback(res, 404, "Usuário não encontrado.");
            if (resultado.tipo === "funcionario_inativo") return await this.#responderRollback(res, 409, "Reative o funcionário antes de reativar seu usuário.");
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(resultado.usuario);
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    #dadosCadastro(body) {
        const permitidas = ["funcionarioId", "email", "senha", "perfilId", "ativo"];
        if (!body || Object.keys(body).some(chave => !permitidas.includes(chave)) || typeof body.ativo !== "boolean") return null;
        const dados = { funcionarioId: this.#numero(body.funcionarioId), email: this.#email(body.email), senha: this.#senha(body.senha, true), perfilId: this.#numero(body.perfilId), ativo: body.ativo };
        return Object.values(dados).some(valor => valor === null) ? null : dados;
    }

    #dadosAlteracao(body) {
        const permitidas = ["email", "perfilId"];
        const chaves = Object.keys(body ?? {});
        if (!chaves.length || chaves.some(chave => !permitidas.includes(chave)) || !("email" in body) || !("perfilId" in body)) return null;
        const dados = { email: this.#email(body.email), perfilId: this.#numero(body.perfilId) };
        return Object.values(dados).some(valor => valor === null) ? null : dados;
    }

    #id(valor) { return typeof valor === "string" && /^\d+$/.test(valor) ? this.#numero(Number(valor)) : null; }
    #numero(valor) { return Number.isSafeInteger(valor) && valor > 0 ? valor : null; }
    #email(valor) { if (typeof valor !== "string") return null; const email = valor.trim().toLowerCase(); return email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
    #senha(valor, obrigatoria) { if (typeof valor !== "string") return null; if (!valor && !obrigatoria) return ""; return valor.length >= 6 && valor.length <= 72 ? valor : null; }

    async #responderRollback(res, status, mensagem) { await this.#banco.Rollback(); return res.status(status).json({ erro: mensagem }); }
    async #tratarErro(erro, transacaoAberta, res, next) {
        if (transacaoAberta) try { await this.#banco.Rollback(); } catch (rollbackErro) { erro.rollbackErro = rollbackErro; }
        if (erro.code === "ER_DUP_ENTRY") return res.status(409).json({ erro: "Já existe um usuário com este e-mail ou funcionário." });
        next(erro);
    }
}
