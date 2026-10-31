import express from "express";
import AjusteEstoqueController from "../controllers/ajusteEstoqueController.js";
import { autorizarPerfis } from "../middleware/autenticacaoMiddleware.js";

const router = express.Router();
const admOuEstoque = autorizarPerfis(
    "ADM", "Administrador", "Adiministrador", "Funcionário do Estoque", "Funcionário Responsável"
);

router.use(admOuEstoque);
router.get("/", (req, res, next) => new AjusteEstoqueController().listar(req, res, next));
router.get("/funcionarios", (req, res, next) => new AjusteEstoqueController().listarFuncionarios(req, res, next));
router.get("/:id",(req, res, next) => new AjusteEstoqueController().buscar(req, res, next));
router.post("/", (req, res, next) => new AjusteEstoqueController().cadastrar(req, res, next));

export default router;
