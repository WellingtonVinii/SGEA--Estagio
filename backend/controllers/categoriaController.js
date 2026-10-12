import CategoriaModel from "../model/categoriaModel.js";
import Database from "../database/database.js";

export default class CategoriaController {
    #model;
    #banco;

    constructor() {
        this.#model = new CategoriaModel();
        this.#banco = new Database();
    }

    async listar(req, res, next) {
        try {
            const { nome = "", situacao = "todas" } = req.query;
            
            if (typeof nome !== "string" || typeof situacao !== "string" || !["todas", "ativas", "inativas"].includes(situacao)){
                return res.status(400).json({ erro: "Use situacao=todas, ativas ou inativas e um nome válido." });
            }
            res.json(await this.#model.listar(this.#banco, nome.trim(), situacao));
        } 
        catch (erro){
            next(erro); 
        }
    }

    async buscar(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id da categoria inválido." });
            const categoria = await this.#model.buscarPorId(this.#banco, id);
            return categoria ? res.json(categoria) : res.status(404).json({ erro: "Categoria não encontrada." });
        } catch (erro) { next(erro); }
    }

    async cadastrar(req, res, next) {
        try {
            if (typeof req.body?.ativo !== "boolean") {
                return res.status(400).json({ erro: "Ativo deve ser true ou false." });
            }
            const nome = this.#nome(req.body?.nome);
            const categoria = new CategoriaModel(0, nome, req.body.ativo);
            if (!categoria.validar()) {
                return res.status(400).json({ erro: "Nome é obrigatório e deve ter até 100 caracteres." });
            }
            const existente = await this.#model.buscarPorNome(this.#banco, categoria.nome);
            
            if (existente) 
                return this.#duplicada(res, existente);
            const cadastrada = await this.#model.cadastrar(this.#banco, categoria);

            if (!cadastrada) throw new Error("Erro ao inserir categoria no banco de dados.");

            return res.status(201).json(categoria);
        } catch (erro) { await this.#erroNome(erro, req.body?.nome, res, next); }
    }

    async alterar(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            if (!id) 
                return res.status(400).json({ erro: "Id da categoria inválido." });

            if (!req.body || Object.keys(req.body).some(chave => chave !== "nome")){
                return res.status(400).json({ erro: "Somente o nome pode ser alterado nesta rota." });
            }
            const nome = this.#nome(req.body.nome);

            if (!nome) 
                return res.status(400).json({ erro: "Nome é obrigatório e deve ter até 100 caracteres." });

            const atual = await this.#model.buscarPorId(this.#banco, id);

            if (!atual)
                return res.status(404).json({ erro: "Categoria não encontrada." });

            const categoria = new CategoriaModel(id, nome, atual.ativo);

            if (!categoria.validar(true)) {
                return res.status(400).json({ erro: "Parâmetros incorretos." });
            }
            const existente = await this.#model.buscarPorNome(this.#banco, categoria.nome, categoria.id);

            if (existente)
                 return this.#duplicada(res, existente);

            const alterada = await this.#model.atualizar(this.#banco, categoria);

            return alterada ? res.json(categoria) :
                res.status(404).json({ erro: "Categoria não encontrada." });
        } 
        catch (erro){ 
            await this.#erroNome(erro, req.body?.nome, res, next); 
        }
    }

    async inativar(req, res, next) {
        return this.#situacao(req, res, next, false);
    }

    async reativar(req, res, next) {
        return this.#situacao(req, res, next, true);
    }

    async #situacao(req, res, next, ativo) {
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id da categoria inválido." });

            await this.#banco.AbreTransacao();
            const resultado = await this.#model.alterarSituacao(this.#banco, id, ativo);
            if (resultado.tipo === "nao_encontrada") {
                await this.#banco.Rollback();
                return res.status(404).json({ erro: "Categoria não encontrada." });
            }
            if (resultado.tipo === "produtos_ativos") {
                await this.#banco.Rollback();
                return res.status(409).json({ erro: "Inative ou altere a categoria dos produtos ativos antes de inativar esta categoria." });
            }
            await this.#banco.Commit();
            return res.json(resultado.categoria);
        } catch (erro) {
            try {
                await this.#banco.Rollback();
            } catch (rollbackErro) {
                erro.rollbackErro = rollbackErro;
            }
            next(erro);
        }
    }

    #id(valor) {
        return /^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0
            ? Number(valor) : null;
    }

    #nome(valor) {
        if (typeof valor !== "string") return null;
        const nome = valor.trim();
        return nome && nome.length <= 100 ? nome : null;
    }

    #duplicada(res, existente) {
        return res.status(409).json({
            erro: existente.ativo ? "Já existe uma categoria com este nome." :
                "Já existe uma categoria inativa com este nome. Reative o registro existente.",
            categoria: existente
        });
    }

    async #erroNome(erro, nome, res, next) {
        if (erro.code !== "ER_DUP_ENTRY") return next(erro);
        try {
            const nomeNormalizado = typeof nome === "string" ? nome.trim() : "";
            const existente = await this.#model.buscarPorNome(this.#banco, nomeNormalizado);
            return existente ? this.#duplicada(res, existente) : next(erro);
        } catch (buscaErro) { next(buscaErro); }
    }
}
