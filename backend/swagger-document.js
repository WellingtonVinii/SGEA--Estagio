const erro = {
    type: 'object',
    properties: { erro: { type: 'string' } }
};

const categoria = {
    type: 'object',
    properties: {
        id: { type: 'integer', example: 1 },
        nome: { type: 'string', example: 'Material escolar' },
        ativo: { type: 'boolean', example: true }
    }
};

const lote = {
    type: 'object',
    properties: {
        id: { type: 'integer', example: 1 },
        codigoLote: { type: 'string', example: 'LT-2026-01' },
        quantidadeDisponivel: { type: 'integer', example: 25 },
        dataValidade: { type: 'string', format: 'date', nullable: true, example: '2027-12-31' },
        produtoId: { type: 'integer', example: 1 }
    }
};

const produto = {
    type: 'object',
    properties: {
        id: { type: 'integer', example: 1 },
        nome: { type: 'string', example: 'Cola branca' },
        ativo: { type: 'boolean', example: true },
        categoriaId: { type: 'integer', example: 1 },
        categoriaNome: { type: 'string', example: 'Material escolar' },
        quantidadeTotal: { type: 'integer', example: 25 },
        lotes: { type: 'array', items: lote }
    }
};

const funcionario = {
    type: 'object',
    properties: {
        id: { type: 'integer', example: 1 },
        nome: { type: 'string', example: 'Maria da Silva' },
        cpf: { type: 'string', example: '52998224725' },
        cargo: { type: 'string', example: 'Professora' },
        telefone: { type: 'string', example: '18999998888' },
        email: { type: 'string', format: 'email', example: 'maria@escola.com' },
        ativo: { type: 'boolean', example: true },
        possuiUsuario: { type: 'boolean', example: false }
    }
};

const itemPedidoCompra = {
    type: 'object',
    properties: {
        produtoId: { type: 'integer', minimum: 1, example: 1 },
        produtoNome: { type: 'string', example: 'Papel sulfite A4' },
        quantidade: { type: 'integer', minimum: 1, example: 10 },
        quantidadeAtendida: { type: 'integer', minimum: 0, example: 4 },
        quantidadeRecebida: { type: 'integer', minimum: 0, example: 4, description: 'Alias de quantidadeAtendida usado pelo frontend.' },
        quantidadePendente: { type: 'integer', minimum: 0, example: 6 },
        produtoAtivo: { type: 'boolean', example: true }
    }
};

const pedidoCompra = {
    type: 'object',
    properties: {
        id: { type: 'integer', example: 1 },
        dataSolicitacao: { type: 'string', format: 'date', example: '2026-10-02' },
        situacao: { type: 'string', enum: ['Pendente', 'Parcialmente Recebido', 'Recebido', 'Cancelado'] },
        observacao: { type: 'string', nullable: true, maxLength: 255 },
        funcionarioId: { type: 'integer', example: 1 },
        funcionarioNome: { type: 'string', example: 'Maria da Silva' },
        itens: { type: 'array', items: itemPedidoCompra },
        quantidadeItens: { type: 'integer', example: 2 },
        totalUnidades: { type: 'integer', example: 15 }
    }
};

const entrada = {
    type: 'object',
    properties: {
        id: { type: 'integer', example: 1 },
        pedidoCompraId: { type: 'integer', nullable: true, example: 1 },
        funcionarioId: { type: 'integer', example: 1 },
        funcionarioNome: { type: 'string', example: 'Maria da Silva' },
        dataEntrada: { type: 'string', format: 'date' },
        observacao: { type: 'string', nullable: true, maxLength: 500 },
        situacao: { type: 'string', enum: ['Ativa', 'Cancelada'] },
        itens: { type: 'array', items: {
            type: 'object', properties: {
                id: { type: 'integer' }, produtoId: { type: 'integer' }, produtoNome: { type: 'string' },
                quantidade: { type: 'integer', minimum: 1 }, loteId: { type: 'integer' },
                codigoLote: { type: 'string' }, dataValidade: { type: 'string', format: 'date', nullable: true }
            }
        } }
    }
};

