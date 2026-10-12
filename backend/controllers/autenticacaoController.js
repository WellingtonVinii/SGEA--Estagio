import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "../database/database.js";
import UsuarioModel from "../model/usuarioModel.js";

const EXPIRACAO_SEGUNDOS = 5 * 60 * 60;

export default class AutenticacaoController {
    #banco;
    #model;

    constructor() {
        this.#banco = new Database();
        this.#model = new UsuarioModel();
    }

    async gerarToken(req, res, next) {
        try {
            const dados = this.#credenciais(req.body);
            if (!dados) {
                return res.status(400).json({ erro: "Informe um e-mail e uma senha válidos." });
            }

            const usuario = await this.#model.buscarPorEmail(this.#banco, dados.email);
            if (!usuario || !usuario.estaHabilitado() || !await this.#senhaValida(dados.senha, usuario)) {
                return res.status(401).json({ erro: "E-mail ou senha inválidos." });
            }

            const token = jwt.sign(
                {
                    funcionarioId: usuario.funcionarioId,
                    perfilId: usuario.perfilId,
                    perfil: usuario.perfil
                },
                this.#obterSegredoJwt(),
                {
                    algorithm: "HS256",
                    expiresIn: "5h",
                    subject: String(usuario.id),
                    issuer: "sgea-api",
                    audience: "sgea-frontend"
                }
            );

            return res.json({
                token,
                tipo: "Bearer",
                expiraEmSegundos: EXPIRACAO_SEGUNDOS,
                usuario: usuario.dadosPublicos()
            });
        } catch (erro) {
            next(erro);
        }
    }

    #credenciais(body) {
        if (!body || Object.keys(body).some(chave => !["email", "senha"].includes(chave)) ||
            typeof body.email !== "string" || typeof body.senha !== "string") return null;

        const email = body.email.trim().toLowerCase();
        const senha = body.senha;
        if (!email || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !senha || senha.length > 255) return null;
        return { email, senha };
    }

    #obterSegredoJwt() {
        const segredo = process.env.JWT_SECRET;
        if (typeof segredo !== "string" || segredo.length < 32) {
            const erro = new Error("JWT_SECRET deve possuir pelo menos 32 caracteres.");
            erro.code = "JWT_CONFIG";
            throw erro;
        }
        return segredo;
    }

    async #senhaValida(senhaInformada, usuario) {
        const senhaArmazenada = String(usuario.senha ?? "");
        const usaBcrypt = /^\$2[aby]\$\d{2}\$/.test(senhaArmazenada);

        if (usaBcrypt) return bcrypt.compare(senhaInformada, senhaArmazenada);
        if (senhaInformada !== senhaArmazenada) return false;

        const senhaCriptografada = await bcrypt.hash(senhaInformada, 12);
        await this.#model.atualizarSenha(this.#banco, usuario.id, senhaCriptografada);
        return true;
    }
}
