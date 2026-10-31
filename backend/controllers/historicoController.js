import Database from "../database/database.js";
import HistoricoModel from "../model/historicoModel.js";

export default class HistoricoController {
    #banco;
    #model;

    constructor() {
        this.#banco = new Database();
        this.#model = new HistoricoModel();
    }

    async listar(req, res, next) {
        try {
            const dataInicio = this.#data(req.query?.dataInicio);
            const dataFim = this.#data(req.query?.dataFim);
            if (dataInicio === undefined || dataFim === undefined) {
                return res.status(400).json({ erro: "Informe datas válidas para o período." });
            }
            if (dataInicio && dataFim && dataInicio > dataFim) {
                return res.status(400).json({ erro: "Período inválido: a data inicial deve ser anterior ou igual à data final." });
            }
            const produto = req.query?.produto === undefined ? "" : typeof req.query.produto === "string" ? req.query.produto.trim() : null;
            if (produto === null || produto.length > 150) return res.status(400).json({ erro: "Informe um produto válido." });
            const tipo = req.query?.tipo === undefined || req.query.tipo === "" ? null : req.query.tipo;
            if (tipo !== null && !["Entrada", "Saída", "Ajuste"].includes(tipo)) {
                return res.status(400).json({ erro: "Informe o tipo Entrada, Saída ou Ajuste." });
            }
            let funcionarioId = null;
            if (req.query?.funcionarioId !== undefined && req.query.funcionarioId !== "") {
                funcionarioId = typeof req.query.funcionarioId === "string" && /^\d+$/.test(req.query.funcionarioId) ? Number(req.query.funcionarioId) : 0;
                if (!Number.isSafeInteger(funcionarioId) || funcionarioId <= 0) return res.status(400).json({ erro: "Informe um funcionário válido." });
            }
            return res.json(await this.#model.listar(this.#banco, { dataInicio, dataFim, produto, funcionarioId, tipo }));
        } catch (erro) { next(erro); }
    }

    async listarResponsaveis(req, res, next) {
        try {
            return res.json(await this.#model.listarResponsaveis(this.#banco));
        } catch (erro) { next(erro); }
    }

    #data(valor) {
        if (valor === undefined || valor === "") return null;
        if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
        const [ano, mes, dia] = valor.split("-").map(Number);
        const data = new Date(Date.UTC(ano, mes - 1, dia));
        return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? valor : undefined;
    }
}