const dadosEntrada = {
    type: 'object', additionalProperties: false, required: ['itens'],
    properties: {
        pedidoCompraId: { type: 'integer', minimum: 1, nullable: true, description: 'Opcional para entradas avulsas.' },
        dataEntrada: { type: 'string', format: 'date', nullable: true, description: 'Entre um mês atrás e a data atual; no cadastro, a omissão usa a data atual.' },
        observacao: { type: 'string', nullable: true, maxLength: 500 },
        itens: { type: 'array', minItems: 1, items: {
            type: 'object', additionalProperties: false, required: ['produtoId', 'quantidade'],
            properties: {
                produtoId: { type: 'integer', minimum: 1 }, quantidade: { type: 'integer', minimum: 1 },
                loteId: { type: 'integer', minimum: 1, nullable: true },
                codigoLote: { type: 'string', maxLength: 50, nullable: true },
                dataValidade: { type: 'string', format: 'date', nullable: true }
            }
        } }
    }
};

const dadosPedidoCompra = {
    type: 'object', additionalProperties: false, required: ['itens'],
    properties: {
        dataSolicitacao: { type: 'string', format: 'date', nullable: true, description: 'Deve estar entre um mês atrás e a data atual. Quando omitida no cadastro, recebe a data atual.' },
        observacao: { type: 'string', nullable: true, maxLength: 255 },
        itens: { type: 'array', minItems: 1, items: {
            type: 'object', additionalProperties: false, required: ['produtoId', 'quantidade'],
            properties: {
                produtoId: { type: 'integer', minimum: 1 },
                quantidade: { type: 'integer', minimum: 1 }
            }
        } }
    }
};

const itemSaida = {
    type: 'object', properties: {
        produtoId: { type: 'integer', example: 1 }, produtoNome: { type: 'string', example: 'Papel A4' },
        quantidade: { type: 'integer', example: 8 },
        lotes: { type: 'array', items: { type: 'object', properties: {
            loteId: { type: 'integer', example: 1 }, codigoLote: { type: 'string', example: 'L001' },
            dataValidade: { type: 'string', format: 'date', nullable: true }, quantidade: { type: 'integer', example: 5 }
        } } }
    }
};

const saida = {
    type: 'object', properties: {
        id: { type: 'integer', example: 1 }, dataSaida: { type: 'string', format: 'date-time' },
        observacao: { type: 'string', nullable: true, maxLength: 255 },
        funcionarioId: { type: 'integer' }, funcionarioNome: { type: 'string' },
        destinatarioId: { type: 'integer' }, destinatarioNome: { type: 'string' },
        produtos: { type: 'array', items: itemSaida }, quantidadeProdutos: { type: 'integer' }, totalUnidades: { type: 'integer' }
    }
};

const dadosSaida = {
    type: 'object', additionalProperties: false, required: ['destinatarioId', 'produtos'],
    properties: {
        destinatarioId: { type: 'integer', minimum: 1 }, observacao: { type: 'string', nullable: true, maxLength: 255 },
        produtos: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false,
            required: ['produtoId', 'quantidade', 'lotes'], properties: {
                produtoId: { type: 'integer', minimum: 1 }, quantidade: { type: 'integer', minimum: 1 },
                lotes: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false,
                    required: ['loteId', 'quantidade'], properties: {
                        loteId: { type: 'integer', minimum: 1 }, quantidade: { type: 'integer', minimum: 1 }
                    } }
                }
            }
        } }
    }
};

const resposta = (descricao, schema) => ({
    description: descricao,
    content: { 'application/json': { schema } }
});

const parametroId = descricao => ({
    name: 'id', in: 'path', required: true, description: descricao,
    schema: { type: 'integer', minimum: 1 }
});

const idCategoria = parametroId('Id da categoria');
const idProduto = parametroId('Id do produto');
const idFuncionario = parametroId('Id do funcionário');
const idPedido = parametroId('Id do pedido de compra');
const idEntrada = parametroId('Id da entrada');
const idSaida = parametroId('Id da saída');

