import Entity from "./entity.js";

export default class EntradaModel extends Entity {
    constructor(id = 0, pedidoCompraId = 0, funcionarioId = 0, funcionarioNome = "", dataEntrada = "", observacao = null, situacao = "Ativa", itens = []) {
        super();
        this.id = id;
        this.pedidoCompraId = pedidoCompraId;
        this.funcionarioId = funcionarioId;
        this.funcionarioNome = funcionarioNome;
        this.dataEntrada = dataEntrada;
        this.observacao = observacao;
        this.situacao = situacao;
        this.itens = itens;
    }

    async listar(banco, busca = "", situacao = "Todas") {
        const filtros = [];
        const valores = [];
        if (situacao !== "Todas") {
            filtros.push("e.Situacao = ?");
            valores.push(situacao);
        }
        if (busca) {
            const termo = `%${busca}%`;
            filtros.push(`(CAST(e.Id AS CHAR) LIKE ? OR CAST(e.PedidoCompraId AS CHAR) LIKE ?
                OR f.Nome LIKE ? OR e.Observacao LIKE ? OR EXISTS (
                    SELECT 1 FROM ItemEntrada ieBusca
                    JOIN Lote lBusca ON lBusca.Id = ieBusca.LoteId
                    JOIN Produto pBusca ON pBusca.Id = lBusca.ProdutoId
                    WHERE ieBusca.EntradaId = e.Id AND pBusca.Nome LIKE ?
                ))`);
            valores.push(termo, termo, termo, termo, termo);
        }
        const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
        const rows = await banco.ExecutaComando(
            `SELECT e.Id AS id, e.PedidoCompraId AS pedidoCompraId,
                    e.FuncionarioId AS funcionarioId, f.Nome AS funcionarioNome,
                    DATE_FORMAT(e.DataEntrada, '%Y-%m-%d') AS dataEntrada,
                    e.Observacao AS observacao, e.Situacao AS situacao,
                    COUNT(ie.Id) AS quantidadeItens,
                    COALESCE(SUM(ie.Quantidade), 0) AS totalUnidades
               FROM Entrada e
               JOIN Funcionario f ON f.Id = e.FuncionarioId
          LEFT JOIN ItemEntrada ie ON ie.EntradaId = e.Id
              ${where}
           GROUP BY e.Id, e.PedidoCompraId, e.FuncionarioId, f.Nome,
                    e.DataEntrada, e.Observacao, e.Situacao
           ORDER BY e.DataEntrada DESC, e.Id DESC`,
            valores
        );
        return rows.map(row => ({
            ...EntradaModel.toMap(row).toJSON(),
            quantidadeItens: Number(row.quantidadeItens),
            totalUnidades: Number(row.totalUnidades)
        }));
    }

    async buscarPorId(banco, id, bloquear = false) {
        const rows = await banco.ExecutaComando(
            `SELECT e.Id AS id, e.PedidoCompraId AS pedidoCompraId,
                    e.FuncionarioId AS funcionarioId, f.Nome AS funcionarioNome,
                    DATE_FORMAT(e.DataEntrada, '%Y-%m-%d') AS dataEntrada,
                    e.Observacao AS observacao, e.Situacao AS situacao
               FROM Entrada e
               JOIN Funcionario f ON f.Id = e.FuncionarioId
              WHERE e.Id = ?${bloquear ? " FOR UPDATE" : ""}`,
            [id]
        );
        if (!rows.length) return null;
        const entrada = EntradaModel.toMap(rows[0]);
        entrada.itens = await this.listarItens(banco, id, bloquear);
        return entrada;
    }

