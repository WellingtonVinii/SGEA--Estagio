import express from "express";
import EstoqueController from "../controllers/estoqueController.js";
import { autorizarPerfis } from "../middleware/autenticacaoMiddleware.js";

const router = express.Router();
const admOuEstoque = autorizarPerfis(
    "ADM", "Administrador", "Adiministrador", "Funcionário do Estoque", "Funcionário Responsável"
);

router.use(admOuEstoque);
router.get("/", (req, res, next) => new EstoqueController().consultar(req, res, next));

export default router;
