import Database from "../database/database.js";
import PedidoCompraModel from "../model/pedidoCompraModel.js";

export default class PedidoCompraController {
    #banco;
    #model;

    constructor() {
        this.#banco = new Database();
        this.#model = new PedidoCompraModel();
    }

    async listar(req, res, next) {
        try {
            const situacao = this.#situacaoFiltro(req.query?.situacao);
            const busca = req.query?.busca === undefined
                ? ""
                : typeof req.query.busca === "string" ? req.query.busca.trim() : null;
            if (!situacao || busca === null || busca.length > 150) {
                return res.status(400).json({ erro: "Informe uma busca válida e situação Todas, Pendente, Parcialmente Recebido, Recebido ou Cancelado." });
            }
            return res.json(await this.#model.listar(this.#banco, situacao, busca));
        } catch (erro) { next(erro); }
    }

    async buscar(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do pedido inválido." });
            const pedido = await this.#model.buscarPorId(this.#banco, id);
            return pedido ? res.json(pedido) : res.status(404).json({ erro: "Pedido de compra não encontrado." });
        } catch (erro) { next(erro); }
    }

    async cadastrar(req, res, next) {
        let transacaoAberta = false;
        try {
            const dados = this.#dadosPedido(req.body, true);
            const funcionarioId = this.#numero(req.usuario?.funcionarioId);
            if (!dados || !funcionarioId) return res.status(400).json({ erro: "Dados do pedido de compra inválidos." });

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const erroProdutos = await this.#validarProdutos(dados.itens);
            if (erroProdutos) return await this.#rollbackResposta(res, 400, erroProdutos);

            const pedido = new PedidoCompraModel(
                0, dados.dataSolicitacao, "Pendente", dados.observacao, funcionarioId, "", dados.itens
            );
            if (!await this.#model.cadastrar(this.#banco, pedido)) throw new Error("Erro ao cadastrar pedido de compra.");
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.status(201).json(await this.#model.buscarPorId(this.#banco, pedido.id));
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    async alterar(req, res, next) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            const dados = this.#dadosPedido(req.body, false);
            if (!id || !dados) return res.status(400).json({ erro: "Dados do pedido de compra inválidos." });

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const atual = await this.#model.buscarPorId(this.#banco, id, true);
            if (!atual) return await this.#rollbackResposta(res, 404, "Pedido de compra não encontrado.");
            if (atual.situacao !== "Pendente") {
                return await this.#rollbackResposta(res, 409, "Somente pedidos pendentes podem ser alterados.");
            }
            const erroProdutos = await this.#validarProdutos(dados.itens);
            if (erroProdutos) return await this.#rollbackResposta(res, 400, erroProdutos);

            atual.dataSolicitacao = dados.dataSolicitacao;
            atual.observacao = dados.observacao;
            atual.itens = dados.itens;
            if (!await this.#model.atualizar(this.#banco, atual)) {
                return await this.#rollbackResposta(res, 409, "O pedido deixou de estar pendente e não pode ser alterado.");
            }
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(await this.#model.buscarPorId(this.#banco, id));
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    async alterarSituacao(req, res, next) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            const chaves = Object.keys(req.body ?? {});
            const situacao = req.body?.situacao;
            if (!id || chaves.length !== 1 || chaves[0] !== "situacao" || situacao !== "Cancelado") {
                return res.status(400).json({ erro: "Informe a situação Cancelado." });
            }

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const atual = await this.#model.buscarPorId(this.#banco, id, true);
            if (!atual) return await this.#rollbackResposta(res, 404, "Pedido de compra não encontrado.");
            if (!["Pendente", "Parcialmente Recebido"].includes(atual.situacao)) {
                return await this.#rollbackResposta(res, 409, `O pedido já está ${atual.situacao.toLowerCase()} e sua situação não pode mais ser alterada.`);
            }
            if (!await this.#model.alterarSituacao(this.#banco, id, situacao)) {
                return await this.#rollbackResposta(res, 409, "A situação do pedido não pôde ser alterada.");
            }
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(await this.#model.buscarPorId(this.#banco, id));
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    #dadosPedido(body, dataOpcional) {
        const permitidas = ["dataSolicitacao", "observacao", "itens"];
        if (!body || Object.keys(body).some(chave => !permitidas.includes(chave))) return null;
        const dataSolicitacao = this.#data(body.dataSolicitacao, dataOpcional);
        const observacao = this.#observacao(body.observacao);
        const itens = this.#itens(body.itens);
        if (!dataSolicitacao || observacao === undefined || !itens) return null;
        return { dataSolicitacao, observacao, itens };
    }

    #itens(valor) {
        if (!Array.isArray(valor) || !valor.length) return null;
        const itens = [];
        const produtos = new Set();
        for (const item of valor) {
            if (!item || Object.keys(item).some(chave => !["produtoId", "quantidade"].includes(chave))) return null;
            const produtoId = this.#numero(item.produtoId);
            const quantidade = this.#numero(item.quantidade);
            if (!produtoId || !quantidade || produtos.has(produtoId)) return null;
            produtos.add(produtoId);
            itens.push({ produtoId, quantidade });
        }
        return itens;
    }

    async #validarProdutos(itens) {
        const produtos = await this.#model.buscarProdutos(this.#banco, itens.map(item => item.produtoId));
        if (produtos.length !== itens.length) return "Um ou mais produtos informados não existem.";
        if (produtos.some(produto => !produto.ativo)) return "Somente produtos ativos podem ser incluídos no pedido.";
        return null;
    }

    #data(valor, opcional) {
        if ((valor === undefined || valor === null || valor === "") && opcional) return this.#hoje();
        if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
        const [ano, mes, dia] = valor.split("-").map(Number);
        const data = new Date(Date.UTC(ano, mes - 1, dia));
        if (ano < 1000 || data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
            return null;
        }
        return valor >= this.#umMesAtras() && valor <= this.#hoje() ? valor : null;
    }

    #hoje() {
        const hoje = new Date();
        return [hoje.getFullYear(), String(hoje.getMonth() + 1).padStart(2, "0"), String(hoje.getDate()).padStart(2, "0")].join("-");
    }

    #umMesAtras() {
        const hoje = new Date();
        const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
        const limite = new Date(
            hoje.getFullYear(),
            hoje.getMonth() - 1,
            Math.min(hoje.getDate(), ultimoDiaMesAnterior)
        );
        return [limite.getFullYear(), String(limite.getMonth() + 1).padStart(2, "0"), String(limite.getDate()).padStart(2, "0")].join("-");
    }

