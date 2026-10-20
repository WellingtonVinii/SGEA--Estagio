import Database from "../database/database.js";
import EntradaModel from "../model/entradaModel.js";
import EstoqueModel from "../model/estoqueModel.js";
import PedidoCompraModel from "../model/pedidoCompraModel.js";

export default class EntradaController {
    #banco;
    #model;
    #estoque;
    #pedidos;

    constructor() {
        this.#banco = new Database();
        this.#model = new EntradaModel();
        this.#estoque = new EstoqueModel();
        this.#pedidos = new PedidoCompraModel();
    }

    async listar(req, res, next) {
        try {
            const busca = req.query?.busca === undefined ? "" : typeof req.query.busca === "string" ? req.query.busca.trim() : null;
            const situacao = req.query?.situacao ?? "Todas";
            if (busca === null || busca.length > 150 || !["Todas", "Ativa", "Cancelada"].includes(situacao)) {
                return res.status(400).json({ erro: "Informe uma busca válida e situação Todas, Ativa ou Cancelada." });
            }
            return res.json(await this.#model.listar(this.#banco, busca, situacao));
        } catch (erro) { next(erro); }
    }

    async buscar(req, res, next) {
        try {
            const id = this.#idRota(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id da entrada inválido." });
            const entrada = await this.#model.buscarPorId(this.#banco, id);
            return entrada ? res.json(entrada) : res.status(404).json({ erro: "Entrada não encontrada." });
        } catch (erro) { next(erro); }
    }

    async cadastrar(req, res, next) {
        return this.#salvar(req, res, next, null);
    }

    async alterar(req, res, next) {
        const id = this.#idRota(req.params.id);
        if (!id) return res.status(400).json({ erro: "Id da entrada inválido." });
        return this.#salvar(req, res, next, id);
    }

    async cancelar(req, res, next) {
        let transacaoAberta = false;
        try {
            const id = this.#idRota(req.params.id);
            if (!id || Object.keys(req.body ?? {}).length) {
                return res.status(400).json({ erro: "Informe uma entrada válida sem conteúdo adicional." });
            }
            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const entrada = await this.#model.buscarPorId(this.#banco, id, true);
            if (!entrada) return await this.#rollbackResposta(res, 404, "Entrada não encontrada.");
            if (entrada.situacao !== "Ativa") return await this.#rollbackResposta(res, 409, "A entrada já está cancelada.");

            const atualizacao = await this.#estoque.reverterMovimentacao(this.#banco, entrada.itens, "entrada");
            if (atualizacao.tipo === "saldo_insuficiente") {
                return await this.#rollbackResposta(res, 409, "A entrada não pode ser cancelada porque parte do estoque recebido já foi consumida.");
            }
            if (atualizacao.tipo !== "ok" || !await this.#model.cancelar(this.#banco, id)) {
                throw new Error("Não foi possível cancelar a entrada.");
            }
            if (entrada.pedidoCompraId) {
                await this.#pedidos.atualizarSituacaoRecebimento(this.#banco, entrada.pedidoCompraId);
            }
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(await this.#model.buscarPorId(this.#banco, id));
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    async #salvar(req, res, next, id) {
        let transacaoAberta = false;
        try {
            const dados = this.#dados(req.body, id === null);
            const funcionarioId = this.#inteiroPositivo(req.usuario?.funcionarioId);
            if (!dados || !funcionarioId) {
                return res.status(400).json({ erro: "Informe data, observação e itens válidos para a entrada." });
            }

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const atual = id === null ? null : await this.#model.buscarPorId(this.#banco, id, true);
            if (id !== null && !atual) return await this.#rollbackResposta(res, 404, "Entrada não encontrada.");
            if (atual && atual.situacao !== "Ativa") return await this.#rollbackResposta(res, 409, "Entradas canceladas não podem ser alteradas.");

            const idsPedidos = [...new Set([atual?.pedidoCompraId, dados.pedidoCompraId]
                .filter(pedidoId => pedidoId !== null && pedidoId !== undefined))].sort((a, b) => a - b);
            let pedido = null;
            for (const pedidoId of idsPedidos) {
                const bloqueado = await this.#pedidos.buscarPorId(this.#banco, pedidoId, true);
                if (pedidoId === dados.pedidoCompraId) pedido = bloqueado;
            }
            if (dados.pedidoCompraId) {
                if (!pedido) return await this.#rollbackResposta(res, 404, "Pedido de compra não encontrado.");
                const alterandoPedidoAtual = atual?.pedidoCompraId === pedido.id;
                const situacoesPermitidas = alterandoPedidoAtual
                    ? ["Pendente", "Parcialmente Recebido", "Recebido"]
                    : ["Pendente", "Parcialmente Recebido"];
                if (!situacoesPermitidas.includes(pedido.situacao)) {
                    return await this.#rollbackResposta(res, 409, "Somente pedidos pendentes ou parcialmente recebidos podem receber novas entradas.");
                }
                const erroQuantidade = await this.#validarQuantidadesPedido(pedido, dados.itens);
                if (erroQuantidade) return await this.#rollbackResposta(res, 409, erroQuantidade);
            } else {
                const erroProdutos = await this.#validarProdutosAvulsos(dados.itens);
                if (erroProdutos) return await this.#rollbackResposta(res, 409, erroProdutos);
            }

            const resolvidos = await this.#resolverLotes(dados.itens);
            if (resolvidos.erro) return await this.#rollbackResposta(res, 400, resolvidos.erro);

            let atualizacao;
            if (id === null) {
                atualizacao = await this.#estoque.atualizarPorEntrada(this.#banco, resolvidos.itens);
            } else {
                const deltas = new Map();
                for (const item of atual.itens) deltas.set(item.loteId, (deltas.get(item.loteId) ?? 0) - item.quantidade);
                for (const item of resolvidos.itens) deltas.set(item.loteId, (deltas.get(item.loteId) ?? 0) + item.quantidade);
                atualizacao = await this.#estoque.aplicarDeltas(this.#banco, deltas);
            }
            if (atualizacao.tipo === "saldo_insuficiente") {
                return await this.#rollbackResposta(res, 409, "A alteração deixaria o saldo de um lote negativo.");
            }
            if (atualizacao.tipo !== "ok") throw new Error("Não foi possível atualizar os lotes da entrada.");

            const entrada = new EntradaModel(
                id ?? 0, dados.pedidoCompraId, atual?.funcionarioId ?? funcionarioId,
                atual?.funcionarioNome ?? "", dados.dataEntrada, dados.observacao, "Ativa", resolvidos.itens
            );
            if (id === null) await this.#model.cadastrar(this.#banco, entrada);
            else await this.#model.atualizar(this.#banco, entrada);

            if (atual?.pedidoCompraId && atual.pedidoCompraId !== entrada.pedidoCompraId) {
                await this.#pedidos.atualizarSituacaoRecebimento(this.#banco, atual.pedidoCompraId);
            }
            if (entrada.pedidoCompraId) {
                await this.#pedidos.atualizarSituacaoRecebimento(this.#banco, entrada.pedidoCompraId);
            }
            await this.#banco.Commit();
            transacaoAberta = false;
            const salvo = await this.#model.buscarPorId(this.#banco, entrada.id);
            return res.status(id === null ? 201 : 200).json(salvo);
        } catch (erro) { await this.#tratarErro(erro, transacaoAberta, res, next); }
    }

    async #validarQuantidadesPedido(pedido, itens) {
        const solicitados = new Map(pedido.itens.map(item => [item.produtoId, item]));
        const extras = itens.filter(item => !solicitados.has(item.produtoId));
        if (!extras.length) return null;
        const produtos = await this.#pedidos.buscarProdutos(this.#banco, extras.map(item => item.produtoId));
        if (produtos.length !== extras.length) return "Um dos produtos extras informados não existe.";
        if (produtos.some(produto => !produto.ativo)) return "Somente produtos ativos podem ser adicionados como extras.";
        return null;
    }

    async #validarProdutosAvulsos(itens) {
        const produtos = await this.#pedidos.buscarProdutos(this.#banco, itens.map(item => item.produtoId));
        if (produtos.length !== itens.length) return "Um dos produtos informados não existe.";
        if (produtos.some(produto => !produto.ativo)) return "Entradas avulsas aceitam somente produtos ativos.";
        return null;
    }

    async #resolverLotes(itens) {
        const resolvidos = [];
        for (const item of itens) {
            let lote;
            if (item.loteId) {
                lote = await this.#estoque.buscarLotePorId(this.#banco, item.loteId, item.produtoId);
                if (!lote) return { erro: "O lote selecionado não pertence ao produto informado." };
            } else {
                lote = await this.#estoque.buscarLotePorCodigo(this.#banco, item.produtoId, item.codigoLote);
                if (lote && item.dataValidade && lote.dataValidade !== item.dataValidade) {
                    return { erro: `O lote ${item.codigoLote} já existe com outra data de validade.` };
                }
                if (!lote) lote = await this.#estoque.criarLote(this.#banco, item.produtoId, item.codigoLote, item.dataValidade);
                if (!lote) return { erro: "Não foi possível cadastrar o novo lote." };
            }
            resolvidos.push({ ...item, loteId: lote.id, codigoLote: lote.codigoLote, dataValidade: lote.dataValidade });
        }
        return { itens: resolvidos };
    }

    #dados(body, dataOpcional) {
        const permitidas = ["pedidoCompraId", "dataEntrada", "observacao", "itens"];
        if (!body || Object.keys(body).some(chave => !permitidas.includes(chave))) return null;
        const pedidoAusente = body.pedidoCompraId === undefined || body.pedidoCompraId === null || body.pedidoCompraId === "";
        const pedidoCompraId = pedidoAusente ? null : this.#inteiroPositivo(body.pedidoCompraId);
        const dataEntrada = this.#dataEntrada(body.dataEntrada, dataOpcional);
        const observacao = this.#observacao(body.observacao);
        const itens = this.#itens(body.itens);
        return (pedidoAusente || pedidoCompraId) && dataEntrada && observacao !== undefined && itens
            ? { pedidoCompraId, dataEntrada, observacao, itens } : null;
    }

