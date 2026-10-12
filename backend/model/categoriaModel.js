import Entity from "./entity.js";

export default class CategoriaModel extends Entity {
    #id;
    #nome;
    #ativo;

    constructor(id = 0, nome = "", ativo = false) {
        super();
        this.id = id;
        this.nome = nome;
        this.ativo = ativo;
    }

    get id(){ 
        return this.#id; 
    }
    set id(valor){ 
        this.#id = valor; 
    }

    get nome(){ 
        return this.#nome; 
    }
    set nome(valor){ 
        this.#nome = valor; 
    }

    get ativo(){ 
        return this.#ativo; 
    }
    set ativo(valor){ 
        this.#ativo = valor; 
    }

    validar(exigirId = false) {
        const idValido = Number.isSafeInteger(this.#id) && this.#id > 0;
        const nomeValido = typeof this.#nome === "string" &&
            this.#nome.trim().length > 0 && this.#nome.trim().length <= 100;

        return (!exigirId || idValido) && nomeValido && typeof this.#ativo === "boolean";
    }

    async listar(banco, nome = "", situacao = "todas") {
        const filtros = [];
        const valores = [];
        if (nome) {
            filtros.push("LOCATE(?, Nome) > 0");
            valores.push(nome);
        }
        if (situacao !== "todas") {
            filtros.push("Ativo = ?");
            valores.push(situacao === "ativas" ? 1 : 0);
        }
        const where = filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "";
        const rows = await banco.ExecutaComando(
            `SELECT Id AS id, Nome AS nome, Ativo AS ativo FROM Categoria${where} ORDER BY Nome`, valores
        );
        return rows.map(row => CategoriaModel.toMap(row));
    }

    // O cadastro e a alteração de produtos devem usar apenas esta consulta.
    async listarDisponiveisParaProdutos(banco) {
        return this.listar(banco, "", "ativas");
    }

    async buscarPorId(banco, id) {
        const rows = await banco.ExecutaComando(
            "SELECT Id AS id, Nome AS nome, Ativo AS ativo FROM Categoria WHERE Id = ?", [id]
        );
        return rows.length ? CategoriaModel.toMap(rows[0]) : null;
    }

    async buscarPorNome(banco, nome, excluirId = null) {
        const sql = "SELECT Id AS id, Nome AS nome, Ativo AS ativo FROM Categoria WHERE Nome = ?" +
            (excluirId === null ? "" : " AND Id <> ?") + " LIMIT 1";
        const rows = await banco.ExecutaComando(sql, excluirId === null ? [nome] : [nome, excluirId]);
        return rows.length ? CategoriaModel.toMap(rows[0]) : null;
    }

    async cadastrar(banco, entidade) {
        const id = await banco.ExecutaComandoLastInserted(
            "INSERT INTO Categoria (Nome, Ativo) VALUES (?, ?)",
            [entidade.nome, entidade.ativo ? 1 : 0]
        );
        if (!id) return false;

        entidade.id = id;
        return true;
    }

    async atualizar(banco, entidade) {
        return banco.ExecutaComandoNonQuery(
            "UPDATE Categoria SET Nome = ? WHERE Id = ?", [entidade.nome, entidade.id]
        );
    }

    async alterarSituacao(banco, id, ativo) {
        const categorias = await banco.ExecutaComando(
            "SELECT Id AS id, Nome AS nome, Ativo AS ativo FROM Categoria WHERE Id = ? FOR UPDATE", [id]
        );
        if (!categorias.length) return { tipo: "nao_encontrada" };

        const categoria = CategoriaModel.toMap(categorias[0]);
        if (categoria.ativo === ativo) return { tipo: "ok", categoria };

        if (!ativo && await this.#possuiProdutosAtivos(banco, id)) {
            return { tipo: "produtos_ativos" };
        }

        await banco.ExecutaComandoNonQuery(
            "UPDATE Categoria SET Ativo = ? WHERE Id = ?", [ativo ? 1 : 0, id]
        );
        categoria.ativo = ativo;
        return { tipo: "ok", categoria };
    }

    async #possuiProdutosAtivos(banco, categoriaId) {
        const produtos = await banco.ExecutaComando(
            "SELECT Id FROM Produto WHERE CategoriaId = ? AND Ativo = 1 LIMIT 1",
            [categoriaId]
        );
        return produtos.length > 0;
    }

    static toMap(row) {
        return new CategoriaModel(
            Number(row.id ?? row.Id),
            row.nome ?? row.Nome,
            Boolean(row.ativo ?? row.Ativo)
        );
    }

}
