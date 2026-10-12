import express from "express";
import FuncionarioController from "../controllers/funcionarioController.js";

const router = express.Router();

router.get("/", (req, res, next) => new FuncionarioController().listar(req, res, next));
router.get("/cargos", (req, res, next) => new FuncionarioController().listarCargos(req, res, next));
router.get("/:id", (req, res, next) => new FuncionarioController().buscar(req, res, next));
router.post("/", (req, res, next) => new FuncionarioController().cadastrar(req, res, next));
router.patch("/:id", (req, res, next) => new FuncionarioController().alterar(req, res, next));
router.patch("/:id/inativar", (req, res, next) => new FuncionarioController().inativar(req, res, next));
router.patch("/:id/reativar", (req, res, next) => new FuncionarioController().reativar(req, res, next));

export default router;
