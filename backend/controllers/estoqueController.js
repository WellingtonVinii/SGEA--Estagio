import Database from "../database/database.js";
import EstoqueModel from "../model/estoqueModel.js";

export default class EstoqueController {
    #banco;
    #model;

    constructor() {
        this.#banco = new Database();
        this.#model = new EstoqueModel();
    }

    async consultar(req, res, next) {
        try {
            const filtros = this.#filtros(req.query ?? {});
            if (filtros.erro) return res.status(400).json({ erro: filtros.erro });
            return res.json(await this.#model.consultarEstoque(this.#banco, filtros));
        } catch (erro) { next(erro); }
    }

    #filtros(query) {
        const nome = query.nome === undefined ? "" : typeof query.nome === "string" ? query.nome.trim() : null;
        if (nome === null || nome.length > 150) return { erro: "Informe um nome válido." };

        let categoriaId = null;
        if (query.categoriaId !== undefined && query.categoriaId !== "") {
            categoriaId = typeof query.categoriaId === "string" && /^\d+$/.test(query.categoriaId) ? Number(query.categoriaId) : 0;
            if (!Number.isSafeInteger(categoriaId) || categoriaId <= 0) return { erro: "Informe uma categoria válida." };
        }

        const validadeInicio = this.#data(query.validadeInicio);
        const validadeFim = this.#data(query.validadeFim);
        if (validadeInicio === undefined || validadeFim === undefined) return { erro: "Informe datas de validade válidas." };
        if (validadeInicio && validadeFim && validadeInicio > validadeFim) {
            return { erro: "Período de validade inválido: a data inicial deve ser anterior ou igual à data final." };
        }
        return { nome, categoriaId, validadeInicio, validadeFim };
    }

    #data(valor) {
        if (valor === undefined || valor === "") return null;
        if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
        const [ano, mes, dia] = valor.split("-").map(Number);
        const data = new Date(Date.UTC(ano, mes - 1, dia));
        return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? valor : undefined;
    }
}
