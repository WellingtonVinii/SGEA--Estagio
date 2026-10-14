import Entity from "./entity.js";

export default class PedidoCompraModel extends Entity {
    constructor(
        id = 0,
        dataSolicitacao = "",
        situacao = "Pendente",
        observacao = null,
        funcionarioId = 0,
        funcionarioNome = "",
        itens = [],
        quantidadeItens = 0,
        totalUnidades = 0
    ) {
        super();
        this.id = id;
        this.dataSolicitacao = dataSolicitacao;
        this.situacao = situacao;
        this.observacao = observacao;
        this.funcionarioId = funcionarioId;
        this.funcionarioNome = funcionarioNome;
        this.itens = itens;
        this.quantidadeItens = quantidadeItens;
        this.totalUnidades = totalUnidades;
    }

    async listar(banco, situacao = "Todas", busca = "") {
        const filtros = [];
        const valores = [];
        if (situacao !== "Todas") {
            filtros.push("pc.Situacao = ?");
            valores.push(situacao);
        }
        if (busca) {
            filtros.push(`(CAST(pc.Id AS CHAR) LIKE ? OR f.Nome LIKE ? OR pc.Observacao LIKE ? OR EXISTS (
                SELECT 1 FROM ItemPedidoCompra ipBusca
                JOIN Produto pBusca ON pBusca.Id = ipBusca.ProdutoId
                WHERE ipBusca.PedidoCompraId = pc.Id AND pBusca.Nome LIKE ?
            ))`);
            const termo = `%${busca}%`;
            valores.push(termo, termo, termo, termo);
        }
        const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
        const rows = await banco.ExecutaComando(
            `SELECT pc.Id AS id, DATE_FORMAT(pc.DataSolicitacao, '%Y-%m-%d') AS dataSolicitacao,
                    pc.Situacao AS situacao, pc.Observacao AS observacao,
                    f.Id AS funcionarioId, f.Nome AS funcionarioNome,
                    COUNT(ip.ProdutoId) AS quantidadeItens,
                    COALESCE(SUM(ip.Quantidade), 0) AS totalUnidades
               FROM PedidoCompra pc
               JOIN Funcionario f ON f.Id = pc.FuncionarioId
          LEFT JOIN ItemPedidoCompra ip ON ip.PedidoCompraId = pc.Id
              ${where}
           GROUP BY pc.Id, pc.DataSolicitacao, pc.Situacao, pc.Observacao, f.Id, f.Nome
           ORDER BY pc.DataSolicitacao DESC, pc.Id DESC`,
            valores
        );
        return rows.map(row => PedidoCompraModel.toMap(row));
    }

    async buscarPorId(banco, id, bloquear = false) {
        const rows = await banco.ExecutaComando(
            `SELECT pc.Id AS id, DATE_FORMAT(pc.DataSolicitacao, '%Y-%m-%d') AS dataSolicitacao,
                    pc.Situacao AS situacao, pc.Observacao AS observacao,
                    f.Id AS funcionarioId, f.Nome AS funcionarioNome
               FROM PedidoCompra pc
               JOIN Funcionario f ON f.Id = pc.FuncionarioId
              WHERE pc.Id = ?${bloquear ? " FOR UPDATE" : ""}`,
            [id]
        );
        if (!rows.length) return null;
        const pedido = PedidoCompraModel.toMap(rows[0]);
        pedido.itens = await this.listarItens(banco, id);
        pedido.quantidadeItens = pedido.itens.length;
        pedido.totalUnidades = pedido.itens.reduce((total, item) => total + item.quantidade, 0);
        return pedido;
    }

    async listarItens(banco, pedidoId) {
        const rows = await banco.ExecutaComando(
            `SELECT ip.ProdutoId AS produtoId, p.Nome AS produtoNome,
                    ip.Quantidade AS quantidade, p.Ativo AS produtoAtivo,
                    COALESCE((
                        SELECT SUM(ie.Quantidade)
                          FROM Entrada e
                          JOIN ItemEntrada ie ON ie.EntradaId = e.Id
                          JOIN Lote l ON l.Id = ie.LoteId
                         WHERE e.PedidoCompraId = ip.PedidoCompraId
                           AND e.Situacao = 'Ativa'
                           AND l.ProdutoId = ip.ProdutoId
                    ), 0) AS quantidadeRecebida
               FROM ItemPedidoCompra ip
               JOIN Produto p ON p.Id = ip.ProdutoId
              WHERE ip.PedidoCompraId = ?
           ORDER BY p.Nome`,
            [pedidoId]
        );
        return rows.map(row => {
            const quantidade = Number(row.quantidade);
            const quantidadeRecebida = Number(row.quantidadeRecebida);
            return {
                produtoId: Number(row.produtoId), produtoNome: row.produtoNome,
                quantidade, produtoAtivo: Boolean(row.produtoAtivo), quantidadeRecebida,
                quantidadePendente: Math.max(0, quantidade - quantidadeRecebida)
            };
        });
    }

