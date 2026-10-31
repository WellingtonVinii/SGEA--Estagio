import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Celula = string | number;
type Tabela = { titulo?: string; colunas: string[]; linhas: Celula[][] };
type Relatorio = {
  titulo: string;
  arquivo: string;
  informacoes?: [string, string][];
  tabelas: Tabela[];
};

const margem = 14;
const azul: [number, number, number] = [7, 103, 233];

export function dataIsoBrasileira(data?: string | null) {
  const correspondencia = data?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!correspondencia) return "—";
  const [, ano, mes, dia, hora, minuto] = correspondencia;
  return `${dia}/${mes}/${ano}${hora ? ` ${hora}:${minuto}` : ""}`;
}

export function periodoTexto(dataInicio: string, dataFim: string) {
  if (dataInicio && dataFim) return `${dataIsoBrasileira(dataInicio)} a ${dataIsoBrasileira(dataFim)}`;
  if (dataInicio) return `A partir de ${dataIsoBrasileira(dataInicio)}`;
  if (dataFim) return `Até ${dataIsoBrasileira(dataFim)}`;
  return "Todo o período";
}

export function baixarRelatorioPdf({ titulo, arquivo, informacoes = [], tabelas }: Relatorio) {
  const documento = new jsPDF();
  const largura = documento.internal.pageSize.getWidth();
  const altura = documento.internal.pageSize.getHeight();

  documento.setFontSize(9);
  documento.setTextColor(100);
  documento.text("SGEA - Sistema de Gestão de Estoque do Almoxarifado", margem, 14);
  documento.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, largura - margem, 14, { align: "right" });
  documento.setDrawColor(...azul);
  documento.line(margem, 17, largura - margem, 17);

  documento.setFontSize(16);
  documento.setTextColor(20);
  documento.setFont("helvetica", "bold");
  documento.text(titulo, margem, 27);

  let y = 36;
  documento.setFontSize(10);
  for (const [rotulo, valor] of informacoes) {
    documento.setFont("helvetica", "bold");
    documento.text(`${rotulo}:`, margem, y);
    documento.setFont("helvetica", "normal");
    const linhas = documento.splitTextToSize(valor || "—", largura - margem * 2 - 38);
    documento.text(linhas, margem + 38, y);
    y += 5.5 * linhas.length;
  }

  for (const tabela of tabelas) {
    y += 4;
    if (y > altura - 40) {
      documento.addPage();
      y = 20;
    }
    if (tabela.titulo) {
      documento.setFont("helvetica", "bold");
      documento.setFontSize(12);
      documento.text(tabela.titulo, margem, y);
      y += 3;
    }
    autoTable(documento, {
      startY: y,
      head: [tabela.colunas],
      body: tabela.linhas.length
        ? tabela.linhas
        : [[{ content: "Nenhum registro encontrado.", colSpan: tabela.colunas.length, styles: { halign: "center" } }]],
      margin: { left: margem, right: margem },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: azul, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 247, 251] }
    });
    y = (documento as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  const paginas = documento.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    documento.setPage(pagina);
    documento.setFont("helvetica", "normal");
    documento.setFontSize(8);
    documento.setTextColor(120);
    documento.text(`Página ${pagina} de ${paginas}`, largura - margem, altura - 8, { align: "right" });
  }
  documento.save(arquivo);
}
