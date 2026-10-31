import test from "node:test";
import assert from "node:assert/strict";
import EstoqueModel from "../model/estoqueModel.js";

test("ajuste soma ou subtrai a diferença e mantém a ordem de bloqueio", async () => {
    const atualizacoes = [];
    const banco = {
        async ExecutaComando(sql, ids) {
            assert.match(sql, /FOR UPDATE/);
            assert.deepEqual(ids, [2, 7]);
            return [{ id: 2, quantidadeDisponivel: 10 }, { id: 7, quantidadeDisponivel: 3 }];
        },
        async ExecutaComandoNonQuery(sql, valores) {
            assert.match(sql, /QuantidadeDisponivel = QuantidadeDisponivel \+ \?/);
            atualizacoes.push(valores);
            return true;
        }
    };
    const resultado = await new EstoqueModel().atualizarPorAjuste(banco, [
        { loteId: 7, diferenca: 5 }, { loteId: 2, diferenca: -10 }
    ]);
    assert.deepEqual(resultado, { tipo: "ok" });
    assert.deepEqual(atualizacoes, [[-10, 2], [5, 7]]);
});

test("ajuste impede deixar o lote negativo sem atualizar nenhum lote", async () => {
    const banco = {
        async ExecutaComando() { return [{ id: 1, quantidadeDisponivel: 10 }, { id: 2, quantidadeDisponivel: 4 }]; },
        ExecutaComandoNonQuery() { assert.fail("nenhum lote deve ser atualizado"); }
    };
    const resultado = await new EstoqueModel().atualizarPorAjuste(banco, [
        { loteId: 1, diferenca: 3 }, { loteId: 2, diferenca: -5 }
    ]);
    assert.deepEqual(resultado, { tipo: "saldo_insuficiente", loteId: 2, saldoAtual: 4 });
});

test("ajuste rejeita diferença zero e lote repetido antes de consultar o banco", async () => {
    const banco = { ExecutaComando() { assert.fail("o banco não deveria ser consultado"); } };
    const estoque = new EstoqueModel();
    assert.deepEqual(await estoque.atualizarPorAjuste(banco, [
        { loteId: 1, diferenca: 0 }
    ]), { tipo: "ajuste_invalido" });
    assert.deepEqual(await estoque.atualizarPorAjuste(banco, [
        { loteId: 1, diferenca: 1 }, { loteId: 1, diferenca: -2 }
    ]), { tipo: "ajuste_invalido" });
});

test("ajuste não atualiza nada quando algum lote não existe", async () => {
    const banco = {
        async ExecutaComando() { return [{ id: 1, quantidadeDisponivel: 4 }]; },
        ExecutaComandoNonQuery() { assert.fail("nenhum lote deve ser atualizado"); }
    };
    const resultado = await new EstoqueModel().atualizarPorAjuste(banco, [
        { loteId: 1, diferenca: 2 }, { loteId: 2, diferenca: 3 }
    ]);
    assert.deepEqual(resultado, { tipo: "lote_nao_encontrado" });
});

test("remove apenas lotes zerados e sem nenhuma movimentação", async () => {
    const consultados = [];
    const banco = {
        async ExecutaComandoNonQuery(sql, valores) {
            assert.match(sql, /QuantidadeDisponivel = 0/);
            assert.match(sql, /ItemEntrada/);
            assert.match(sql, /ItemSaida/);
            assert.match(sql, /ItemAjusteEstoque/);
            consultados.push(valores[0]);
            return valores[0] !== 5;
        }
    };
    const removidos = await new EstoqueModel().removerLotesSemMovimentacao(banco, [5, 3, 5]);
    assert.deepEqual(consultados, [3, 5]);
    assert.deepEqual(removidos, [3]);
});

test("consulta de estoque soma todos os lotes e filtra apenas os lotes exibidos pela validade", async () => {
    const banco = {
        async ExecutaComando(sql) {
            if (sql.includes("FROM Produto")) {
                return [
                    { id: 1, nome: "Caneta", categoriaId: 1, categoriaNome: "Escritório", quantidadeTotal: 30 },
                    { id: 2, nome: "Cola", categoriaId: 1, categoriaNome: "Escritório", quantidadeTotal: 0 }
                ];
            }
            return [
                { id: 10, produtoId: 1, codigoLote: "A", quantidadeDisponivel: 10, dataValidade: "2026-01-10", diasParaVencer: -5 },
                { id: 11, produtoId: 1, codigoLote: "B", quantidadeDisponivel: 20, dataValidade: "2026-02-10", diasParaVencer: 20 }
            ];
        }
    };
    const estoque = new EstoqueModel();
    const todos = await estoque.consultarEstoque(banco);
    assert.equal(todos.length, 2);
    assert.deepEqual(todos[0].lotes.map(lote => lote.alerta), ["Lote vencido", "Próximo do vencimento"]);
    assert.equal(todos[1].estoqueZerado, true);

    const filtrados = await estoque.consultarEstoque(banco, { validadeInicio: "2026-02-01", validadeFim: "2026-02-28" });
    assert.equal(filtrados.length, 1);
    assert.equal(filtrados[0].quantidadeTotal, 30);
    assert.deepEqual(filtrados[0].lotes.map(lote => lote.codigoLote), ["B"]);
});
