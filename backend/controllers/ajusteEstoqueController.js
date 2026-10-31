import Database from "../database/database.js";
import AjusteEstoqueModel from "../model/ajusteEstoqueModel.js";
import EstoqueModel from "../model/estoqueModel.js";

export default class AjusteEstoqueController {
    #banco = new Database();
    #model = new AjusteEstoqueModel();
    #estoque = new EstoqueModel();

    async listar(req, res, next) {
        try {
            const busca = req.query?.busca === undefined ? ""
                : typeof req.query.busca === "string" ? req.query.busca.trim() : null;
            if (busca === null || busca.length > 150) {
                return res.status(400).json({ erro: "Informe uma busca válida de até 150 caracteres." });
            }
            return res.json(await this.#model.listar(this.#banco, busca));
        } catch (erro) { next(erro); }
    }

    async buscar(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do ajuste inválido." });
            const ajuste = await this.#model.buscarPorId(this.#banco, id);
            return ajuste ? res.json(ajuste) : res.status(404).json({ erro: "Ajuste não encontrado." });
        } catch (erro) { next(erro); }
    }

    async listarFuncionarios(req, res, next) {
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
                return res.status(400).json({
                    erro: "Informe o funcionário solicitante e produto, lote, diferença diferente de zero e justificativa válidos para todos os itens."
                });
            }
            const itensInformados = dados.itens;

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const solicitante = await this.#model.buscarFuncionarioAtivo(this.#banco, dados.solicitanteId);
            if (!solicitante) {
                return await this.#rollbackResposta(res, 409, "O funcionário solicitante não existe ou está inativo.");
            }
            const ids = itensInformados.map(item => item.loteId).sort((a, b) => a - b);
            const lotes = await this.#model.buscarLotesParaAjuste(this.#banco, ids);
            if (lotes.length !== ids.length) {
                return await this.#rollbackResposta(res, 409, "Um dos lotes informados não existe.");
            }

            const lotesPorId = new Map(lotes.map(lote => [lote.loteId, lote]));
            const itens = [];
            for (const item of itensInformados) {
                const lote = lotesPorId.get(item.loteId);
                if (lote.produtoId !== item.produtoId) {
                    return await this.#rollbackResposta(res, 409, "Um dos lotes não pertence ao produto informado.");
                }
                if (!lote.produtoAtivo) {
                    return await this.#rollbackResposta(res, 409, `O produto ${lote.produtoNome} está inativo e não pode ser ajustado.`);
                }
                const quantidadeFisica = lote.quantidadeDisponivel + item.diferenca;
                if (quantidadeFisica < 0) {
                    return await this.#rollbackResposta(res, 409,
                        `O lote ${lote.codigoLote} possui ${lote.quantidadeDisponivel} unidade(s); não é possível remover ${-item.diferenca}.`);
                }
                itens.push({ ...item, quantidadeAnterior: lote.quantidadeDisponivel, quantidadeFisica });
            }

            const atualizacao = await this.#estoque.atualizarPorAjuste(this.#banco, itens);
            if (atualizacao.tipo !== "ok") throw new Error("Não foi possível atualizar os lotes do ajuste.");
            const ajuste = new AjusteEstoqueModel(0, "", funcionarioId, "", itens, solicitante.id, solicitante.nome);
            if (!await this.#model.cadastrar(this.#banco, ajuste)) {
                throw new Error("Não foi possível registrar o ajuste de estoque.");
            }
            await this.#banco.Commit();
            transacaoAberta = false;
            return res.status(201).json(await this.#model.buscarPorId(this.#banco, ajuste.id));
        } catch (erro) {
            if (transacaoAberta) {
                try { await this.#banco.Rollback(); } catch (rollbackErro) { erro.rollbackErro = rollbackErro; }
            }
            next(erro);
        }
    }

    #dados(body) {
        if (!body || Object.keys(body).some(chave => !["solicitanteId", "itens"].includes(chave)) ||
            !Array.isArray(body.itens) || !body.itens.length) return null;
        const solicitanteId = this.#inteiroPositivo(body.solicitanteId);
        if (!solicitanteId) return null;
        const lotesUsados = new Set();
        const itens = [];
        for (const item of body.itens) {
            if (!item || Object.keys(item).some(chave =>
                !["produtoId", "loteId", "diferenca", "justificativa"].includes(chave))) return null;
            const produtoId = this.#inteiroPositivo(item.produtoId);
            const loteId = this.#inteiroPositivo(item.loteId);
            const diferenca = Number.isSafeInteger(item.diferenca) && item.diferenca !== 0 ? item.diferenca : null;
            const justificativa = this.#justificativa(item.justificativa);
            if (!produtoId || !loteId || diferenca === null || !justificativa || lotesUsados.has(loteId)) return null;
            lotesUsados.add(loteId);
            itens.push({ produtoId, loteId, diferenca, justificativa });
        }
        return { solicitanteId, itens };
    }

    #justificativa(valor) {
        if (typeof valor !== "string") return null;
        const justificativa = valor.trim();
        return justificativa && justificativa.length <= 255 ? justificativa : null;
    }

    #id(valor) { return typeof valor === "string" && /^\d+$/.test(valor) ? this.#inteiroPositivo(Number(valor)) : null; }
    #inteiroPositivo(valor) { return Number.isSafeInteger(valor) && valor > 0 ? valor : null; }

    async #rollbackResposta(res, status, mensagem) {
        await this.#banco.Rollback();
        return res.status(status).json({ erro: mensagem });
    }
}
