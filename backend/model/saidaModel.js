import Entity from "./entity.js";

export default class SaidaModel extends Entity {
    constructor(id = 0, dataSaida = "", observacao = null, funcionarioId = 0, funcionarioNome = "", destinatarioId = 0, destinatarioNome = "", produtos = []) {
        super();
        this.id = id;
        this.dataSaida = dataSaida;
        this.observacao = observacao;
        this.funcionarioId = funcionarioId;
        this.funcionarioNome = funcionarioNome;
        this.destinatarioId = destinatarioId;
        this.destinatarioNome = destinatarioNome;
        this.produtos = produtos;
    }

    async listar(banco, busca = "") {
        const valores = [];
        let where = "";
        if (busca) {
            const termo = `%${busca}%`;
            where = `WHERE CAST(s.Id AS CHAR) LIKE ? OR responsavel.Nome LIKE ? OR destinatario.Nome LIKE ?
                OR s.Observacao LIKE ? OR EXISTS (
                    SELECT 1 FROM ItemSaida buscaItem
                    JOIN Lote buscaLote ON buscaLote.Id = buscaItem.LoteId
                    JOIN Produto buscaProduto ON buscaProduto.Id = buscaLote.ProdutoId
                    WHERE buscaItem.SaidaId = s.Id AND buscaProduto.Nome LIKE ?
                )`;
            valores.push(termo, termo, termo, termo, termo);
        }
        const rows = await banco.ExecutaComando(
            `SELECT s.Id AS id, DATE_FORMAT(s.DataSaida, '%Y-%m-%d %H:%i:%s') AS dataSaida,
                    s.Observacao AS observacao, s.FuncionarioId AS funcionarioId,
                    responsavel.Nome AS funcionarioNome, s.DestinatarioId AS destinatarioId,
                    destinatario.Nome AS destinatarioNome,
                    COUNT(DISTINCT l.ProdutoId) AS quantidadeProdutos,
                    COALESCE(SUM(i.Quantidade), 0) AS totalUnidades
               FROM Saida s
               JOIN Funcionario responsavel ON responsavel.Id = s.FuncionarioId
               JOIN Funcionario destinatario ON destinatario.Id = s.DestinatarioId
          LEFT JOIN ItemSaida i ON i.SaidaId = s.Id
          LEFT JOIN Lote l ON l.Id = i.LoteId
              ${where}
           GROUP BY s.Id, s.DataSaida, s.Observacao, s.FuncionarioId, responsavel.Nome,
                    s.DestinatarioId, destinatario.Nome
           ORDER BY s.DataSaida DESC, s.Id DESC`,
            valores
        );
        return rows.map(row => ({
            ...SaidaModel.toMap(row).toJSON(),
            quantidadeProdutos: Number(row.quantidadeProdutos),
            totalUnidades: Number(row.totalUnidades)
        }));
    }

    async buscarPorId(banco, id) {
        const rows = await banco.ExecutaComando(
            `SELECT s.Id AS id, DATE_FORMAT(s.DataSaida, '%Y-%m-%d %H:%i:%s') AS dataSaida,
                    s.Observacao AS observacao, s.FuncionarioId AS funcionarioId,
                    responsavel.Nome AS funcionarioNome, s.DestinatarioId AS destinatarioId,
                    destinatario.Nome AS destinatarioNome
               FROM Saida s
               JOIN Funcionario responsavel ON responsavel.Id = s.FuncionarioId
               JOIN Funcionario destinatario ON destinatario.Id = s.DestinatarioId
              WHERE s.Id = ?`,
            [id]
        );
        if (!rows.length) return null;
        const saida = SaidaModel.toMap(rows[0]);
        saida.produtos = await this.listarProdutos(banco, id);
        return saida;
    }

    async listarProdutos(banco, saidaId) {
        const rows = await banco.ExecutaComando(
            `SELECT p.Id AS produtoId, p.Nome AS produtoNome, i.Id AS itemId,
                    i.Quantidade AS quantidade, l.Id AS loteId, l.CodigoLote AS codigoLote,
                    DATE_FORMAT(l.DataValidade, '%Y-%m-%d') AS dataValidade
               FROM ItemSaida i
               JOIN Lote l ON l.Id = i.LoteId
               JOIN Produto p ON p.Id = l.ProdutoId
              WHERE i.SaidaId = ?
           ORDER BY p.Nome, l.DataValidade IS NULL, l.DataValidade, l.Id`,
            [saidaId]
        );
        const produtos = new Map();
        for (const row of rows) {
            const produtoId = Number(row.produtoId);
            if (!produtos.has(produtoId)) {
                produtos.set(produtoId, { produtoId, produtoNome: row.produtoNome, quantidade: 0, lotes: [] });
            }
            const produto = produtos.get(produtoId);
            const quantidade = Number(row.quantidade);
            produto.quantidade += quantidade;
            produto.lotes.push({
                itemId: Number(row.itemId), loteId: Number(row.loteId), codigoLote: row.codigoLote,
                dataValidade: row.dataValidade ?? null, quantidade
            });
        }
        return [...produtos.values()];
    }

