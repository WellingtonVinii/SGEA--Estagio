import express from "express";
import HistoricoController from "../controllers/historicoController.js";
import { autorizarPerfis } from "../middleware/autenticacaoMiddleware.js";

const router = express.Router();
const admOuEstoque = autorizarPerfis(
    "ADM", "Administrador", "Adiministrador", "Funcionário do Estoque", "Funcionário Responsável"
);

router.use(admOuEstoque);
router.get("/funcionarios", (req, res, next) => new HistoricoController().listarResponsaveis(req, res, next));
router.get("/", (req, res, next) => new HistoricoController().listar(req, res, next));

export default router;
