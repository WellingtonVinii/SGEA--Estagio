-- Entradas passam a ser excluídas em vez de canceladas, então a coluna Situacao deixa de existir.
-- As entradas já canceladas tiveram o estoque revertido no cancelamento e são removidas antes da coluna.
CREATE TEMPORARY TABLE LoteEntradaCancelada AS
    SELECT DISTINCT ie.LoteId FROM ItemEntrada ie JOIN Entrada e ON e.Id = ie.EntradaId WHERE e.Situacao = 'Cancelada';

DELETE ie FROM ItemEntrada ie JOIN Entrada e ON e.Id = ie.EntradaId WHERE e.Situacao = 'Cancelada';
DELETE FROM Entrada WHERE Situacao = 'Cancelada';

DELETE l FROM Lote l JOIN LoteEntradaCancelada t ON t.LoteId = l.Id
 WHERE l.QuantidadeDisponivel = 0
   AND NOT EXISTS (SELECT 1 FROM ItemEntrada ie WHERE ie.LoteId = l.Id)
   AND NOT EXISTS (SELECT 1 FROM ItemSaida isa WHERE isa.LoteId = l.Id)
   AND NOT EXISTS (SELECT 1 FROM ItemAjusteEstoque ia WHERE ia.LoteId = l.Id);

DROP TEMPORARY TABLE LoteEntradaCancelada;

ALTER TABLE Entrada DROP CHECK CK_Entrada_Situacao, DROP COLUMN Situacao;
