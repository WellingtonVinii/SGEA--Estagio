import express from "express";
import ProdutoController from "../controllers/produtoController.js";

const router = express.Router();

router.get("/", (req, res, next) => new ProdutoController().listar(req, res, next));
router.get("/:id", (req, res, next) => new ProdutoController().buscar(req, res, next));
router.post("/", (req, res, next) => new ProdutoController().cadastrar(req, res, next));
router.patch("/:id", (req, res, next) => new ProdutoController().alterar(req, res, next));
router.patch("/:id/inativar", (req, res, next) => new ProdutoController().inativar(req, res, next));
router.patch("/:id/reativar", (req, res, next) => new ProdutoController().reativar(req, res, next));

export default router;