export default {
    openapi: '3.0.3',
    info: {
        title: 'SGEA - API',
        version: '1.0.0',
        description: 'Gerenciamento de categorias, produtos, lotes, funcionários e pedidos de compra.'
    },
    tags: [
        { name: 'Autenticação' },
        { name: 'Categorias' },
        { name: 'Produtos' },
        { name: 'Funcionários' },
        { name: 'Pedidos de compra' },
        { name: 'Entradas' },
        { name: 'Saídas' }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        }
    },
    security: [{ bearerAuth: [] }],
    paths: {
        '/autenticacao/token': {
            post: {
                tags: ['Autenticação'],
                summary: 'Gerar token JWT com validade de 5 horas',
                security: [],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', additionalProperties: false, required: ['email', 'senha'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        senha: { type: 'string', format: 'password' }
                    }
                } } } },
                responses: {
                    200: resposta('Token gerado', {
                        type: 'object',
                        properties: {
                            token: { type: 'string' },
                            tipo: { type: 'string', example: 'Bearer' },
                            expiraEmSegundos: { type: 'integer', example: 18000 },
                            usuario: { type: 'object' }
                        }
                    }),
                    400: resposta('Credenciais inválidas', erro),
                    401: resposta('E-mail ou senha inválidos', erro)
                }
            }
        },
        '/categorias': {
            get: {
                tags: ['Categorias'], summary: 'Listar e buscar categorias',
                parameters: [
                    { name: 'nome', in: 'query', schema: { type: 'string' } },
                    { name: 'situacao', in: 'query', schema: {
                        type: 'string', enum: ['todas', 'ativas', 'inativas'], default: 'todas'
                    } }
                ],
                responses: {
                    200: resposta('Categorias encontradas', { type: 'array', items: categoria }),
                    400: resposta('Parâmetros inválidos', erro)
                }
            },
            post: {
                tags: ['Categorias'], summary: 'Cadastrar categoria',
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['nome', 'ativo'], additionalProperties: false,
                    properties: {
                        nome: { type: 'string', maxLength: 100 },
                        ativo: { type: 'boolean' }
                    }
                } } } },
                responses: {
                    201: resposta('Categoria cadastrada', categoria),
                    400: resposta('Dados inválidos', erro),
                    409: resposta('Nome já cadastrado', erro)
                }
            }
        },
        '/categorias/{id}': {
            get: {
                tags: ['Categorias'], summary: 'Consultar categoria', parameters: [idCategoria],
                responses: {
                    200: resposta('Categoria encontrada', categoria),
                    404: resposta('Categoria não encontrada', erro)
                }
            },
            patch: {
                tags: ['Categorias'], summary: 'Alterar nome da categoria', parameters: [idCategoria],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', required: ['nome'], additionalProperties: false,
                    properties: { nome: { type: 'string', maxLength: 100 } }
                } } } },
                responses: {
                    200: resposta('Categoria alterada', categoria),
                    400: resposta('Dados inválidos', erro),
                    404: resposta('Categoria não encontrada', erro),
                    409: resposta('Nome já cadastrado', erro)
                }
            }
        },
        '/categorias/{id}/inativar': {
            patch: {
                tags: ['Categorias'], summary: 'Inativar categoria sem produtos ativos',
                parameters: [idCategoria], responses: {
                    200: resposta('Categoria inativada', categoria),
                    404: resposta('Categoria não encontrada', erro),
                    409: resposta('A categoria possui produtos ativos', erro)
                }
            }
        },
        '/categorias/{id}/reativar': {
            patch: {
                tags: ['Categorias'], summary: 'Reativar categoria', parameters: [idCategoria],
                responses: {
                    200: resposta('Categoria reativada', categoria),
                    404: resposta('Categoria não encontrada', erro)
                }
            }
        },
        '/produtos': {
            get: {
                tags: ['Produtos'], summary: 'Listar e buscar produtos ativos e inativos',
                parameters: [
                    { name: 'nome', in: 'query', description: 'Trecho do nome', schema: { type: 'string' } },
                    { name: 'situacao', in: 'query', schema: {
                        type: 'string', enum: ['todos', 'ativos', 'inativos'], default: 'todos'
                    } }
                ],
                responses: {
                    200: resposta('Produtos encontrados', { type: 'array', items: produto }),
                    400: resposta('Parâmetros inválidos', erro)
                }
            },
            post: {
                tags: ['Produtos'], summary: 'Cadastrar produto com lote inicial',
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object',
                    required: ['nome', 'categoriaId', 'quantidadeLote'],
                    additionalProperties: false,
                    properties: {
                        nome: { type: 'string', maxLength: 150, example: 'Cola branca' },
                        categoriaId: { type: 'integer', minimum: 1, example: 1 },
                        codigoLote: {
                            type: 'string', maxLength: 50, nullable: true,
                            description: 'Quando omitido, vazio ou nulo, recebe o código 1.'
                        },
                        quantidadeLote: { type: 'integer', minimum: 1, example: 25 },
                        dataValidade: { type: 'string', format: 'date', nullable: true }
                    }
                } } } },
                responses: {
                    201: resposta('Produto e lote inicial cadastrados', produto),
                    400: resposta('Dados inválidos', erro),
                    409: resposta('Nome já cadastrado ou categoria indisponível', erro)
                }
            }
        },
        '/produtos/{id}': {
            get: {
                tags: ['Produtos'], summary: 'Consultar produto e seus lotes', parameters: [idProduto],
                responses: {
                    200: resposta('Produto encontrado', produto),
                    400: resposta('Id inválido', erro),
                    404: resposta('Produto não encontrado', erro)
                }
            },
            patch: {
                tags: ['Produtos'], summary: 'Alterar nome e/ou categoria', parameters: [idProduto],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', minProperties: 1, additionalProperties: false,
                    properties: {
                        nome: { type: 'string', maxLength: 150 },
                        categoriaId: { type: 'integer', minimum: 1 }
                    }
                } } } },
                responses: {
                    200: resposta('Produto alterado', produto),
                    400: resposta('Dados inválidos', erro),
                    404: resposta('Produto não encontrado', erro),
                    409: resposta('Nome já cadastrado ou categoria indisponível', erro)
                }
            }
        },
        '/produtos/{id}/inativar': {
            patch: {
                tags: ['Produtos'], summary: 'Inativar produto com estoque zerado',
                parameters: [idProduto], responses: {
                    200: resposta('Produto inativado', produto),
                    404: resposta('Produto não encontrado', erro),
                    409: resposta('Produto ainda possui estoque disponível', erro)
                }
            }
        },
        '/produtos/{id}/reativar': {
            patch: {
                tags: ['Produtos'], summary: 'Reativar produto preservando o histórico',
                parameters: [idProduto], responses: {
                    200: resposta('Produto reativado', produto),
                    404: resposta('Produto não encontrado', erro),
                    409: resposta('Categoria do produto está inativa', erro)
                }
            }
        },
        '/funcionarios': {
            get: {
                tags: ['Funcionários'], summary: 'Listar e filtrar funcionários ativos e inativos',
                parameters: [
                    { name: 'nome', in: 'query', schema: { type: 'string', maxLength: 150 } },
                    { name: 'cargo', in: 'query', schema: { type: 'string', maxLength: 100 } },
                    { name: 'situacao', in: 'query', schema: {
                        type: 'string', enum: ['todos', 'ativos', 'inativos'], default: 'todos'
                    } }
                ],
                responses: {
                    200: resposta('Funcionários encontrados', { type: 'array', items: funcionario }),
                    400: resposta('Filtros inválidos', erro)
                }
            },
            post: {
                tags: ['Funcionários'], summary: 'Cadastrar funcionário',
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', additionalProperties: false,
                    required: ['nome', 'cpf', 'cargo', 'telefone', 'email'],
                    properties: {
                        nome: { type: 'string', maxLength: 150 },
                        cpf: { type: 'string', description: 'CPF válido, com ou sem pontuação' },
                        cargo: { type: 'string', maxLength: 100 },
                        telefone: { type: 'string', description: 'Telefone com DDD, com ou sem formatação' },
                        email: { type: 'string', format: 'email', maxLength: 150 }
                    }
                } } } },
                responses: {
                    201: resposta('Funcionário cadastrado', funcionario),
                    400: resposta('Dados inválidos', erro),
                    409: resposta('CPF já cadastrado', erro)
                }
            }
        },
        '/funcionarios/cargos': {
            get: {
                tags: ['Funcionários'], summary: 'Listar cargos cadastrados',
                responses: {
                    200: resposta('Cargos encontrados', { type: 'array', items: { type: 'string' } })
                }
            }
        },
        '/funcionarios/{id}': {
            get: {
                tags: ['Funcionários'], summary: 'Consultar funcionário', parameters: [idFuncionario],
                responses: {
                    200: resposta('Funcionário encontrado', funcionario),
                    400: resposta('Id inválido', erro),
                    404: resposta('Funcionário não encontrado', erro)
                }
            },
            patch: {
                tags: ['Funcionários'], summary: 'Alterar dados do funcionário', parameters: [idFuncionario],
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', minProperties: 1, additionalProperties: false,
                    properties: {
                        nome: { type: 'string', maxLength: 150 },
                        cpf: { type: 'string' },
                        cargo: { type: 'string', maxLength: 100 },
                        telefone: { type: 'string' },
                        email: { type: 'string', format: 'email', maxLength: 150 }
                    }
                } } } },
                responses: {
                    200: resposta('Funcionário alterado', funcionario),
                    400: resposta('Dados inválidos', erro),
                    404: resposta('Funcionário não encontrado', erro),
                    409: resposta('CPF já cadastrado', erro)
                }
            }
        },
        '/funcionarios/{id}/inativar': {
            patch: {
                tags: ['Funcionários'],
                summary: 'Inativar funcionário e seu usuário associado',
                parameters: [idFuncionario],
                responses: {
                    200: resposta('Funcionário inativado', funcionario),
                    404: resposta('Funcionário não encontrado', erro)
                }
            }
        },
        '/funcionarios/{id}/reativar': {
            patch: {
                tags: ['Funcionários'],
                summary: 'Reativar somente o funcionário',
                parameters: [idFuncionario],
                responses: {
                    200: resposta('Funcionário reativado', funcionario),
                    404: resposta('Funcionário não encontrado', erro)
                }
            }
        },
        '/pedidos': {
            get: {
                tags: ['Pedidos de compra'], summary: 'Listar pedidos de compra',
                description: 'Disponível para ADM e Funcionário do Estoque.',
                parameters: [
                    { name: 'busca', in: 'query', schema: { type: 'string', maxLength: 150 } },
                    { name: 'situacao', in: 'query', schema: { type: 'string', enum: ['Todas', 'Pendente', 'Parcialmente Recebido', 'Recebido', 'Cancelado'], default: 'Todas' } }
                ],
                responses: {
                    200: resposta('Pedidos encontrados', { type: 'array', items: pedidoCompra }),
                    400: resposta('Filtros inválidos', erro),
                    403: resposta('Perfil sem permissão', erro)
                }
            },
            post: {
                tags: ['Pedidos de compra'], summary: 'Cadastrar pedido de compra',
                description: 'Somente ADM. O funcionário é obtido do usuário autenticado e a situação inicial é Pendente.',
                requestBody: { required: true, content: { 'application/json': { schema: dadosPedidoCompra } } },
                responses: {
                    201: resposta('Pedido cadastrado', pedidoCompra),
                    400: resposta('Pedido ou produtos inválidos', erro),
                    403: resposta('Perfil sem permissão', erro),
                    409: resposta('Produto repetido', erro)
                }
            }
        },
        '/pedidos/{id}': {
            get: {
                tags: ['Pedidos de compra'], summary: 'Consultar detalhes do pedido', parameters: [idPedido],
                responses: {
                    200: resposta('Pedido encontrado', pedidoCompra),
                    404: resposta('Pedido não encontrado', erro)
                }
            },
            put: {
                tags: ['Pedidos de compra'], summary: 'Alterar pedido pendente', parameters: [idPedido],
                description: 'Somente ADM. O funcionário responsável original é preservado.',
                requestBody: { required: true, content: { 'application/json': { schema: dadosPedidoCompra } } },
                responses: {
                    200: resposta('Pedido alterado', pedidoCompra),
                    400: resposta('Dados inválidos', erro),
                    403: resposta('Perfil sem permissão', erro),
                    404: resposta('Pedido não encontrado', erro),
                    409: resposta('Pedido não está pendente', erro)
                }
            }
        },
        '/pedidos/{id}/situacao': {
            patch: {
                tags: ['Pedidos de compra'], summary: 'Cancelar pedido pendente', parameters: [idPedido],
                description: 'Disponível para ADM e Funcionário do Estoque. Esta rota realiza somente o cancelamento; o recebimento é atualizado automaticamente pelas entradas.',
                requestBody: { required: true, content: { 'application/json': { schema: {
                    type: 'object', additionalProperties: false, required: ['situacao'],
                    properties: { situacao: { type: 'string', enum: ['Cancelado'] } }
                } } } },
                responses: {
                    200: resposta('Situação alterada', pedidoCompra),
                    400: resposta('Situação inválida', erro),
                    403: resposta('Perfil sem permissão', erro),
                    404: resposta('Pedido não encontrado', erro),
                    409: resposta('Pedido já finalizado', erro)
                }
            }
        },
        '/entradas': {
            get: {
                tags: ['Entradas'], summary: 'Listar entradas',
                parameters: [
                    { name: 'busca', in: 'query', schema: { type: 'string', maxLength: 150 } },
                    { name: 'situacao', in: 'query', schema: { type: 'string', enum: ['Todas', 'Ativa', 'Cancelada'], default: 'Todas' } }
                ],
                responses: { 200: resposta('Entradas encontradas', { type: 'array', items: entrada }) }
            },
            post: {
                tags: ['Entradas'], summary: 'Registrar entrada e atualizar os lotes',
                description: 'Disponível para ADM e Funcionário do Estoque. Atualiza o estoque e a situação do pedido em uma única transação.',
                requestBody: { required: true, content: { 'application/json': { schema: dadosEntrada } } },
                responses: {
                    201: resposta('Entrada registrada', entrada), 400: resposta('Dados inválidos', erro),
                    404: resposta('Pedido não encontrado', erro), 409: resposta('Quantidade excedida', erro)
                }
            }
        },
        '/entradas/{id}': {
            get: {
                tags: ['Entradas'], summary: 'Consultar entrada', parameters: [idEntrada],
                responses: { 200: resposta('Entrada encontrada', entrada), 404: resposta('Entrada não encontrada', erro) }
            },
            put: {
                tags: ['Entradas'], summary: 'Alterar entrada e recalcular o estoque', parameters: [idEntrada],
                requestBody: { required: true, content: { 'application/json': { schema: dadosEntrada } } },
                responses: {
                    200: resposta('Entrada alterada', entrada), 400: resposta('Dados inválidos', erro),
                    404: resposta('Entrada não encontrada', erro), 409: resposta('Alteração incompatível com os saldos', erro)
                }
            }
        },
        '/entradas/{id}/cancelar': {
            patch: {
                tags: ['Entradas'], summary: 'Cancelar entrada e reverter o estoque', parameters: [idEntrada],
                responses: {
                    200: resposta('Entrada cancelada', entrada), 404: resposta('Entrada não encontrada', erro),
                    409: resposta('Cancelamento deixaria saldo negativo', erro)
                }
            }
        },
        '/saidas': {
            get: {
                tags: ['Saídas'], summary: 'Listar saídas',
                parameters: [{ name: 'busca', in: 'query', schema: { type: 'string', maxLength: 150 } }],
                responses: { 200: resposta('Saídas encontradas', { type: 'array', items: saida }) }
            },
            post: {
                tags: ['Saídas'], summary: 'Registrar saída e descontar o estoque',
                description: 'Valida produtos e lotes e grava toda a movimentação em uma única transação.',
                requestBody: { required: true, content: { 'application/json': { schema: dadosSaida } } },
                responses: {
                    201: resposta('Saída registrada', saida), 400: resposta('Dados inválidos', erro),
                    403: resposta('Perfil sem permissão', erro), 409: resposta('Estoque ou lote incompatível', erro)
                }
            }
        },
        '/saidas/destinatarios': {
            get: {
                tags: ['Saídas'], summary: 'Listar funcionários ativos para recebimento',
                responses: { 200: resposta('Funcionários encontrados', { type: 'array', items: funcionario }) }
            }
        },
        '/saidas/{id}': {
            get: {
                tags: ['Saídas'], summary: 'Consultar detalhes da saída', parameters: [idSaida],
                responses: { 200: resposta('Saída encontrada', saida), 404: resposta('Saída não encontrada', erro) }
            }
        }
    }
};