    async listarItens(banco, entradaId, bloquear = false) {
        const rows = await banco.ExecutaComando(
            `SELECT ie.Id AS id, ie.LoteId AS loteId, ie.Quantidade AS quantidade,
                    l.CodigoLote AS codigoLote,
                    DATE_FORMAT(l.DataValidade, '%Y-%m-%d') AS dataValidade,
                    l.ProdutoId AS produtoId, p.Nome AS produtoNome
               FROM ItemEntrada ie
               JOIN Lote l ON l.Id = ie.LoteId
               JOIN Produto p ON p.Id = l.ProdutoId
              WHERE ie.EntradaId = ?
              ORDER BY ie.Id${bloquear ? " FOR UPDATE" : ""}`,
            [entradaId]
        );
        return rows.map(row => ({
            id: Number(row.id), loteId: Number(row.loteId), quantidade: Number(row.quantidade),
            codigoLote: row.codigoLote, dataValidade: row.dataValidade ?? null,
            produtoId: Number(row.produtoId), produtoNome: row.produtoNome
        }));
    }

    async recebidosPorPedido(banco, pedidoId, excluirEntradaId = null) {
        const valores = [pedidoId];
        const exclusao = excluirEntradaId === null ? "" : " AND e.Id <> ?";
        if (excluirEntradaId !== null) valores.push(excluirEntradaId);
        const rows = await banco.ExecutaComando(
            `SELECT l.ProdutoId AS produtoId, COALESCE(SUM(ie.Quantidade), 0) AS quantidade
               FROM Entrada e
               JOIN ItemEntrada ie ON ie.EntradaId = e.Id
               JOIN Lote l ON l.Id = ie.LoteId
              WHERE e.PedidoCompraId = ? AND e.Situacao = 'Ativa'${exclusao}
           GROUP BY l.ProdutoId`,
            valores
        );
        return new Map(rows.map(row => [Number(row.produtoId), Number(row.quantidade)]));
    }

    async cadastrar(banco, entrada) {
        const id = await banco.ExecutaComandoLastInserted(
            `INSERT INTO Entrada (PedidoCompraId, FuncionarioId, DataEntrada, Observacao, Situacao)
                  VALUES (?, ?, ?, ?, 'Ativa')`,
            [entrada.pedidoCompraId, entrada.funcionarioId, entrada.dataEntrada, entrada.observacao]
        );
        if (!id) return false;
        entrada.id = id;
        await this.substituirItens(banco, id, entrada.itens);
        return true;
    }

    async atualizar(banco, entrada) {
        await banco.ExecutaComandoNonQuery(
            `UPDATE Entrada
                SET PedidoCompraId = ?, DataEntrada = ?, Observacao = ?
              WHERE Id = ? AND Situacao = 'Ativa'`,
            [entrada.pedidoCompraId, entrada.dataEntrada, entrada.observacao, entrada.id]
        );
        await this.substituirItens(banco, entrada.id, entrada.itens);
        return true;
    }

    async substituirItens(banco, entradaId, itens) {
        await banco.ExecutaComandoNonQuery("DELETE FROM ItemEntrada WHERE EntradaId = ?", [entradaId]);
        for (const item of itens) {
            await banco.ExecutaComandoNonQuery(
                "INSERT INTO ItemEntrada (EntradaId, LoteId, Quantidade) VALUES (?, ?, ?)",
                [entradaId, item.loteId, item.quantidade]
            );
        }
    }

    async cancelar(banco, id) {
        return banco.ExecutaComandoNonQuery(
            "UPDATE Entrada SET Situacao = 'Cancelada' WHERE Id = ? AND Situacao = 'Ativa'",
            [id]
        );
    }

    toJSON() {
        return {
            id: this.id,
            pedidoCompraId: this.pedidoCompraId,
            funcionarioId: this.funcionarioId,
            funcionarioNome: this.funcionarioNome,
            dataEntrada: this.dataEntrada,
            observacao: this.observacao,
            situacao: this.situacao,
            itens: this.itens,
            quantidadeItens: this.itens.length,
            totalUnidades: this.itens.reduce((total, item) => total + item.quantidade, 0)
        };
    }

    static toMap(row) {
        return new EntradaModel(
            Number(row.id ?? row.Id), Number(row.pedidoCompraId ?? row.PedidoCompraId),
            Number(row.funcionarioId ?? row.FuncionarioId), row.funcionarioNome ?? row.FuncionarioNome ?? "",
            row.dataEntrada ?? row.DataEntrada, row.observacao ?? row.Observacao ?? null,
            row.situacao ?? row.Situacao, []
        );
    }
}
