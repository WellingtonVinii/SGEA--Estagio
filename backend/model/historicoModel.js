export default class HistoricoModel {
    // Reúne os itens de entradas, saídas e ajustes em uma única linha do tempo.
    async listar(banco, { dataInicio = null, dataFim = null, produto = "", funcionarioId = null, tipo = null } = {}) {
        const filtros = [];
        const valores = [];
        if (produto) {
            filtros.push("m.produtoNome LIKE ?");
            valores.push(`%${produto}%`);
        }
        if (funcionarioId) {
            filtros.push("m.funcionarioId = ?");
            valores.push(funcionarioId);
        }
        if (tipo) {
            filtros.push("m.tipo = ?");
            valores.push(tipo);
        }
        if (dataInicio) {
            filtros.push("m.dataHora >= ?");
            valores.push(dataInicio);
        }
        if (dataFim) {
            filtros.push("m.dataHora < DATE_ADD(?, INTERVAL 1 DAY)");
            valores.push(dataFim);
        }
        const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
        const rows = await banco.ExecutaComando(
            `SELECT m.tipo, m.movimentacaoId, DATE_FORMAT(m.dataHora, '%Y-%m-%d %H:%i:%s') AS dataHora, m.possuiHora,
                    m.funcionarioId, m.funcionarioNome, m.complementoRotulo, m.complemento, m.observacao,
                    m.itemId, m.produtoNome, m.codigoLote, DATE_FORMAT(m.dataValidade, '%Y-%m-%d') AS dataValidade,
                    m.quantidade, m.justificativa
               FROM (
                    SELECT 'Entrada' AS tipo, e.Id AS movimentacaoId, TIMESTAMP(e.DataEntrada) AS dataHora, 0 AS possuiHora,
                           f.Id AS funcionarioId, f.Nome AS funcionarioNome, 'Pedido de compra' AS complementoRotulo,
                           IF(e.PedidoCompraId IS NULL, 'Sem pedido', CONCAT('#', e.PedidoCompraId)) AS complemento,
                           e.Observacao AS observacao, ie.Id AS itemId, p.Nome AS produtoNome, l.CodigoLote AS codigoLote,
                           l.DataValidade AS dataValidade, ie.Quantidade AS quantidade, NULL AS justificativa
                      FROM Entrada e
                      JOIN Funcionario f ON f.Id = e.FuncionarioId
                      JOIN ItemEntrada ie ON ie.EntradaId = e.Id
                      JOIN Lote l ON l.Id = ie.LoteId
                      JOIN Produto p ON p.Id = l.ProdutoId
                    UNION ALL
                    SELECT 'Saída', s.Id, s.DataSaida, 1, f.Id, f.Nome, 'Destinatário', d.Nome, s.Observacao,
                           i.Id, p.Nome, l.CodigoLote, l.DataValidade, -i.Quantidade, NULL
                      FROM Saida s
                      JOIN Funcionario f ON f.Id = s.FuncionarioId
                      JOIN Funcionario d ON d.Id = s.DestinatarioId
                      JOIN ItemSaida i ON i.SaidaId = s.Id
                      JOIN Lote l ON l.Id = i.LoteId
                      JOIN Produto p ON p.Id = l.ProdutoId
                    UNION ALL
                    SELECT 'Ajuste', a.Id, a.DataHora, 1, f.Id, f.Nome, 'Solicitante', COALESCE(sol.Nome, 'Não informado'), NULL,
                           i.Id, p.Nome, l.CodigoLote, l.DataValidade, i.Diferenca, i.Justificativa
                      FROM AjusteEstoque a
                      JOIN Funcionario f ON f.Id = a.FuncionarioId
                 LEFT JOIN Funcionario sol ON sol.Id = a.SolicitanteId
                      JOIN ItemAjusteEstoque i ON i.AjusteEstoqueId = a.Id
                      JOIN Lote l ON l.Id = i.LoteId
                      JOIN Produto p ON p.Id = l.ProdutoId
               ) m
              ${where}
           ORDER BY m.dataHora DESC, m.tipo, m.movimentacaoId DESC, m.itemId`,
            valores
        );

        const movimentacoes = new Map();
        for (const row of rows) {
            const chave = `${row.tipo}-${row.movimentacaoId}`;
            if (!movimentacoes.has(chave)) {
                movimentacoes.set(chave, {
                    chave,
                    tipo: row.tipo,
                    id: Number(row.movimentacaoId),
                    dataHora: row.dataHora,
                    possuiHora: Boolean(Number(row.possuiHora)),
                    funcionarioId: Number(row.funcionarioId),
                    funcionarioNome: row.funcionarioNome,
                    complementoRotulo: row.complementoRotulo,
                    complemento: row.complemento,
                    observacao: row.observacao ?? null,
                    itens: []
                });
            }
            movimentacoes.get(chave).itens.push({
                id: Number(row.itemId),
                produtoNome: row.produtoNome,
                codigoLote: row.codigoLote || "1",
                dataValidade: row.dataValidade ?? null,
                quantidade: Number(row.quantidade),
                justificativa: row.justificativa ?? null
            });
        }
        return [...movimentacoes.values()].map(movimentacao => ({
            ...movimentacao,
            totalUnidades: movimentacao.itens.reduce((total, item) => total + item.quantidade, 0)
        }));
    }

    // Funcionários que já registraram alguma movimentação, inclusive os inativos.
    async listarResponsaveis(banco) {
        const rows = await banco.ExecutaComando(
            `SELECT f.Id AS id, f.Nome AS nome
               FROM Funcionario f
              WHERE EXISTS (SELECT 1 FROM Entrada e WHERE e.FuncionarioId = f.Id)
                 OR EXISTS (SELECT 1 FROM Saida s WHERE s.FuncionarioId = f.Id)
                 OR EXISTS (SELECT 1 FROM AjusteEstoque a WHERE a.FuncionarioId = f.Id)
           ORDER BY f.Nome`
        );
        return rows.map(row => ({ id: Number(row.id), nome: row.nome }));
    }
}