    #observacao(valor) {
        if (valor === undefined || valor === null || valor === "") return null;
        if (typeof valor !== "string") return undefined;
        const observacao = valor.trim();
        return observacao.length <= 255 ? observacao || null : undefined;
    }

    #situacaoFiltro(valor) {
        if (valor === undefined || valor === null || valor === "") return "Todas";
        if (typeof valor !== "string") return null;
        const encontrada = ["Todas", "Pendente", "Parcialmente Recebido", "Recebido", "Cancelado"]
            .find(item => item.toLowerCase() === valor.trim().toLowerCase());
        return encontrada ?? null;
    }

    #id(valor) { return typeof valor === "string" && /^\d+$/.test(valor) ? this.#numero(Number(valor)) : null; }
    #numero(valor) { return Number.isSafeInteger(valor) && valor > 0 ? valor : null; }

    async #rollbackResposta(res, status, mensagem) {
        await this.#banco.Rollback();
        return res.status(status).json({ erro: mensagem });
    }

    async #tratarErro(erro, transacaoAberta, res, next) {
        if (transacaoAberta) {
            try { await this.#banco.Rollback(); } catch (rollbackErro) { erro.rollbackErro = rollbackErro; }
        }
        if (erro.code === "ER_DUP_ENTRY") return res.status(409).json({ erro: "O mesmo produto não pode aparecer mais de uma vez no pedido." });
        next(erro);
    }
}
