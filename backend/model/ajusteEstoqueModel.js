import Entity from "./entity.js";

export default class AjusteEstoqueModel extends Entity {
    constructor(id = 0, dataHora = "", funcionarioId = 0, funcionarioNome = "", itens = [], solicitanteId = null, solicitanteNome = null) {
        super();
        this.id = id;
        this.dataHora = dataHora;
        this.funcionarioId = funcionarioId;
        this.funcionarioNome = funcionarioNome;
        this.itens = itens;
        this.solicitanteId = solicitanteId;
        this.solicitanteNome = solicitanteNome;
    }

    async listar(banco, busca = "") {
        const termo = `%${busca}%`;
        const filtro = busca ? `WHERE CAST(a.Id AS CHAR) LIKE ? OR f.Nome LIKE ? OR s.Nome LIKE ? OR EXISTS (
                    SELECT 1 FROM ItemAjusteEstoque iaBusca
                    JOIN Lote lBusca ON lBusca.Id = iaBusca.LoteId
                    JOIN Produto pBusca ON pBusca.Id = lBusca.ProdutoId
                    WHERE iaBusca.AjusteEstoqueId = a.Id
                    AND (pBusca.Nome LIKE ? OR lBusca.CodigoLote LIKE ? OR iaBusca.Justificativa LIKE ?)
                )` : "";
        const valores = busca ? [termo, termo, termo, termo, termo, termo] : [];
        const rows = await banco.ExecutaComando(
            `SELECT a.Id AS id, DATE_FORMAT(a.DataHora, '%Y-%m-%d %H:%i:%s') AS dataHora,
                    a.FuncionarioId AS funcionarioId, f.Nome AS funcionarioNome,
                    a.SolicitanteId AS solicitanteId, s.Nome AS solicitanteNome,
                    COUNT(ia.Id) AS quantidadeItens,
                    COALESCE(SUM(ABS(ia.Diferenca)), 0) AS totalDiferenca
               FROM AjusteEstoque a
               JOIN Funcionario f ON f.Id = a.FuncionarioId
          LEFT JOIN Funcionario s ON s.Id = a.SolicitanteId
               JOIN ItemAjusteEstoque ia ON ia.AjusteEstoqueId = a.Id
              ${filtro}
           GROUP BY a.Id, a.DataHora, a.FuncionarioId, f.Nome, a.SolicitanteId, s.Nome
           ORDER BY a.DataHora DESC, a.Id DESC`,
            valores
        );
        return rows.map(row => ({
            id: Number(row.id), dataHora: row.dataHora,
            funcionarioId: Number(row.funcionarioId), funcionarioNome: row.funcionarioNome,
            solicitanteId: row.solicitanteId === null ? null : Number(row.solicitanteId),
            solicitanteNome: row.solicitanteNome ?? null,
            quantidadeItens: Number(row.quantidadeItens), totalDiferenca: Number(row.totalDiferenca)
        }));
    }

    async buscarPorId(banco, id) {
        const rows = await banco.ExecutaComando(
            `SELECT a.Id AS id, DATE_FORMAT(a.DataHora, '%Y-%m-%d %H:%i:%s') AS dataHora,
                    a.FuncionarioId AS funcionarioId, f.Nome AS funcionarioNome,
                    a.SolicitanteId AS solicitanteId, s.Nome AS solicitanteNome
               FROM AjusteEstoque a
               JOIN Funcionario f ON f.Id = a.FuncionarioId
          LEFT JOIN Funcionario s ON s.Id = a.SolicitanteId
              WHERE a.Id = ?`, [id]
        );
        if (!rows.length) return null;
        const ajuste = AjusteEstoqueModel.toMap(rows[0]);
        ajuste.itens = await this.listarItens(banco, id);
        return ajuste;
    }

