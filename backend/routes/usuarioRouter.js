import express from "express";
import UsuarioController from "../controllers/usuarioController.js";

const router = express.Router();

router.get("/", (req, res, next) => new UsuarioController().listar(req, res, next));
router.post("/", (req, res, next) => new UsuarioController().cadastrar(req, res, next));
router.put("/:id", (req, res, next) => new UsuarioController().alterar(req, res, next));
router.patch("/:id/senha", (req, res, next) => new UsuarioController().alterarSenha(req, res, next));
router.patch("/:id/inativar", (req, res, next) => new UsuarioController().inativar(req, res, next));
router.patch("/:id/reativar", (req, res, next) => new UsuarioController().reativar(req, res, next));

export default router;
