import FuncionarioModel from "../model/funcionarioModel.js";
import Database from "../database/database.js";

export default class FuncionarioController {
    #model;
    #banco;

    constructor() {
        this.#model = new FuncionarioModel();
        this.#banco = new Database();
    }

    async listar(req, res, next) {
        try {
            const { nome = "", cargo = "", situacao = "todos" } = req.query;
            if (typeof nome !== "string" || typeof cargo !== "string" ||
                typeof situacao !== "string" || !["todos", "ativos", "inativos"].includes(situacao) ||
                nome.trim().length > 150 || cargo.trim().length > 100) {
                return res.status(400).json({
                    erro: "Use nome e cargo válidos e situacao=todos, ativos ou inativos."
                });
            }

            return res.json(await this.#model.listar(
                this.#banco,
                nome.trim(),
                cargo.trim(),
                situacao
            ));
        } catch (erro) {
            next(erro);
        }
    }

    async listarCargos(req, res, next) {
        try {
            return res.json(await this.#model.listarCargos(this.#banco));
        } catch (erro) {
            next(erro);
        }
    }

    async buscar(req, res, next) {
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do funcionário inválido." });

            const funcionario = await this.#model.buscarPorId(this.#banco, id);
            return funcionario
                ? res.json(funcionario)
                : res.status(404).json({ erro: "Funcionário não encontrado." });
        } catch (erro) {
            next(erro);
        }
    }

    async cadastrar(req, res, next) {
        let transacaoAberta = false;
        try {
            const dados = this.#dadosCadastro(req.body);
            if (!dados) return res.status(400).json({ erro: "Dados do funcionário inválidos." });

            const funcionario = new FuncionarioModel(
                0,
                dados.nome,
                dados.cpf,
                dados.cargo,
                dados.telefone,
                dados.email,
                dados.ativo
            );
            if (!funcionario.validar()) {
                return res.status(400).json({
                    erro: "Informe nome, CPF válido, cargo, telefone com DDD e e-mail válido."
                });
            }

            await this.#banco.AbreTransacao();
            transacaoAberta = true;

            const existente = await this.#model.buscarPorCpf(this.#banco, funcionario.cpf);
            if (existente) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return this.#cpfDuplicado(res, existente);
            }

            if (!await this.#model.cadastrar(this.#banco, funcionario)) {
                throw new Error("Erro ao inserir funcionário no banco de dados.");
            }

            await this.#banco.Commit();
            transacaoAberta = false;
            return res.status(201).json(funcionario);
        } catch (erro) {
            await this.#tratarErroCpf(erro, transacaoAberta, req.body?.cpf, res, next);
        }
    }

    async alterar(req, res, next) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do funcionário inválido." });

            const dados = this.#dadosAlteracao(req.body);
            if (!dados) {
                return res.status(400).json({
                    erro: "Informe somente nome, CPF, cargo, telefone e/ou e-mail válidos."
                });
            }

            await this.#banco.AbreTransacao();
            transacaoAberta = true;

            const atual = await this.#model.buscarPorId(this.#banco, id);
            if (!atual) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(404).json({ erro: "Funcionário não encontrado." });
            }

            const funcionario = new FuncionarioModel(
                id,
                dados.nome ?? atual.nome,
                dados.cpf ?? atual.cpf,
                dados.cargo ?? atual.cargo,
                dados.telefone ?? atual.telefone,
                dados.email ?? atual.email,
                atual.ativo,
                atual.possuiUsuario
            );
            if (!funcionario.validar(true)) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(400).json({
                    erro: "Informe nome, CPF válido, cargo, telefone com DDD e e-mail válido."
                });
            }

            const existente = await this.#model.buscarPorCpf(
                this.#banco,
                funcionario.cpf,
                funcionario.id
            );
            if (existente) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return this.#cpfDuplicado(res, existente);
            }

            if (!await this.#model.atualizar(this.#banco, funcionario)) {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(404).json({ erro: "Funcionário não encontrado." });
            }

            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(funcionario);
        } catch (erro) {
            await this.#tratarErroCpf(erro, transacaoAberta, req.body?.cpf, res, next);
        }
    }

    async inativar(req, res, next) {
        return this.#situacao(req, res, next, false);
    }

    async reativar(req, res, next) {
        return this.#situacao(req, res, next, true);
    }

    async #situacao(req, res, next, ativo) {
        let transacaoAberta = false;
        try {
            const id = this.#id(req.params.id);
            if (!id) return res.status(400).json({ erro: "Id do funcionário inválido." });

            await this.#banco.AbreTransacao();
            transacaoAberta = true;
            const resultado = await this.#model.alterarSituacao(this.#banco, id, ativo);

            if (resultado.tipo === "nao_encontrado") {
                await this.#banco.Rollback();
                transacaoAberta = false;
                return res.status(404).json({ erro: "Funcionário não encontrado." });
            }

            await this.#banco.Commit();
            transacaoAberta = false;
            return res.json(resultado.funcionario);
        } catch (erro) {
            if (transacaoAberta) {
                try {
                    await this.#banco.Rollback();
                } catch (rollbackErro) {
                    erro.rollbackErro = rollbackErro;
                }
            }
            next(erro);
        }
    }

    #dadosCadastro(body) {
        const permitidas = ["nome", "cpf", "cargo", "telefone", "email"];
        if (!body || Object.keys(body).some(chave => !permitidas.includes(chave))) return null;

        const dados = {
            nome: this.#texto(body.nome, 150),
            cpf: this.#cpf(body.cpf),
            cargo: this.#texto(body.cargo, 100),
            telefone: this.#telefone(body.telefone),
            email: this.#email(body.email),
            ativo: true
        };
        return Object.values(dados).some(valor => valor === null) ? null : dados;
    }

    #dadosAlteracao(body) {
        const permitidas = ["nome", "cpf", "cargo", "telefone", "email"];
        const chaves = Object.keys(body ?? {});
        if (!chaves.length || chaves.some(chave => !permitidas.includes(chave))) return null;

        const dados = {};
        if ("nome" in body) dados.nome = this.#texto(body.nome, 150);
        if ("cpf" in body) dados.cpf = this.#cpf(body.cpf);
        if ("cargo" in body) dados.cargo = this.#texto(body.cargo, 100);
        if ("telefone" in body) dados.telefone = this.#telefone(body.telefone);
        if ("email" in body) dados.email = this.#email(body.email);

        return Object.values(dados).some(valor => valor === null) ? null : dados;
    }

    #id(valor) {
        return typeof valor === "string" && /^\d+$/.test(valor) &&
            Number.isSafeInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
    }

    #texto(valor, limite) {
        if (typeof valor !== "string") return null;
        const texto = valor.trim();
        return texto && texto.length <= limite ? texto : null;
    }

    #cpf(valor) {
        if (typeof valor !== "string") return null;
        const cpf = valor.replace(/\D/g, "");
        return cpf.length === 11 ? cpf : null;
    }

    #telefone(valor) {
        if (typeof valor !== "string") return null;
        const telefone = valor.replace(/\D/g, "");
        return /^\d{10,11}$/.test(telefone) ? telefone : null;
    }

    #email(valor) {
        if (typeof valor !== "string") return null;
        const email = valor.trim().toLowerCase();
        return email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ? email : null;
    }

    #cpfDuplicado(res, existente) {
        return res.status(409).json({
            erro: existente.ativo
                ? "Já existe um funcionário cadastrado com este CPF."
                : "Já existe um funcionário inativo com este CPF. Reative o registro existente.",
            funcionario: existente
        });
    }

    async #tratarErroCpf(erro, transacaoAberta, cpfInformado, res, next) {
        if (transacaoAberta) {
            try {
                await this.#banco.Rollback();
            } catch (rollbackErro) {
                erro.rollbackErro = rollbackErro;
            }
        }

        if (erro.code !== "ER_DUP_ENTRY") return next(erro);
        try {
            const cpf = this.#cpf(cpfInformado);
            const existente = cpf ? await this.#model.buscarPorCpf(this.#banco, cpf) : null;
            return existente ? this.#cpfDuplicado(res, existente) : next(erro);
        } catch (buscaErro) {
            next(buscaErro);
        }
    }
}