    async listarItens(banco, ajusteId) {
        const rows = await banco.ExecutaComando(
            `SELECT ia.Id AS id, ia.LoteId AS loteId,
                    ia.QuantidadeNova AS quantidadeFisica, ia.Diferenca AS diferenca,
                    ia.QuantidadeNova - ia.Diferenca AS quantidadeAnterior,
                    ia.Justificativa AS justificativa, l.CodigoLote AS codigoLote,
                    DATE_FORMAT(l.DataValidade, '%Y-%m-%d') AS dataValidade,
                    l.ProdutoId AS produtoId, p.Nome AS produtoNome
               FROM ItemAjusteEstoque ia
               JOIN Lote l ON l.Id = ia.LoteId
               JOIN Produto p ON p.Id = l.ProdutoId
              WHERE ia.AjusteEstoqueId = ? ORDER BY ia.Id`, [ajusteId]
        );
        return rows.map(row => ({
            id: Number(row.id), produtoId: Number(row.produtoId), produtoNome: row.produtoNome,
            loteId: Number(row.loteId), codigoLote: row.codigoLote, dataValidade: row.dataValidade ?? null,
            quantidadeAnterior: Number(row.quantidadeAnterior), quantidadeFisica: Number(row.quantidadeFisica),
            diferenca: Number(row.diferenca), justificativa: row.justificativa
        }));
    }

    async buscarLotesParaAjuste(banco, ids) {
        if (!ids.length) return [];
        const marcadores = ids.map(() => "?").join(", ");
        const rows = await banco.ExecutaComando(
            `SELECT l.Id AS loteId, l.ProdutoId AS produtoId, l.CodigoLote AS codigoLote,
                    l.QuantidadeDisponivel AS quantidadeDisponivel,
                    p.Nome AS produtoNome, p.Ativo AS produtoAtivo
               FROM Lote l JOIN Produto p ON p.Id = l.ProdutoId
              WHERE l.Id IN (${marcadores}) ORDER BY l.Id FOR UPDATE`, ids
        );
        return rows.map(row => ({
            loteId: Number(row.loteId), produtoId: Number(row.produtoId), codigoLote: row.codigoLote,
            quantidadeDisponivel: Number(row.quantidadeDisponivel), produtoNome: row.produtoNome,
            produtoAtivo: Boolean(row.produtoAtivo)
        }));
    }

    async buscarFuncionariosAtivos(banco) {
        const rows = await banco.ExecutaComando(
            "SELECT Id AS id, Nome AS nome, Cargo AS cargo FROM Funcionario WHERE Ativo = 1 ORDER BY Nome"
        );
        return rows.map(row => ({ id: Number(row.id), nome: row.nome, cargo: row.cargo }));
    }

    async buscarFuncionarioAtivo(banco, id) {
        const rows = await banco.ExecutaComando(
            "SELECT Id AS id, Nome AS nome FROM Funcionario WHERE Id = ? AND Ativo = 1 LIMIT 1 FOR UPDATE", [id]
        );
        return rows.length ? { id: Number(rows[0].id), nome: rows[0].nome } : null;
    }

    async cadastrar(banco, ajuste) {
        const id = await banco.ExecutaComandoLastInserted(
            "INSERT INTO AjusteEstoque (DataHora, FuncionarioId, SolicitanteId) VALUES (CURRENT_TIMESTAMP, ?, ?)",
            [ajuste.funcionarioId, ajuste.solicitanteId]
        );
        if (!id) return false;
        ajuste.id = id;
        for (const item of ajuste.itens) {
            await banco.ExecutaComandoNonQuery(
                `INSERT INTO ItemAjusteEstoque
                    (AjusteEstoqueId, LoteId, QuantidadeNova, Diferenca, Justificativa)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, item.loteId, item.quantidadeFisica, item.diferenca, item.justificativa]
            );
        }
        return true;
    }

    toJSON() {
        return {
            id: this.id, dataHora: this.dataHora,
            funcionarioId: this.funcionarioId, funcionarioNome: this.funcionarioNome,
            solicitanteId: this.solicitanteId, solicitanteNome: this.solicitanteNome,
            itens: this.itens, quantidadeItens: this.itens.length,
            totalDiferenca: this.itens.reduce((total, item) => total + Math.abs(item.diferenca), 0)
        };
    }

    static toMap(row) {
        const solicitanteId = row.solicitanteId ?? row.SolicitanteId ?? null;
        return new AjusteEstoqueModel(
            Number(row.id ?? row.Id), row.dataHora ?? row.DataHora,
            Number(row.funcionarioId ?? row.FuncionarioId),
            row.funcionarioNome ?? row.FuncionarioNome ?? "", [],
            solicitanteId === null ? null : Number(solicitanteId),
            row.solicitanteNome ?? row.SolicitanteNome ?? null
        );
    }
}