    async buscarFuncionariosAtivos(banco) {
        const rows = await banco.ExecutaComando(
            "SELECT Id AS id, Nome AS nome, Cargo AS cargo FROM Funcionario WHERE Ativo = 1 ORDER BY Nome"
        );
        return rows.map(row => ({ id: Number(row.id), nome: row.nome, cargo: row.cargo }));
    }

    async buscarProdutos(banco, ids) {
        if (!ids.length) return [];
        const marcadores = ids.map(() => "?").join(", ");
        const rows = await banco.ExecutaComando(
            `SELECT Id AS id, Nome AS nome, Ativo AS ativo
               FROM Produto WHERE Id IN (${marcadores}) ORDER BY Id FOR UPDATE`, ids
        );
        return rows.map(row => ({ id: Number(row.id), nome: row.nome, ativo: Boolean(row.ativo) }));
    }

    async buscarLotes(banco, ids) {
        if (!ids.length) return [];
        const marcadores = ids.map(() => "?").join(", ");
        const rows = await banco.ExecutaComando(
            `SELECT l.Id AS id, l.CodigoLote AS codigoLote, l.QuantidadeDisponivel AS quantidadeDisponivel,
                    DATE_FORMAT(l.DataValidade, '%Y-%m-%d') AS dataValidade, l.ProdutoId AS produtoId
               FROM Lote l WHERE l.Id IN (${marcadores}) ORDER BY l.Id FOR UPDATE`, ids
        );
        return rows.map(row => ({
            id: Number(row.id), codigoLote: row.codigoLote,
            quantidadeDisponivel: Number(row.quantidadeDisponivel),
            dataValidade: row.dataValidade ?? null, produtoId: Number(row.produtoId)
        }));
    }

    async buscarFuncionarioAtivo(banco, id) {
        const rows = await banco.ExecutaComando(
            "SELECT Id AS id, Nome AS nome FROM Funcionario WHERE Id = ? AND Ativo = 1 LIMIT 1 FOR UPDATE", [id]
        );
        return rows.length ? { id: Number(rows[0].id), nome: rows[0].nome } : null;
    }

    async cadastrar(banco, saida, itens) {
        const id = await banco.ExecutaComandoLastInserted(
            `INSERT INTO Saida (DataSaida, Observacao, FuncionarioId, DestinatarioId)
                  VALUES (CURRENT_TIMESTAMP, ?, ?, ?)`,
            [saida.observacao, saida.funcionarioId, saida.destinatarioId]
        );
        if (!id) return false;
        saida.id = id;
        for (const item of itens) {
            await banco.ExecutaComandoNonQuery(
                "INSERT INTO ItemSaida (Quantidade, SaidaId, LoteId) VALUES (?, ?, ?)",
                [item.quantidade, id, item.loteId]
            );
        }
        return true;
    }

    toJSON() {
        return {
            id: this.id, dataSaida: this.dataSaida, observacao: this.observacao,
            funcionarioId: this.funcionarioId, funcionarioNome: this.funcionarioNome,
            destinatarioId: this.destinatarioId, destinatarioNome: this.destinatarioNome,
            produtos: this.produtos,
            quantidadeProdutos: this.produtos.length,
            totalUnidades: this.produtos.reduce((total, produto) => total + produto.quantidade, 0)
        };
    }

    static toMap(row) {
        return new SaidaModel(
            Number(row.id ?? row.Id), row.dataSaida ?? row.DataSaida,
            row.observacao ?? row.Observacao ?? null,
            Number(row.funcionarioId ?? row.FuncionarioId), row.funcionarioNome ?? row.FuncionarioNome ?? "",
            Number(row.destinatarioId ?? row.DestinatarioId), row.destinatarioNome ?? row.DestinatarioNome ?? "", []
        );
    }
}
