import jwt from "jsonwebtoken";
import Database from "../database/database.js";
import UsuarioModel from "../model/usuarioModel.js";

function obterSegredoJwt() {
    const segredo = process.env.JWT_SECRET;
    if (typeof segredo !== "string" || segredo.length < 32) {
        const erro = new Error("JWT_SECRET deve possuir pelo menos 32 caracteres.");
        erro.code = "JWT_CONFIG";
        throw erro;
    }
    return segredo;
}

export default async function autenticarToken(req, res, next) {
    try {
        const cabecalho = req.headers.authorization;
        if (typeof cabecalho !== "string" || !/^Bearer\s+\S+$/i.test(cabecalho)) {
            return res.status(401).json({ erro: "Token de acesso não informado." });
        }

        const token = cabecalho.replace(/^Bearer\s+/i, "");
        const payload = jwt.verify(token, obterSegredoJwt(), {
            algorithms: ["HS256"],
            issuer: "sgea-api",
            audience: "sgea-frontend"
        });
        const usuarioId = Number(payload.sub);
        if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
            return res.status(401).json({ erro: "Token de acesso inválido." });
        }

        const banco = new Database();
        const usuario = await new UsuarioModel().buscarPorId(banco, usuarioId);
        if (!usuario || !usuario.estaHabilitado()) {
            return res.status(401).json({ erro: "Usuário inativo ou sem permissão de acesso." });
        }

        req.usuario = usuario.dadosPublicos();
        next();
    } catch (erro) {
        if (erro.code === "JWT_CONFIG") return next(erro);
        if (erro instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ erro: "Token de acesso expirado." });
        }
        if (erro instanceof jwt.JsonWebTokenError || erro instanceof jwt.NotBeforeError) {
            return res.status(401).json({ erro: "Token de acesso inválido." });
        }
        next(erro);
    }
}

function normalizarPerfil(perfil) {
    return String(perfil ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function autorizarPerfis(...perfisPermitidos) {
    const permitidos = new Set(perfisPermitidos.map(normalizarPerfil));
    return function(req, res, next) {
        if (!req.usuario || !permitidos.has(normalizarPerfil(req.usuario.perfil))) {
            return res.status(403).json({ erro: "Usuário sem permissão para acessar este recurso." });
        }
        next();
    };
}

export { autorizarPerfis };
