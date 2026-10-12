import ProdutoModel from "../model/produtoModel.js";
import LoteModel from "../model/loteModel.js";
import Database from "../database/database.js";

export default class ProdutoController {
    #model;
    #banco;

    constructor() {
        this.#model = new ProdutoModel();
        this.#banco = new Database();
    }

    async listar(req, res, next) {
        try {
            const { nome = "", situacao = "todos" } = req.query;
            if (typeof nome !== "string" || typeof situacao !== "string" ||
                !["todos", "ativos", "inativos"].includes(situacao)) {
                return res.status(400).json({
                    erro: "Use situacao=todos, ativos ou inativos e um nome válido."
                });
            }
            return res.json(await this.#model.listar(this.#banco, nome.trim(), situacao));
        } catch (erro) {
            next(erro);
        }
    }

    async buscar(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do produto inválido." });

            const produto = await this.#model.buscarPorId(this.#banco, id);
            return produto
                ? res.json(produto)
                : res.status(404).json({ erro: "Produto não encontrado." });
        } catch (erro) {
            next(erro);
        }
    }

    async cadastrar(req, res, next) {
        let transacaoAberta = false;
        try {
            if (req.body?.dataValidade && !this.#codigoLote(req.body?.codigoLote)) {
                return res.status(400).json({
                    erro: "Informe o código do lote quando houver data de validade."
                });
            }
            const dados = this.#dadosCadastro(req.body);
            if (!dados) {
                return res.status(400).json({
                    erro: "Informe nome, categoriaId, quantidadeLote inteira e positiva, código do lote com até 50 caracteres e uma data válida no formato AAAA-MM-DD, quando aplicável."
                });
            }

            const produto = new ProdutoModel(0, dados.nome, true, dados.categoriaId);
            const lote = new LoteModel(
                0,
                dados.codigoLote,
                dados.quantidadeLote,
                dados.dataValidade,
                0
            );
            if (!produto.validar() || !lote.validar()) {
                return res.status(400).json({ erro: "Dados do produto ou do lote inválidos." });
            }

            await this.#banco.AbreTransacao();
            transacaoAberta = true;

            const existente = await this.#model.buscarPorNome(this.#banco, produto.nome);
            if (existente) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return this.#duplicado(res, existente);
            }

            const categoria = await this.#model.buscarCategoriaAtiva(this.#banco, produto.categoriaId);
            if (!categoria) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(409).json({
                    erro: "A categoria informada não existe ou está inativa."
                });
            }

            produto.categoriaNome = categoria.nome;
            if (!await this.#model.cadastrar(this.#banco, produto)) {
                throw new Error("Erro ao inserir produto no banco de dados.");
            }

            lote.produtoId = produto.id;
            if (!await this.#model.cadastrarLote(this.#banco, lote)) {
                throw new Error("Erro ao inserir o lote inicial no banco de dados.");
            }

