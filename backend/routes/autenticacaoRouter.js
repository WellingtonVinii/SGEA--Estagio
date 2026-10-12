import express from "express";
import AutenticacaoController from "../controllers/autenticacaoController.js";

const router = express.Router();

router.post("/token", (req, res, next) => {
    new AutenticacaoController().gerarToken(req, res, next);
});

export default router;
