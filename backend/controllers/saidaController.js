import Database from "../database/database.js";
import EstoqueModel from "../model/estoqueModel.js";
import SaidaModel from "../model/saidaModel.js";

export default class SaidaController {
    #banco;
    #model;
    #estoque;

    constructor() {
        this.#banco = new Database();
        this.#model = new SaidaModel();
        this.#estoque = new EstoqueModel();
    }

    async listar(req, res, next) {
        try {
            const busca = req.query?.busca === undefined ? "" : typeof req.query.busca === "string" ? req.query.busca.trim() : null;
            if (busca === null || busca.length > 150) return res.status(400).json({ erro: "Informe uma busca válida." });
            return res.json(await this.#model.listar(this.#banco, busca));
        } catch (erro) { next(erro); }
    }

    async buscar(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id da saída inválido." });
            const saida = await this.#model.buscarPorId(this.#banco, id);
            return saida ? res.json(saida) : res.status(404).json({ erro: "Saída não encontrada." });
        } catch (erro) { next(erro); }
    }

    async listarDestinatarios(req, res, next) {
        try {
            return res.json(await this.#model.buscarFuncionariosAtivos(this.#banco));
        } catch (erro) { next(erro); }
    }

    async cadastrar(req, res, next) {
        let transacaoAberta = false;
        try {
            const dados = this.#dados(req.body);
            const funcionarioId = this.#inteiroPositivo(req.usuario?.funcionarioId);
            if (!dados || !funcionarioId) {
                return res.status(400).json({ erro: "Informe destinatário, observação, produtos, quantidades e lotes válidos." });
            }

            await this.#banco.AbreTransacao();
            transacaoAberta = true;

            const destinatario = await this.#model.buscarFuncionarioAtivo(this.#banco, dados.destinatarioId);
            if (!destinatario) return await this.#rollbackResposta(res, 409, "O funcionário destinatário não existe ou está inativo.");

            const produtos = await this.#model.buscarProdutos(this.#banco, dados.produtos.map(produto => produto.produtoId));
            if (produtos.length !== dados.produtos.length) return await this.#rollbackResposta(res, 409, "Um dos produtos informados não existe.");
            if (produtos.some(produto => !produto.ativo)) return await this.#rollbackResposta(res, 409, "Não é permitido retirar produtos inativos.");

            const itens = dados.produtos.flatMap(produto => produto.lotes.map(lote => ({
                produtoId: produto.produtoId, loteId: lote.loteId, quantidade: lote.quantidade
            })));
            const lotes = await this.#model.buscarLotes(this.#banco, itens.map(item => item.loteId));
            if (lotes.length !== itens.length) return await this.#rollbackResposta(res, 409, "Um dos lotes selecionados não existe.");

            const lotesPorId = new Map(lotes.map(lote => [lote.id, lote]));
            const hoje = this.#hoje();
            for (const item of itens) {
                const lote = lotesPorId.get(item.loteId);
                if (lote.produtoId !== item.produtoId) return await this.#rollbackResposta(res, 409, "Um dos lotes não pertence ao produto informado.");
                if (lote.dataValidade && lote.dataValidade < hoje) return await this.#rollbackResposta(res, 409, `O lote ${lote.codigoLote} está vencido e não pode ser retirado.`);
                if (lote.quantidadeDisponivel <= 0) return await this.#rollbackResposta(res, 409, `O lote ${lote.codigoLote} não possui estoque disponível.`);
                if (item.quantidade > lote.quantidadeDisponivel) return await this.#rollbackResposta(res, 409, `A quantidade do lote ${lote.codigoLote} excede o saldo disponível.`);
            }

            const atualizacao = await this.#estoque.atualizarPorSaida(this.#banco, itens);
            if (atualizacao.tipo === "saldo_insuficiente") return await this.#rollbackResposta(res, 409, "O estoque foi alterado e não possui mais quantidade suficiente. Atualize os lotes e tente novamente.");
            if (atualizacao.tipo !== "ok") throw new Error("Não foi possível atualizar o estoque da saída.");

            const saida = new SaidaModel(0, "", dados.observacao, funcionarioId, "", dados.destinatarioId, destinatario.nome);
            if (!await this.#model.cadastrar(this.#banco, saida, itens)) throw new Error("Não foi possível registrar a saída.");

            await this.#banco.Commit();
            transacaoAberta = false;
            return res.status(201).json(await this.#model.buscarPorId(this.#banco, saida.id));
        } catch (erro) {
            if (transacaoAberta) {
                try { await this.#banco.Rollback(); } catch (rollbackErro) { erro.rollbackErro = rollbackErro; }
            }
            next(erro);
        }
    }

    #dados(body) {
        if (!body || Object.keys(body).some(chave => !["destinatarioId", "observacao", "produtos"].includes(chave))) return null;
        const destinatarioId = this.#inteiroPositivo(body.destinatarioId);
        const observacao = this.#observacao(body.observacao);
        if (!destinatarioId || observacao === undefined || !Array.isArray(body.produtos) || !body.produtos.length) return null;

        const produtosUsados = new Set();
        const lotesUsados = new Set();
        const produtos = [];
        for (const produto of body.produtos) {
            if (!produto || Object.keys(produto).some(chave => !["produtoId", "quantidade", "lotes"].includes(chave))) return null;
            const produtoId = this.#inteiroPositivo(produto.produtoId);
            const quantidade = this.#inteiroPositivo(produto.quantidade);
            if (!produtoId || !quantidade || produtosUsados.has(produtoId) || !Array.isArray(produto.lotes) || !produto.lotes.length) return null;
            let soma = 0;
            const lotes = [];
            for (const lote of produto.lotes) {
                if (!lote || Object.keys(lote).some(chave => !["loteId", "quantidade"].includes(chave))) return null;
                const loteId = this.#inteiroPositivo(lote.loteId);
                const quantidadeLote = this.#inteiroPositivo(lote.quantidade);
                if (!loteId || !quantidadeLote || lotesUsados.has(loteId)) return null;
                lotesUsados.add(loteId);
                soma += quantidadeLote;
                lotes.push({ loteId, quantidade: quantidadeLote });
            }
            if (soma !== quantidade) return null;
            produtosUsados.add(produtoId);
            produtos.push({ produtoId, quantidade, lotes });
        }
        return { destinatarioId, observacao, produtos };
    }

    #observacao(valor) {
        if (valor === undefined || valor === null || valor === "") return null;
        if (typeof valor !== "string") return undefined;
        const observacao = valor.trim();
        return observacao.length <= 255 ? observacao || null : undefined;
    }

    #hoje() {
        const data = new Date();
        return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
    }

    #id(valor) { return typeof valor === "string" && /^\d+$/.test(valor) ? this.#inteiroPositivo(Number(valor)) : null; }
    #inteiroPositivo(valor) { return Number.isSafeInteger(valor) && valor > 0 ? valor : null; }

    async #rollbackResposta(res, status, mensagem) {
        await this.#banco.Rollback();
        return res.status(status).json({ erro: mensagem });
    }
}
