-- Funcionário que solicitou o ajuste de estoque.
-- Nulo apenas para ajustes registrados antes desta alteração.
ALTER TABLE AjusteEstoque
    ADD COLUMN SolicitanteId INT NULL AFTER FuncionarioId,
    ADD CONSTRAINT FK_AjusteEstoque_Solicitante FOREIGN KEY (SolicitanteId) REFERENCES Funcionario (Id);