    #itens(valor) {
        if (!Array.isArray(valor) || !valor.length) return null;
        const produtos = new Set();
        const itens = [];
        for (const item of valor) {
            const permitidas = ["produtoId", "quantidade", "loteId", "codigoLote", "dataValidade"];
            if (!item || Object.keys(item).some(chave => !permitidas.includes(chave))) return null;
            const produtoId = this.#inteiroPositivo(item.produtoId);
            const quantidade = this.#inteiroPositivo(item.quantidade);
            const loteId = item.loteId === undefined || item.loteId === null || item.loteId === ""
                ? null : this.#inteiroPositivo(item.loteId);
            const codigoLote = loteId ? null : this.#codigoLote(item.codigoLote);
            const dataValidade = this.#dataOpcional(item.dataValidade);
            if (!produtoId || !quantidade || produtos.has(produtoId) || (!loteId && !codigoLote) || dataValidade === undefined) return null;
            produtos.add(produtoId);
            itens.push({ produtoId, quantidade, loteId, codigoLote, dataValidade });
        }
        return itens;
    }

    #dataEntrada(valor, opcional) {
        if ((valor === undefined || valor === null || valor === "") && opcional) return this.#hoje();
        const data = this.#dataOpcional(valor);
        if (!data) return null;
        return data >= this.#umMesAtras() && data <= this.#hoje() ? data : null;
    }

    #dataOpcional(valor) {
        if (valor === undefined || valor === null || valor === "") return null;
        if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
        const [ano, mes, dia] = valor.split("-").map(Number);
        const data = new Date(Date.UTC(ano, mes - 1, dia));
        return ano >= 1000 && data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
            ? valor : undefined;
    }

    #hoje() { return this.#formatarData(new Date()); }
    #umMesAtras() {
        const hoje = new Date();
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
        return this.#formatarData(new Date(hoje.getFullYear(), hoje.getMonth() - 1, Math.min(hoje.getDate(), ultimoDia)));
    }
    #formatarData(data) {
        return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
    }
    #observacao(valor) {
        if (valor === undefined || valor === null || valor === "") return null;
        if (typeof valor !== "string") return undefined;
        const observacao = valor.trim();
        return observacao.length <= 500 ? observacao || null : undefined;
    }
    #codigoLote(valor) {
        if (valor === undefined || valor === null || valor === "") return "1";
        if (typeof valor !== "string") return null;
        const codigo = valor.trim();
        return codigo && codigo.length <= 50 ? codigo : null;
    }
    #idRota(valor) { return typeof valor === "string" && /^\d+$/.test(valor) ? this.#inteiroPositivo(Number(valor)) : null; }
    #inteiroPositivo(valor) { return Number.isSafeInteger(valor) && valor > 0 ? valor : null; }

    async #rollbackResposta(res, status, mensagem) {
        await this.#banco.Rollback();
        return res.status(status).json({ erro: mensagem });
    }
    async #tratarErro(erro, transacaoAberta, res, next) {
        if (transacaoAberta) {
            try { await this.#banco.Rollback(); } catch (rollbackErro) { erro.rollbackErro = rollbackErro; }
        }
        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ erro: "Este código de lote já está cadastrado para o produto. Selecione o lote existente." });
        }
        next(erro);
    }
}
