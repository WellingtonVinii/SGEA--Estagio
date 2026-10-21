import express from "express";
import SaidaController from "../controllers/saidaController.js";
import { autorizarPerfis } from "../middleware/autenticacaoMiddleware.js";

const router = express.Router();
const admOuEstoque = autorizarPerfis(
    "ADM", "Administrador", "Adiministrador", "Funcionário do Estoque", "Funcionário Responsável"
);

router.use(admOuEstoque);
router.get("/destinatarios", (req, res, next) => new SaidaController().listarDestinatarios(req, res, next));
router.get("/", (req, res, next) => new SaidaController().listar(req, res, next));
router.get("/:id", (req, res, next) => new SaidaController().buscar(req, res, next));
router.post("/", (req, res, next) => new SaidaController().cadastrar(req, res, next));

export default router;