            produto.quantidadeTotal = lote.quantidadeDisponivel;
            produto.lotes = [lote];
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.status(201).json(produto);
        } catch (erro) {
            await this.#tratarErro(erro, transacaoAberta, req.body?.nome, res, next);
        }
    }

    async alterar(req, res, next) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do produto inválido." });

            const chaves = Object.keys(req.body ?? {});
            if (!chaves.length || chaves.some(chave => !["nome", "categoriaId"].includes(chave))) {
                return res.status(400).json({
                    erro: "Informe somente nome e/ou categoriaId para alterar o produto."
                });
            }

            const nome = "nome" in req.body ? this.#nome(req.body.nome) : null;
            const categoriaId = "categoriaId" in req.body ? this.#idCorpo(req.body.categoriaId) : null;
            if (("nome" in req.body && !nome) || ("categoriaId" in req.body && !categoriaId)) {
                return res.status(400).json({ erro: "Nome ou categoriaId inválido." });
            }

            await this.#banco.AbreTransacao();
            transacaoAberta = true;

            const atual = await this.#model.buscarPorId(this.#banco, id);
            if (!atual) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(404).json({ erro: "Produto não encontrado." });
            }

            const produto = new ProdutoModel(
                id,
                nome ?? atual.nome,
                atual.ativo,
                categoriaId ?? atual.categoriaId,
                atual.categoriaNome,
                atual.quantidadeTotal,
                atual.lotes
            );

            const existente = await this.#model.buscarPorNome(this.#banco, produto.nome, produto.id);
            if (existente) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return this.#duplicado(res, existente);
            }

            if (categoriaId !== null) {
                const categoria = await this.#model.buscarCategoriaAtiva(this.#banco, categoriaId);
                if (!categoria) {
                    await this.#banco.Rollback();
                    transacaoAberta = false;
                    return res.status(409).json({
                        erro: "A categoria informada não existe ou está inativa."
                    });
                }
                produto.categoriaNome = categoria.nome;
            }

            const alterado = await this.#model.atualizar(this.#banco, produto);
            if (!alterado) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(404).json({ erro: "Produto não encontrado." });
            }

            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(produto);
        } catch (erro) {
            await this.#tratarErro(erro, transacaoAberta, req.body?.nome, res, next);
        }
    }

    async inativar(req, res, next) {
        return this.#situacao(req, res, next, false);
    }

    async reativar(req, res, next) {
        return this.#situacao(req, res, next, true);
    }

    async #situacao(req, res, next, ativo) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do produto inválido." });

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const resultado = await this.#model.alterarSituacao(this.#banco, id, ativo);

            if (resultado.tipo === "nao_encontrado") {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(404).json({ erro: "Produto não encontrado." });
            }
            if (resultado.tipo === "estoque_disponivel") {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(409).json({
                    erro: "O produto só pode ser inativado quando a quantidade total for zero.",
                    quantidadeTotal: resultado.quantidadeTotal
                });
            }
            if (resultado.tipo === "categoria_inativa") {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(409).json({
                    erro: "Altere o produto para uma categoria ativa antes de reativá-lo."
                });
            }

            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(resultado.produto);
        } catch (erro) {
            if (transacaoAberta) {
                try {
                    await this.#banco.Rollback();
                } catch (rollbackErro) {
                    erro.rollbackErro = rollbackErro;
                }
            }
            next(erro);
        }
    }

    #dadosCadastro(body) {
        const chavesPermitidas = ["nome", "categoriaId", "codigoLote", "quantidadeLote", "dataValidade"];
        if (!body || Object.keys(body).some(chave => !chavesPermitidas.includes(chave))) return null;

        const nome = this.#nome(body.nome);
        const categoriaId = this.#idCorpo(body.categoriaId);
        const quantidadeLote = this.#quantidade(body.quantidadeLote);
        const codigoLote = body.codigoLote === undefined || body.codigoLote === null || body.codigoLote === ""
            ? "1"
            : this.#codigoLote(body.codigoLote);
        const dataValidade = this.#data(body.dataValidade);

        if (!nome || !categoriaId || quantidadeLote === null || !codigoLote || dataValidade === undefined) {
            return null;
        }
        return { nome, categoriaId, codigoLote, quantidadeLote, dataValidade };
    }

    #id(valor) {
        return typeof valor === "string" && /^\d+$/.test(valor) &&
            Number.isSafeInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
    }

    #idCorpo(valor) {
        return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
    }

    #nome(valor) {
        if (typeof valor !== "string") return null;
        const nome = valor.trim();
        return nome && nome.length <= 150 ? nome : null;
    }

    #codigoLote(valor) {
        if (typeof valor !== "string") return null;
        const codigo = valor.trim();
        return codigo && codigo.length <= 50 ? codigo : null;
    }

    #quantidade(valor) {
        return Number.isSafeInteger(valor) && valor > 0 ? valor : null;
    }

    #data(valor) {
        if (valor === undefined || valor === null || valor === "") return null;
        if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;

        const [ano, mes, dia] = valor.split("-").map(Number);
        if (ano < 1000) return undefined;
        const data = new Date(Date.UTC(ano, mes - 1, dia));
        return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 &&
            data.getUTCDate() === dia ? valor : undefined;
    }

    #duplicado(res, existente) {
        return res.status(409).json({
            erro: existente.ativo
                ? "Já existe um produto com este nome."
                : "Já existe um produto inativo com este nome. Reative o registro existente.",
            produto: existente
        });
    }

    async #tratarErro(erro, transacaoAberta, nome, res, next) {
        if (transacaoAberta) {
            try {
                await this.#banco.Rollback();
            } catch (rollbackErro) {
                erro.rollbackErro = rollbackErro;
            }
        }

        if (erro.code !== "ER_DUP_ENTRY") return next(erro);
        try {
            const nomeNormalizado = this.#nome(nome);
            const existente = nomeNormalizado
                ? await this.#model.buscarPorNome(this.#banco, nomeNormalizado)
                : null;
            return existente ? this.#duplicado(res, existente) : next(erro);
        } catch (buscaErro) {
            next(buscaErro);
        }
    }
}
