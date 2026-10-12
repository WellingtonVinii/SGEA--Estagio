import express from "express";
import CategoriaController from "../controllers/categoriaController.js";
import { autorizarPerfis } from "../middleware/autenticacaoMiddleware.js";

const router = express.Router();
const somenteAdm = autorizarPerfis("ADM", "Administrador", "Adiministrador");

router.get("/", (req, res, next) => {
    new CategoriaController().listar(req, res, next);
});

router.get("/:id", (req, res, next) => {
    new CategoriaController().buscar(req, res, next);
});

router.post("/", somenteAdm, (req, res, next) => {
    new CategoriaController().cadastrar(req, res, next);
});

router.patch("/:id", somenteAdm, (req, res, next) => {
    new CategoriaController().alterar(req, res, next);
});

router.patch("/:id/inativar", somenteAdm, (req, res, next) => {
    new CategoriaController().inativar(req, res, next);
});

router.patch("/:id/reativar", somenteAdm, (req, res, next) => {
    new CategoriaController().reativar(req, res, next);
});

export default router;
