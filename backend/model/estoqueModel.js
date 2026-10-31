export default class EstoqueModel {
    async atualizarPorEntrada(banco, itens) {
        return this.aplicarDeltas(banco, this.#consolidar(itens, 1));
    }

    async atualizarPorSaida(banco, itens) {
        return this.aplicarDeltas(banco, this.#consolidar(itens, -1));
    }

    async reverterMovimentacao(banco, itens, tipo) {
        if (!["entrada", "saida"].includes(tipo)) return { tipo: "movimentacao_invalida" };
        return this.aplicarDeltas(banco, this.#consolidar(itens, tipo === "entrada" ? -1 : 1));
    }

    async atualizarPorAjuste(banco, itens) {
        if (!Array.isArray(itens) || !itens.length) return { tipo: "ajuste_invalido" };
        const deltas = new Map();
        for (const item of itens) {
            if (!Number.isSafeInteger(item.loteId) || item.loteId <= 0 ||
                !Number.isSafeInteger(item.diferenca) || item.diferenca === 0 || deltas.has(item.loteId)) {
                return { tipo: "ajuste_invalido" };
            }
            deltas.set(item.loteId, item.diferenca);
        }
        return this.aplicarDeltas(banco, deltas);
    }

    async consultarEstoque(banco, { nome = "", categoriaId = null, validadeInicio = null, validadeFim = null } = {}) {
        const filtros = ["p.Ativo = 1"];
        const valores = [];
        if (nome) {
            filtros.push("p.Nome LIKE ?");
            valores.push(`%${nome}%`);
        }
        if (categoriaId) {
            filtros.push("p.CategoriaId = ?");
            valores.push(categoriaId);
        }
        const produtos = await banco.ExecutaComando(
            `SELECT p.Id AS id, p.Nome AS nome, c.Id AS categoriaId, c.Nome AS categoriaNome,
                    COALESCE((SELECT SUM(l.QuantidadeDisponivel) FROM Lote l WHERE l.ProdutoId = p.Id), 0) AS quantidadeTotal
               FROM Produto p
               JOIN Categoria c ON c.Id = p.CategoriaId
              WHERE ${filtros.join(" AND ")}
           ORDER BY p.Nome, p.Id`,
            valores
        );
        if (!produtos.length) return [];

        const lotes = await banco.ExecutaComando(
            `SELECT l.Id AS id, l.ProdutoId AS produtoId, l.CodigoLote AS codigoLote,
                    l.QuantidadeDisponivel AS quantidadeDisponivel,
                    DATE_FORMAT(l.DataValidade, '%Y-%m-%d') AS dataValidade,
                    DATEDIFF(l.DataValidade, CURDATE()) AS diasParaVencer
               FROM Lote l
              WHERE l.ProdutoId IN (?) AND l.QuantidadeDisponivel > 0
           ORDER BY l.DataValidade IS NULL, l.DataValidade, l.Id`,
            [produtos.map(produto => Number(produto.id))]
        );
        const filtrarValidade = Boolean(validadeInicio || validadeFim);
        const lotesPorProduto = new Map();
        for (const row of lotes) {
            const dataValidade = row.dataValidade ?? null;
            // Com período informado, só entram os lotes com validade dentro dele.
            if (filtrarValidade && (!dataValidade ||
                (validadeInicio && dataValidade < validadeInicio) || (validadeFim && dataValidade > validadeFim))) continue;
            const dias = row.diasParaVencer === null ? null : Number(row.diasParaVencer);
            const lote = {
                id: Number(row.id),
                codigoLote: row.codigoLote || "1",
                quantidadeDisponivel: Number(row.quantidadeDisponivel),
                dataValidade,
                alerta: dias === null ? null : dias < 0 ? "Lote vencido" : dias <= 30 ? "Próximo do vencimento" : null
            };
            const produtoId = Number(row.produtoId);
            lotesPorProduto.set(produtoId, [...(lotesPorProduto.get(produtoId) ?? []), lote]);
        }

        return produtos
            .map(row => {
                const lotesProduto = lotesPorProduto.get(Number(row.id)) ?? [];
                const quantidadeTotal = Number(row.quantidadeTotal);
                return {
                    id: Number(row.id),
                    nome: row.nome,
                    categoriaId: Number(row.categoriaId),
                    categoriaNome: row.categoriaNome,
                    quantidadeTotal,
                    estoqueZerado: quantidadeTotal === 0,
                    lotesVencidos: lotesProduto.filter(lote => lote.alerta === "Lote vencido").length,
                    lotesProximosVencimento: lotesProduto.filter(lote => lote.alerta === "Próximo do vencimento").length,
                    lotes: lotesProduto
                };
            })
            .filter(produto => !filtrarValidade || produto.lotes.length);
    }

    async removerLotesSemMovimentacao(banco, ids) {
        const removidos = [];
        for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
            const removido = await banco.ExecutaComandoNonQuery(
                `DELETE FROM Lote
                  WHERE Id = ? AND QuantidadeDisponivel = 0
                    AND NOT EXISTS (SELECT 1 FROM ItemEntrada WHERE LoteId = ?)
                    AND NOT EXISTS (SELECT 1 FROM ItemSaida WHERE LoteId = ?)
                    AND NOT EXISTS (SELECT 1 FROM ItemAjusteEstoque WHERE LoteId = ?)`,
                [id, id, id, id]
            );
            if (removido) removidos.push(id);
        }
        return removidos;
    }

    async buscarLotePorId(banco, id, produtoId) {
        const rows = await banco.ExecutaComando(
            `SELECT Id AS id, CodigoLote AS codigoLote,
                    QuantidadeDisponivel AS quantidadeDisponivel,
                    DATE_FORMAT(DataValidade, '%Y-%m-%d') AS dataValidade,
                    ProdutoId AS produtoId
               FROM Lote
              WHERE Id = ? AND ProdutoId = ?
              FOR UPDATE`,
            [id, produtoId]
        );
        return rows.length ? this.#mapearLote(rows[0]) : null;
    }

    async buscarLotePorCodigo(banco, produtoId, codigoLote) {
        const rows = await banco.ExecutaComando(
            `SELECT Id AS id, CodigoLote AS codigoLote,
                    QuantidadeDisponivel AS quantidadeDisponivel,
                    DATE_FORMAT(DataValidade, '%Y-%m-%d') AS dataValidade,
                    ProdutoId AS produtoId
               FROM Lote
              WHERE ProdutoId = ? AND CodigoLote = ?
              ORDER BY Id
              LIMIT 1
              FOR UPDATE`,
            [produtoId, codigoLote]
        );
        return rows.length ? this.#mapearLote(rows[0]) : null;
    }

    async criarLote(banco, produtoId, codigoLote, dataValidade) {
        const id = await banco.ExecutaComandoLastInserted(
            `INSERT INTO Lote (CodigoLote, QuantidadeDisponivel, DataValidade, ProdutoId)
                  VALUES (?, 0, ?, ?)`,
            [codigoLote, dataValidade, produtoId]
        );
        return id ? { id, codigoLote, quantidadeDisponivel: 0, dataValidade, produtoId } : null;
    }

    async aplicarDeltas(banco, deltas) {
        const ids = [...deltas.keys()].sort((a, b) => a - b);
        if (!ids.length) return { tipo: "ok" };
        const rows = await this.#bloquearLotes(banco, ids);
        if (rows.length !== ids.length) return { tipo: "lote_nao_encontrado" };

        for (const row of rows) {
            const saldo = Number(row.quantidadeDisponivel) + deltas.get(Number(row.id));
            if (!Number.isSafeInteger(saldo) || saldo < 0) {
                return { tipo: "saldo_insuficiente", loteId: Number(row.id), saldoAtual: Number(row.quantidadeDisponivel) };
            }
        }
        for (const row of rows) {
            await banco.ExecutaComandoNonQuery(
                "UPDATE Lote SET QuantidadeDisponivel = QuantidadeDisponivel + ? WHERE Id = ?",
                [deltas.get(Number(row.id)), Number(row.id)]
            );
        }
        return { tipo: "ok" };
    }

    async #bloquearLotes(banco, ids) {
        if (!ids.length) return [];
        const marcadores = ids.map(() => "?").join(", ");
        return banco.ExecutaComando(
            `SELECT Id AS id, QuantidadeDisponivel AS quantidadeDisponivel
               FROM Lote
              WHERE Id IN (${marcadores})
              ORDER BY Id
              FOR UPDATE`,
            ids
        );
    }

    #consolidar(itens, fator) {
        const deltas = new Map();
        for (const item of itens) {
            deltas.set(item.loteId, (deltas.get(item.loteId) ?? 0) + item.quantidade * fator);
        }
        return deltas;
    }

    #mapearLote(row) {
        return {
            id: Number(row.id),
            codigoLote: row.codigoLote,
            quantidadeDisponivel: Number(row.quantidadeDisponivel),
            dataValidade: row.dataValidade ?? null,
            produtoId: Number(row.produtoId)
        };
    }
}
