import Entity from "./entity.js";
import LoteModel from "./loteModel.js";

export default class ProdutoModel extends Entity {
    #id;
    #nome;
    #ativo;
    #categoriaId;
    #categoriaNome;
    #quantidadeTotal;
    #lotes;

    constructor(
        id = 0,
        nome = "",
        ativo = false,
        categoriaId = 0,
        categoriaNome = "",
        quantidadeTotal = 0,
        lotes = []
    ) {
        super();
        this.id = id;
        this.nome = nome;
        this.ativo = ativo;
        this.categoriaId = categoriaId;
        this.categoriaNome = categoriaNome;
        this.quantidadeTotal = quantidadeTotal;
        this.lotes = lotes;
    }

    get id() { return this.#id; }
    set id(valor) { this.#id = valor; }

    get nome() { return this.#nome; }
    set nome(valor) { this.#nome = valor; }

    get ativo() { return this.#ativo; }
    set ativo(valor) { this.#ativo = valor; }

    get categoriaId() { return this.#categoriaId; }
    set categoriaId(valor) { this.#categoriaId = valor; }

    get categoriaNome() { return this.#categoriaNome; }
    set categoriaNome(valor) { this.#categoriaNome = valor; }

    get quantidadeTotal() { return this.#quantidadeTotal; }
    set quantidadeTotal(valor) { this.#quantidadeTotal = valor; }

    get lotes() { return this.#lotes; }
    set lotes(valor) { this.#lotes = valor; }

    validar(exigirId = false) {
        const idValido = Number.isSafeInteger(this.#id) && this.#id > 0;
        const nomeValido = typeof this.#nome === "string" &&
            this.#nome.trim().length > 0 && this.#nome.trim().length <= 150;
        const categoriaValida = Number.isSafeInteger(this.#categoriaId) && this.#categoriaId > 0;

        return (!exigirId || idValido) && nomeValido && categoriaValida &&
            typeof this.#ativo === "boolean";
    }

    async listar(banco, nome = "", situacao = "todos") {
        const filtros = [];
        const valores = [];

        if (nome) {
            filtros.push("LOCATE(?, p.Nome) > 0");
            valores.push(nome);
        }
        if (situacao !== "todos") {
            filtros.push("p.Ativo = ?");
            valores.push(situacao === "ativos" ? 1 : 0);
        }

        const where = filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "";
        const rows = await banco.ExecutaComando(
            `SELECT p.Id AS id, p.Nome AS nome, p.Ativo AS ativo,
                    c.Id AS categoriaId, c.Nome AS categoriaNome,
                    COALESCE(SUM(l.QuantidadeDisponivel), 0) AS quantidadeTotal
               FROM Produto p
               JOIN Categoria c ON c.Id = p.CategoriaId
          LEFT JOIN Lote l ON l.ProdutoId = p.Id
             ${where}
           GROUP BY p.Id, p.Nome, p.Ativo, c.Id, c.Nome
           ORDER BY p.Nome`,
            valores
        );
        return rows.map(row => ProdutoModel.toMap(row));
    }

    async buscarPorId(banco, id) {
        const rows = await banco.ExecutaComando(
            `SELECT p.Id AS id, p.Nome AS nome, p.Ativo AS ativo,
                    c.Id AS categoriaId, c.Nome AS categoriaNome,
                    COALESCE(SUM(l.QuantidadeDisponivel), 0) AS quantidadeTotal
               FROM Produto p
               JOIN Categoria c ON c.Id = p.CategoriaId
          LEFT JOIN Lote l ON l.ProdutoId = p.Id
              WHERE p.Id = ?
           GROUP BY p.Id, p.Nome, p.Ativo, c.Id, c.Nome`,
            [id]
        );
        if (!rows.length) return null;

        const produto = ProdutoModel.toMap(rows[0]);
        produto.lotes = await this.listarLotes(banco, id);
        return produto;
    }

    async listarLotes(banco, produtoId) {
        const rows = await banco.ExecutaComando(
            `SELECT Id AS id, CodigoLote AS codigoLote,
                    QuantidadeDisponivel AS quantidadeDisponivel,
                    DATE_FORMAT(DataValidade, '%Y-%m-%d') AS dataValidade,
                    ProdutoId AS produtoId
               FROM Lote
              WHERE ProdutoId = ?
           ORDER BY Id`,
            [produtoId]
        );
        return rows.map(row => LoteModel.toMap(row));
    }

    async buscarPorNome(banco, nome, excluirId = null) {
        const sql = `SELECT p.Id AS id, p.Nome AS nome, p.Ativo AS ativo,
                            c.Id AS categoriaId, c.Nome AS categoriaNome,
                            0 AS quantidadeTotal
                       FROM Produto p
                       JOIN Categoria c ON c.Id = p.CategoriaId
                      WHERE p.Nome = ?${excluirId === null ? "" : " AND p.Id <> ?"}
                      LIMIT 1`;
        const valores = excluirId === null ? [nome] : [nome, excluirId];
        const rows = await banco.ExecutaComando(sql, valores);
        return rows.length ? ProdutoModel.toMap(rows[0]) : null;
    }

    async buscarCategoriaAtiva(banco, id) {
        const rows = await banco.ExecutaComando(
            "SELECT Id AS id, Nome AS nome FROM Categoria WHERE Id = ? AND Ativo = 1 LIMIT 1",
            [id]
        );
        return rows.length ? { id: Number(rows[0].id), nome: rows[0].nome } : null;
    }

    async cadastrar(banco, produto) {
        const id = await banco.ExecutaComandoLastInserted(
            "INSERT INTO Produto (Nome, Ativo, CategoriaId) VALUES (?, 1, ?)",
            [produto.nome, produto.categoriaId]
        );
        if (!id) return false;
        produto.id = id;
        produto.ativo = true;
        return true;
    }

    async cadastrarLote(banco, lote) {
        const id = await banco.ExecutaComandoLastInserted(
            `INSERT INTO Lote (CodigoLote, QuantidadeDisponivel, DataValidade, ProdutoId)
                  VALUES (?, ?, ?, ?)`,
            [lote.codigoLote, lote.quantidadeDisponivel, lote.dataValidade, lote.produtoId]
        );
        if (!id) return false;
        lote.id = id;
        return true;
    }

    async atualizar(banco, produto) {
        return banco.ExecutaComandoNonQuery(
            "UPDATE Produto SET Nome = ?, CategoriaId = ? WHERE Id = ?",
            [produto.nome, produto.categoriaId, produto.id]
        );
    }

    async alterarSituacao(banco, id, ativo) {
        const rows = await banco.ExecutaComando(
            `SELECT p.Id AS id, p.Nome AS nome, p.Ativo AS ativo,
                    c.Id AS categoriaId, c.Nome AS categoriaNome,
                    c.Ativo AS categoriaAtiva, 0 AS quantidadeTotal
               FROM Produto p
               JOIN Categoria c ON c.Id = p.CategoriaId
              WHERE p.Id = ? FOR UPDATE`,
            [id]
        );
        if (!rows.length) return { tipo: "nao_encontrado" };

        const produto = ProdutoModel.toMap(rows[0]);
        if (produto.ativo === ativo) return { tipo: "ok", produto };
        if (ativo && !Boolean(rows[0].categoriaAtiva)) return { tipo: "categoria_inativa" };

        if (!ativo) {
            const lotes = await banco.ExecutaComando(
                "SELECT QuantidadeDisponivel AS quantidade FROM Lote WHERE ProdutoId = ? FOR UPDATE",
                [id]
            );
            const quantidadeTotal = lotes.reduce((total, lote) => total + Number(lote.quantidade), 0);
            if (quantidadeTotal !== 0) return { tipo: "estoque_disponivel", quantidadeTotal };
        }

        await banco.ExecutaComandoNonQuery(
            "UPDATE Produto SET Ativo = ? WHERE Id = ?",
            [ativo ? 1 : 0, id]
        );
        produto.ativo = ativo;
        return { tipo: "ok", produto };
    }

    static toMap(row) {
        return new ProdutoModel(
            Number(row.id ?? row.Id),
            row.nome ?? row.Nome,
            Boolean(row.ativo ?? row.Ativo),
            Number(row.categoriaId ?? row.CategoriaId),
            row.categoriaNome ?? row.CategoriaNome ?? "",
            Number(row.quantidadeTotal ?? row.QuantidadeTotal ?? 0)
        );
    }
}
