import express from "express";
import EntradaController from "../controllers/entradaController.js";
import { autorizarPerfis } from "../middleware/autenticacaoMiddleware.js";

const router = express.Router();
const admOuEstoque = autorizarPerfis(
    "ADM", "Administrador", "Adiministrador", "Funcionário do Estoque", "Funcionário Responsável"
);

router.use(admOuEstoque);
router.get("/", (req, res, next) => new EntradaController().listar(req, res, next));
router.get("/:id", (req, res, next) => new EntradaController().buscar(req, res, next));
router.post("/", (req, res, next) => new EntradaController().cadastrar(req, res, next));
router.put("/:id", (req, res, next) => new EntradaController().alterar(req, res, next));
router.patch("/:id/cancelar", (req, res, next) => new EntradaController().cancelar(req, res, next));

export default router;
