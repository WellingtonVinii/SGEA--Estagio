import Entity from "./entity.js";

export default class FuncionarioModel extends Entity {
    #id;
    #nome;
    #cpf;
    #cargo;
    #telefone;
    #email;
    #ativo;
    #possuiUsuario;

    constructor(
        id = 0,
        nome = "",
        cpf = "",
        cargo = "",
        telefone = "",
        email = "",
        ativo = false,
        possuiUsuario = false
    ) {
        super();
        this.id = id;
        this.nome = nome;
        this.cpf = cpf;
        this.cargo = cargo;
        this.telefone = telefone;
        this.email = email;
        this.ativo = ativo;
        this.possuiUsuario = possuiUsuario;
    }

    get id() { return this.#id; }
    set id(valor) { this.#id = valor; }

    get nome() { return this.#nome; }
    set nome(valor) { this.#nome = valor; }

    get cpf() { return this.#cpf; }
    set cpf(valor) { this.#cpf = valor; }

    get cargo() { return this.#cargo; }
    set cargo(valor) { this.#cargo = valor; }

    get telefone() { return this.#telefone; }
    set telefone(valor) { this.#telefone = valor; }

    get email() { return this.#email; }
    set email(valor) { this.#email = valor; }

    get ativo() { return this.#ativo; }
    set ativo(valor) { this.#ativo = valor; }

    get possuiUsuario() { return this.#possuiUsuario; }
    set possuiUsuario(valor) { this.#possuiUsuario = valor; }

    validar(exigirId = false) {
        const idValido = Number.isSafeInteger(this.#id) && this.#id > 0;
        const nomeValido = typeof this.#nome === "string" &&
            this.#nome.trim().length > 0 && this.#nome.trim().length <= 150;
        const cargoValido = typeof this.#cargo === "string" &&
            this.#cargo.trim().length > 0 && this.#cargo.trim().length <= 100;
        const telefoneValido = /^\d{10,11}$/.test(this.#telefone);
        const emailValido = typeof this.#email === "string" && this.#email.length <= 150 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.#email);

        return (!exigirId || idValido) && nomeValido && this.validarCPF() &&
            cargoValido && telefoneValido && emailValido && typeof this.#ativo === "boolean";
    }

    validarCPF() {
        const cpf = this.#cpf;
        if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

        const calcularDigito = tamanho => {
            let soma = 0;
            for (let indice = 0; indice < tamanho; indice++) {
                soma += Number(cpf[indice]) * (tamanho + 1 - indice);
            }
            const resto = (soma * 10) % 11;
            return resto === 10 ? 0 : resto;
        };

        return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
    }

    async listar(banco, nome = "", cargo = "", situacao = "todos") {
        const filtros = [];
        const valores = [];

        if (nome) {
            filtros.push("LOCATE(?, f.Nome) > 0");
            valores.push(nome);
        }
        if (cargo) {
            filtros.push("f.Cargo = ?");
            valores.push(cargo);
        }
        if (situacao !== "todos") {
            filtros.push("f.Ativo = ?");
            valores.push(situacao === "ativos" ? 1 : 0);
        }

        const where = filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "";
        const rows = await banco.ExecutaComando(
            `SELECT f.Id AS id, f.Nome AS nome, f.CPF AS cpf, f.Cargo AS cargo,
                    f.Telefone AS telefone, f.Email AS email, f.Ativo AS ativo,
                    EXISTS(SELECT 1 FROM Usuario u WHERE u.FuncionarioId = f.Id) AS possuiUsuario
               FROM Funcionario f${where}
           ORDER BY f.Nome`,
            valores
        );
        return rows.map(row => FuncionarioModel.toMap(row));
    }

    async listarCargos(banco) {
        const rows = await banco.ExecutaComando(
            "SELECT DISTINCT Cargo AS cargo FROM Funcionario ORDER BY Cargo"
        );
        return rows.map(row => row.cargo);
    }

    async buscarPorId(banco, id) {
        const rows = await banco.ExecutaComando(
            `SELECT f.Id AS id, f.Nome AS nome, f.CPF AS cpf, f.Cargo AS cargo,
                    f.Telefone AS telefone, f.Email AS email, f.Ativo AS ativo,
                    EXISTS(SELECT 1 FROM Usuario u WHERE u.FuncionarioId = f.Id) AS possuiUsuario
               FROM Funcionario f
              WHERE f.Id = ?`,
            [id]
        );
        return rows.length ? FuncionarioModel.toMap(rows[0]) : null;
    }

    async buscarPorCpf(banco, cpf, excluirId = null) {
        const sql = `SELECT f.Id AS id, f.Nome AS nome, f.CPF AS cpf, f.Cargo AS cargo,
                            f.Telefone AS telefone, f.Email AS email, f.Ativo AS ativo,
                            EXISTS(SELECT 1 FROM Usuario u WHERE u.FuncionarioId = f.Id) AS possuiUsuario
                       FROM Funcionario f
                      WHERE f.CPF = ?${excluirId === null ? "" : " AND f.Id <> ?"}
                      LIMIT 1`;
        const valores = excluirId === null ? [cpf] : [cpf, excluirId];
        const rows = await banco.ExecutaComando(sql, valores);
        return rows.length ? FuncionarioModel.toMap(rows[0]) : null;
    }

    async cadastrar(banco, funcionario) {
        const id = await banco.ExecutaComandoLastInserted(
            `INSERT INTO Funcionario (Nome, CPF, Cargo, Telefone, Email, Ativo)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            [
                funcionario.nome,
                funcionario.cpf,
                funcionario.cargo,
                funcionario.telefone,
                funcionario.email,
                funcionario.ativo ? 1 : 0
            ]
        );
        if (!id) return false;
        funcionario.id = id;
        return true;
    }

    async atualizar(banco, funcionario) {
        return banco.ExecutaComandoNonQuery(
            `UPDATE Funcionario
                SET Nome = ?, CPF = ?, Cargo = ?, Telefone = ?, Email = ?
              WHERE Id = ?`,
            [
                funcionario.nome,
                funcionario.cpf,
                funcionario.cargo,
                funcionario.telefone,
                funcionario.email,
                funcionario.id
            ]
        );
    }

    async alterarSituacao(banco, id, ativo) {
        const rows = await banco.ExecutaComando(
            `SELECT f.Id AS id, f.Nome AS nome, f.CPF AS cpf, f.Cargo AS cargo,
                    f.Telefone AS telefone, f.Email AS email, f.Ativo AS ativo,
                    EXISTS(SELECT 1 FROM Usuario u WHERE u.FuncionarioId = f.Id) AS possuiUsuario
               FROM Funcionario f
              WHERE f.Id = ? FOR UPDATE`,
            [id]
        );
        if (!rows.length) return { tipo: "nao_encontrado" };

        const funcionario = FuncionarioModel.toMap(rows[0]);
        if (funcionario.ativo === ativo) {
            if (!ativo && funcionario.possuiUsuario) {
                await banco.ExecutaComandoNonQuery(
                    "UPDATE Usuario SET Ativo = 0 WHERE FuncionarioId = ?",
                    [id]
                );
            }
            return { tipo: "ok", funcionario };
        }

        await banco.ExecutaComandoNonQuery(
            "UPDATE Funcionario SET Ativo = ? WHERE Id = ?",
            [ativo ? 1 : 0, id]
        );

        if (!ativo && funcionario.possuiUsuario) {
            await banco.ExecutaComandoNonQuery(
                "UPDATE Usuario SET Ativo = 0 WHERE FuncionarioId = ?",
                [id]
            );
        }

        funcionario.ativo = ativo;
        return { tipo: "ok", funcionario };
    }

    static toMap(row) {
        return new FuncionarioModel(
            Number(row.id ?? row.Id),
            row.nome ?? row.Nome,
            row.cpf ?? row.CPF,
            row.cargo ?? row.Cargo,
            row.telefone ?? row.Telefone,
            row.email ?? row.Email,
            Boolean(row.ativo ?? row.Ativo),
            Boolean(row.possuiUsuario ?? row.PossuiUsuario)
        );
    }
}
