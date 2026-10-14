-- Necessário para armazenar o valor "Parcialmente Recebido" (21 caracteres).
ALTER TABLE PedidoCompra
    MODIFY COLUMN Situacao VARCHAR(25) NOT NULL DEFAULT 'Pendente';
