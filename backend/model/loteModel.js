import Entity from "./entity.js";

export default class LoteModel extends Entity {
    #id;
    #codigoLote;
    #quantidadeDisponivel;
    #dataValidade;
    #produtoId;

    constructor(id = 0, codigoLote = "", quantidadeDisponivel = 0, dataValidade = null, produtoId = 0) {
        super();
        this.id = id;
        this.codigoLote = codigoLote;
        this.quantidadeDisponivel = quantidadeDisponivel;
        this.dataValidade = dataValidade;
        this.produtoId = produtoId;
    }

    get id() { return this.#id; }
    set id(valor) { this.#id = valor; }

    get codigoLote() { return this.#codigoLote; }
    set codigoLote(valor) { this.#codigoLote = valor; }

    get quantidadeDisponivel() { return this.#quantidadeDisponivel; }
    set quantidadeDisponivel(valor) { this.#quantidadeDisponivel = valor; }

    get dataValidade() { return this.#dataValidade; }
    set dataValidade(valor) { this.#dataValidade = valor; }

    get produtoId() { return this.#produtoId; }
    set produtoId(valor) { this.#produtoId = valor; }

    validar(exigirId = false) {
        const idValido = Number.isSafeInteger(this.#id) && this.#id > 0;
        const codigoValido = typeof this.#codigoLote === "string" &&
            this.#codigoLote.trim().length > 0 && this.#codigoLote.trim().length <= 50;
        const quantidadeValida = Number.isSafeInteger(this.#quantidadeDisponivel) &&
            this.#quantidadeDisponivel > 0;
        const produtoValido = Number.isSafeInteger(this.#produtoId) && this.#produtoId >= 0;
        const validadeValida = this.#dataValidade === null ||
            /^\d{4}-\d{2}-\d{2}$/.test(this.#dataValidade);

        return (!exigirId || idValido) && codigoValido && quantidadeValida &&
            produtoValido && validadeValida;
    }

    static toMap(row) {
        return new LoteModel(
            Number(row.id ?? row.Id),
            row.codigoLote ?? row.CodigoLote,
            Number(row.quantidadeDisponivel ?? row.QuantidadeDisponivel),
            row.dataValidade ?? row.DataValidade ?? null,
            Number(row.produtoId ?? row.ProdutoId)
        );
    }
}
