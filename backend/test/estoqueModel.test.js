import assert from "node:assert/strict";
import test from "node:test";
import EstoqueModel from "../model/estoqueModel.js";

function bancoFalso(lotes) {
    const atualizacoes = [];
    return {
        atualizacoes,
        async ExecutaComando() {
            return lotes.map(lote => ({ id: lote.id, quantidadeDisponivel: lote.quantidade }));
        },
        async ExecutaComandoNonQuery(sql, valores) {
            atualizacoes.push({ sql, valores });
            return true;
        }
    };
}

test("aplica todos os deltas válidos aos lotes", async () => {
    const banco = bancoFalso([{ id: 1, quantidade: 5 }, { id: 2, quantidade: 3 }]);
    const resultado = await new EstoqueModel().aplicarDeltas(banco, new Map([[1, 4], [2, -2]]));

    assert.deepEqual(resultado, { tipo: "ok" });
    assert.deepEqual(banco.atualizacoes.map(item => item.valores), [[4, 1], [-2, 2]]);
});

test("não altera nenhum lote quando um saldo ficaria negativo", async () => {
    const banco = bancoFalso([{ id: 1, quantidade: 5 }, { id: 2, quantidade: 1 }]);
    const resultado = await new EstoqueModel().aplicarDeltas(banco, new Map([[1, 2], [2, -3]]));

    assert.deepEqual(resultado, { tipo: "saldo_insuficiente", loteId: 2, saldoAtual: 1 });
    assert.equal(banco.atualizacoes.length, 0);
});

test("falha sem alterar saldos quando algum lote não existe", async () => {
    const banco = bancoFalso([{ id: 1, quantidade: 5 }]);
    const resultado = await new EstoqueModel().aplicarDeltas(banco, new Map([[1, 1], [2, 1]]));

    assert.deepEqual(resultado, { tipo: "lote_nao_encontrado" });
    assert.equal(banco.atualizacoes.length, 0);
});
