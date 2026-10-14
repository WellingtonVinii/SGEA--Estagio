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
        const quantidades = new Map();
        for (const item of itens) {
            if (!Number.isSafeInteger(item.loteId) || item.loteId <= 0 ||
                !Number.isSafeInteger(item.quantidadeFisica) || item.quantidadeFisica < 0 || quantidades.has(item.loteId)) {
                return { tipo: "ajuste_invalido" };
            }
            quantidades.set(item.loteId, item.quantidadeFisica);
        }
        const ids = [...quantidades.keys()].sort((a, b) => a - b);
        const rows = await this.#bloquearLotes(banco, ids);
        if (rows.length !== ids.length) return { tipo: "lote_nao_encontrado" };
        for (const row of rows) {
            await banco.ExecutaComandoNonQuery(
                "UPDATE Lote SET QuantidadeDisponivel = ? WHERE Id = ?",
                [quantidades.get(Number(row.id)), Number(row.id)]
            );
        }
        return { tipo: "ok" };
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
