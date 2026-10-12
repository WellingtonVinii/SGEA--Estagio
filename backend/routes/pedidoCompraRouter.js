import express from "express";
import PedidoCompraController from "../controllers/pedidoCompraController.js";
import { autorizarPerfis } from "../middleware/autenticacaoMiddleware.js";

const router = express.Router();
const somenteAdm = autorizarPerfis("ADM", "Administrador", "Adiministrador");
const admOuEstoque = autorizarPerfis(
    "ADM", "Administrador", "Adiministrador", "Funcionário do Estoque", "Funcionário Responsável"
);

router.get("/", admOuEstoque, (req, res, next) => new PedidoCompraController().listar(req, res, next));
router.get("/:id", admOuEstoque, (req, res, next) => new PedidoCompraController().buscar(req, res, next));
router.post("/", somenteAdm, (req, res, next) => new PedidoCompraController().cadastrar(req, res, next));
router.put("/:id", somenteAdm, (req, res, next) => new PedidoCompraController().alterar(req, res, next));
router.patch("/:id/situacao", admOuEstoque, (req, res, next) => new PedidoCompraController().alterarSituacao(req, res, next));

export default router;