    async buscarProdutos(banco, ids) {
        if (!ids.length) return [];
        const marcadores = ids.map(() => "?").join(", ");
        const rows = await banco.ExecutaComando(
            `SELECT Id AS id, Nome AS nome, Ativo AS ativo FROM Produto WHERE Id IN (${marcadores})`,
            ids
        );
        return rows.map(row => ({ id: Number(row.id), nome: row.nome, ativo: Boolean(row.ativo) }));
    }

    async cadastrar(banco, pedido) {
        const id = await banco.ExecutaComandoLastInserted(
            `INSERT INTO PedidoCompra (DataSolicitacao, Situacao, Observacao, FuncionarioId)
                  VALUES (?, 'Pendente', ?, ?)`,
            [pedido.dataSolicitacao, pedido.observacao, pedido.funcionarioId]
        );
        if (!id) return false;
        pedido.id = id;
        await this.inserirItens(banco, id, pedido.itens);
        return true;
    }

    async atualizar(banco, pedido) {
        await banco.ExecutaComandoNonQuery(
            "UPDATE PedidoCompra SET DataSolicitacao = ?, Observacao = ? WHERE Id = ? AND Situacao = 'Pendente'",
            [pedido.dataSolicitacao, pedido.observacao, pedido.id]
        );
        await banco.ExecutaComandoNonQuery("DELETE FROM ItemPedidoCompra WHERE PedidoCompraId = ?", [pedido.id]);
        await this.inserirItens(banco, pedido.id, pedido.itens);
        return true;
    }

    async inserirItens(banco, pedidoId, itens) {
        for (const item of itens) {
            await banco.ExecutaComandoNonQuery(
                "INSERT INTO ItemPedidoCompra (PedidoCompraId, ProdutoId, Quantidade) VALUES (?, ?, ?)",
                [pedidoId, item.produtoId, item.quantidade]
            );
        }
    }

    async alterarSituacao(banco, id, situacao) {
        return banco.ExecutaComandoNonQuery(
            "UPDATE PedidoCompra SET Situacao = ? WHERE Id = ? AND Situacao IN ('Pendente', 'Parcialmente Recebido')",
            [situacao, id]
        );
    }

    async atualizarSituacaoRecebimento(banco, id) {
        const rows = await banco.ExecutaComando(
            "SELECT Situacao AS situacao FROM PedidoCompra WHERE Id = ? FOR UPDATE",
            [id]
        );
        if (!rows.length) return false;
        if (rows[0].situacao === "Cancelado") return true;

        const itens = await this.listarItens(banco, id);
        const algumRecebido = itens.some(item => item.quantidadeRecebida > 0);
        const todosRecebidos = itens.length > 0 && itens.every(item => item.quantidadeRecebida >= item.quantidade);
        const situacao = todosRecebidos ? "Recebido" : algumRecebido ? "Parcialmente Recebido" : "Pendente";
        await banco.ExecutaComandoNonQuery("UPDATE PedidoCompra SET Situacao = ? WHERE Id = ?", [situacao, id]);
        return true;
    }

    toJSON() {
        return {
            id: this.id,
            dataSolicitacao: this.dataSolicitacao,
            situacao: this.situacao,
            observacao: this.observacao,
            funcionarioId: this.funcionarioId,
            funcionarioNome: this.funcionarioNome,
            itens: this.itens,
            quantidadeItens: this.quantidadeItens,
            totalUnidades: this.totalUnidades
        };
    }

    static toMap(row) {
        return new PedidoCompraModel(
            Number(row.id ?? row.Id),
            row.dataSolicitacao ?? row.DataSolicitacao,
            row.situacao ?? row.Situacao,
            row.observacao ?? row.Observacao ?? null,
            Number(row.funcionarioId ?? row.FuncionarioId),
            row.funcionarioNome ?? row.FuncionarioNome,
            [],
            Number(row.quantidadeItens ?? 0),
            Number(row.totalUnidades ?? 0)
        );
    }
}
