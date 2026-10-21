import 'dotenv/config';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import categoriaRouter from './routes/cetegoriaRouter.js';
import produtoRouter from './routes/produtoRouter.js';
import funcionarioRouter from './routes/funcionarioRouter.js';
import autenticacaoRouter from './routes/autenticacaoRouter.js';
import usuarioRouter from './routes/usuarioRouter.js';
import pedidoCompraRouter from './routes/pedidoCompraRouter.js';
import entradaRouter from './routes/entradaRouter.js';
import saidaRouter from './routes/saidaRouter.js';
import autenticarToken, { autorizarPerfis } from './middleware/autenticacaoMiddleware.js';
import swaggerDocument from './swagger-document.js';

const server = express();

server.use(express.json());
server.use('/autenticacao', autenticacaoRouter);
server.use(autenticarToken);
const somenteAdm = autorizarPerfis('ADM', 'Administrador', 'Adiministrador');
server.use('/categorias', categoriaRouter);
server.use('/produtos', produtoRouter);
server.use('/funcionarios', somenteAdm, funcionarioRouter);
server.use('/usuarios', somenteAdm, usuarioRouter);
server.use('/pedidos', pedidoCompraRouter);
server.use('/entradas', entradaRouter);
server.use('/saidas', saidaRouter);
server.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
server.use((erro, req, res, next) => {
    console.error(erro);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
});

if (process.env.NODE_ENV !== 'test') {
    const porta = Number(process.env.PORT) || 5001;
    const servidorHttp = server.listen(porta, () => console.log(`Servidor web em funcionamento na porta ${porta}!`));
    servidorHttp.on('error', erro => {
        if (erro.code === 'EADDRINUSE') {
            console.error(`A porta ${porta} já está em uso. Encerre a instância anterior do backend antes de iniciar outra.`);
            return;
        }
        console.error('Não foi possível iniciar o servidor:', erro);
    });
}

export default server;
