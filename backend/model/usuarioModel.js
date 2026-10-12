import Entity from "./entity.js";

export default class UsuarioModel extends Entity {
    #id;
    #email;
    #senha;
    #ativo;
    #funcionarioId;
    #funcionarioNome;
    #funcionarioAtivo;
    #perfilId;
    #perfil;

    constructor(
        id = 0,
        email = "",
        senha = "",
        ativo = false,
        funcionarioId = 0,
        funcionarioNome = "",
        funcionarioAtivo = false,
        perfilId = 0,
        perfil = ""
    ) {
        super();
        this.id = id;
        this.email = email;
        this.senha = senha;
        this.ativo = ativo;
        this.funcionarioId = funcionarioId;
        this.funcionarioNome = funcionarioNome;
        this.funcionarioAtivo = funcionarioAtivo;
        this.perfilId = perfilId;
        this.perfil = perfil;
    }

    get id() { return this.#id; }
    set id(valor) { this.#id = valor; }

    get email() { return this.#email; }
    set email(valor) { this.#email = valor; }

    get senha() { return this.#senha; }
    set senha(valor) { this.#senha = valor; }

    get ativo() { return this.#ativo; }
    set ativo(valor) { this.#ativo = valor; }

    get funcionarioId() { return this.#funcionarioId; }
    set funcionarioId(valor) { this.#funcionarioId = valor; }

    get funcionarioNome() { return this.#funcionarioNome; }
    set funcionarioNome(valor) { this.#funcionarioNome = valor; }

    get funcionarioAtivo() { return this.#funcionarioAtivo; }
    set funcionarioAtivo(valor) { this.#funcionarioAtivo = valor; }

    get perfilId() { return this.#perfilId; }
    set perfilId(valor) { this.#perfilId = valor; }

    get perfil() { return this.#perfil; }
    set perfil(valor) { this.#perfil = valor; }

    async buscarPorEmail(banco, email) {
        const rows = await banco.ExecutaComando(
            `SELECT u.Id AS id, u.Email AS email, u.Senha AS senha, u.Ativo AS ativo,
                    f.Id AS funcionarioId, f.Nome AS funcionarioNome,
                    f.Ativo AS funcionarioAtivo, p.Id AS perfilId, p.Nome AS perfil
               FROM Usuario u
               JOIN Funcionario f ON f.Id = u.FuncionarioId
               JOIN Perfil p ON p.Id = u.PerfilId
              WHERE u.Email = ?
              LIMIT 1`,
            [email]
        );
        return rows.length ? UsuarioModel.toMap(rows[0]) : null;
    }

    async listar(banco) {
        const rows = await banco.ExecutaComando(
            `SELECT u.Id AS id, u.Email AS email, '' AS senha, u.Ativo AS ativo,
                    f.Id AS funcionarioId, f.Nome AS funcionarioNome,
                    f.Ativo AS funcionarioAtivo, p.Id AS perfilId, p.Nome AS perfil
               FROM Usuario u
               JOIN Funcionario f ON f.Id = u.FuncionarioId
               JOIN Perfil p ON p.Id = u.PerfilId
           ORDER BY f.Nome`,
            []
        );
        return rows.map(row => UsuarioModel.toMap(row));
    }

    async buscarPorId(banco, id) {
        const rows = await banco.ExecutaComando(
            `SELECT u.Id AS id, u.Email AS email, '' AS senha, u.Ativo AS ativo,
                    f.Id AS funcionarioId, f.Nome AS funcionarioNome,
                    f.Ativo AS funcionarioAtivo, p.Id AS perfilId, p.Nome AS perfil
               FROM Usuario u
               JOIN Funcionario f ON f.Id = u.FuncionarioId
               JOIN Perfil p ON p.Id = u.PerfilId
              WHERE u.Id = ?
              LIMIT 1`,
            [id]
        );
        return rows.length ? UsuarioModel.toMap(rows[0]) : null;
    }

    async atualizarSenha(banco, id, senhaCriptografada) {
        return banco.ExecutaComandoNonQuery(
            "UPDATE Usuario SET Senha = ? WHERE Id = ?",
            [senhaCriptografada, id]
        );
    }

    async buscarPorFuncionarioId(banco, funcionarioId) {
        const rows = await banco.ExecutaComando(
            `SELECT u.Id AS id, u.Email AS email, '' AS senha, u.Ativo AS ativo,
                    f.Id AS funcionarioId, f.Nome AS funcionarioNome,
                    f.Ativo AS funcionarioAtivo, p.Id AS perfilId, p.Nome AS perfil
               FROM Usuario u
               JOIN Funcionario f ON f.Id = u.FuncionarioId
               JOIN Perfil p ON p.Id = u.PerfilId
              WHERE u.FuncionarioId = ? LIMIT 1`,
            [funcionarioId]
        );
        return rows.length ? UsuarioModel.toMap(rows[0]) : null;
    }

    async emailEmUso(banco, email, excluirId = null) {
        const rows = await banco.ExecutaComando(
            `SELECT Id FROM Usuario WHERE Email = ?${excluirId === null ? "" : " AND Id <> ?"} LIMIT 1`,
            excluirId === null ? [email] : [email, excluirId]
        );
        return rows.length > 0;
    }

    async funcionarioAtivoExiste(banco, id) {
        const rows = await banco.ExecutaComando(
            "SELECT Id FROM Funcionario WHERE Id = ? AND Ativo = 1 LIMIT 1",
            [id]
        );
        return rows.length > 0;
    }

    async perfilExiste(banco, id) {
        const rows = await banco.ExecutaComando("SELECT Id FROM Perfil WHERE Id = ? LIMIT 1", [id]);
        return rows.length > 0;
    }

    async cadastrar(banco, usuario) {
        const id = await banco.ExecutaComandoLastInserted(
            "INSERT INTO Usuario (Email, Senha, Ativo, FuncionarioId, PerfilId) VALUES (?, ?, ?, ?, ?)",
            [usuario.email, usuario.senha, usuario.ativo ? 1 : 0, usuario.funcionarioId, usuario.perfilId]
        );
        if (!id) return false;
        usuario.id = id;
        return true;
    }

    async atualizar(banco, usuario) {
        return banco.ExecutaComandoNonQuery(
            "UPDATE Usuario SET Email = ?, PerfilId = ? WHERE Id = ?",
            [usuario.email, usuario.perfilId, usuario.id]
        );
    }

    async alterarSituacao(banco, id, ativo) {
        const rows = await banco.ExecutaComando(
            `SELECT u.Id AS id, u.Email AS email, '' AS senha, u.Ativo AS ativo,
                    f.Id AS funcionarioId, f.Nome AS funcionarioNome,
                    f.Ativo AS funcionarioAtivo, p.Id AS perfilId, p.Nome AS perfil
               FROM Usuario u
               JOIN Funcionario f ON f.Id = u.FuncionarioId
               JOIN Perfil p ON p.Id = u.PerfilId
              WHERE u.Id = ? FOR UPDATE`,
            [id]
        );
        if (!rows.length) return { tipo: "nao_encontrado" };
        const usuario = UsuarioModel.toMap(rows[0]);
        if (ativo && !usuario.funcionarioAtivo) return { tipo: "funcionario_inativo" };
        if (usuario.ativo !== ativo) {
            await banco.ExecutaComandoNonQuery("UPDATE Usuario SET Ativo = ? WHERE Id = ?", [ativo ? 1 : 0, id]);
            usuario.ativo = ativo;
        }
        return { tipo: "ok", usuario };
    }

    estaHabilitado() {
        return this.#ativo && this.#funcionarioAtivo;
    }

    dadosPublicos() {
        return {
            id: this.#id,
            email: this.#email,
            ativo: this.#ativo,
            funcionarioId: this.#funcionarioId,
            funcionarioNome: this.#funcionarioNome,
            perfilId: this.#perfilId,
            perfil: this.#perfil
        };
    }

    toJSON() {
        return this.dadosPublicos();
    }

    static toMap(row) {
        const perfilOriginal = row.perfil ?? row.Perfil;
        const perfil = perfilOriginal === "Adiministrador" ? "Administrador"
            : perfilOriginal === "Funcionário Responsável" ? "Funcionário do Estoque"
                : perfilOriginal;
        return new UsuarioModel(
            Number(row.id ?? row.Id),
            row.email ?? row.Email,
            row.senha ?? row.Senha ?? "",
            Boolean(row.ativo ?? row.Ativo),
            Number(row.funcionarioId ?? row.FuncionarioId),
            row.funcionarioNome ?? row.FuncionarioNome,
            Boolean(row.funcionarioAtivo ?? row.FuncionarioAtivo),
            Number(row.perfilId ?? row.PerfilId),
            perfil
        );
    }
}
