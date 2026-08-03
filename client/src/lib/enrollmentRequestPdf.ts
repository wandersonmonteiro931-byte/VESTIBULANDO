import { addResponsibleStampToPdf } from "@/lib/pdfResponsibleStamp";

export interface EnrollmentRequestPdfData {
  matricula: string;
  dataSolicitacao: string;
  nome: string;
  dataNascimento: string;
  cpf: string;
  sexo: string;
  escolaridade: string;
  telefone: string;
  email: string;
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
  turma: string;
  disponibilidade: string[];
  horarioEspecialObservacao?: string | null;
  fotoBase64?: string | null;
  reenviada?: boolean;
  situacao?: string;
}

function formatDateOnly(value: string): string {
  if (!value) return "Não informado";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return value;
}

function formatDateTime(value: string): string {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function safeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

export async function generateEnrollmentRequestPdf(data: EnrollmentRequestPdfData): Promise<void> {
  const [{ default: jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableModule.default || (autoTableModule as any).autoTable) as any;

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const photoWidth = 25;
  const photoHeight = 33;
  const situacao = data.situacao?.trim() || "Aguardando análise da diretoria";

  pdf.setFillColor(91, 51, 255);
  pdf.rect(0, 0, pageWidth, 36, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("VESTIBULANDO", margin, 14);
  pdf.setFontSize(11);
  pdf.text("SOLICITAÇÃO DE MATRÍCULA", margin, 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("Portal Escolar e Preparatório EAD", margin, 29);

  const photoX = pageWidth - margin - photoWidth;
  const photoY = 40;
  pdf.setDrawColor(130, 130, 130);
  pdf.setLineWidth(0.35);
  pdf.rect(photoX, photoY, photoWidth, photoHeight);

  if (data.fotoBase64) {
    try {
      const imageFormat = data.fotoBase64.startsWith("data:image/png") ? "PNG" : "JPEG";
      pdf.addImage(data.fotoBase64, imageFormat, photoX, photoY, photoWidth, photoHeight);
    } catch (error) {
      console.error("Não foi possível adicionar a foto ao PDF da matrícula:", error);
      pdf.setTextColor(140, 140, 140);
      pdf.setFontSize(8);
      pdf.text("FOTO NÃO", photoX + photoWidth / 2, photoY + 15, { align: "center" });
      pdf.text("DISPONÍVEL", photoX + photoWidth / 2, photoY + 20, { align: "center" });
    }
  } else {
    pdf.setTextColor(140, 140, 140);
    pdf.setFontSize(9);
    pdf.text("FOTO", photoX + photoWidth / 2, photoY + 15, { align: "center" });
    pdf.text("3x4", photoX + photoWidth / 2, photoY + 21, { align: "center" });
  }

  pdf.setTextColor(25, 25, 35);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(`Matrícula: ${data.matricula}`, margin, 47);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text(`Situação: ${situacao.toUpperCase()}`, margin, 54);
  pdf.text(`Enviada em: ${formatDateTime(data.dataSolicitacao)}`, margin, 61);
  if (data.reenviada) {
    pdf.setTextColor(91, 51, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text("Solicitação corrigida e reenviada", margin, 68);
  }

  let nextY = 80;

  const section = (title: string, rows: Array<[string, string]>) => {
    if (nextY > pageHeight - 48) {
      pdf.addPage();
      nextY = 20;
    }

    pdf.setTextColor(45, 45, 55);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(title, margin, nextY);

    autoTable(pdf, {
      startY: nextY + 3,
      body: rows.map(([label, value]) => [label, value || "Não informado"]),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2.4,
        textColor: [35, 35, 45],
        lineColor: [215, 215, 225],
        lineWidth: 0.25,
        valign: "middle",
        overflow: "linebreak",
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 48, fillColor: [245, 244, 255] },
        1: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
      pageBreak: "auto",
      rowPageBreak: "avoid",
    });

    nextY = ((pdf as any).lastAutoTable?.finalY || nextY + 15) + 8;
  };

  section("DADOS DA SOLICITAÇÃO", [
    ["Número de matrícula", data.matricula],
    ["Data e horário do envio", formatDateTime(data.dataSolicitacao)],
    ["Turma solicitada", data.turma],
    ["Situação", situacao],
  ]);

  section("DADOS PESSOAIS", [
    ["Nome completo", data.nome],
    ["CPF", data.cpf],
    ["Data de nascimento", formatDateOnly(data.dataNascimento)],
    ["Sexo", data.sexo],
    ["Escolaridade", data.escolaridade],
    ["Telefone", data.telefone],
    ["E-mail", data.email],
  ]);

  section("ENDEREÇO", [
    ["CEP", data.cep],
    ["Rua / logradouro", data.rua],
    ["Bairro", data.bairro],
    ["Cidade", data.cidade],
    ["Estado", data.estado],
  ]);

  const availability = data.disponibilidade.length > 0
    ? data.disponibilidade.join(", ")
    : "Não informado";

  const scheduleRows: Array<[string, string]> = [["Disponibilidade", availability]];
  if (data.horarioEspecialObservacao) {
    scheduleRows.push(["Detalhes do horário especial", data.horarioEspecialObservacao]);
  }
  section("DISPONIBILIDADE PARA ESTUDOS", scheduleRows);

  if (nextY > pageHeight - 48) {
    pdf.addPage();
    nextY = 20;
  }

  const note = `Este documento registra os dados informados no pedido de matrícula. A geração do número não representa aprovação definitiva. Situação registrada no momento da emissão: ${situacao}. O acompanhamento pode ser realizado pela página inicial usando o número de matrícula acima.`;
  const noteLines = pdf.splitTextToSize(note, pageWidth - margin * 2 - 8);
  const noteHeight = Math.max(28, noteLines.length * 4.5 + 8);
  pdf.setFillColor(247, 247, 252);
  pdf.roundedRect(margin, nextY, pageWidth - margin * 2, noteHeight, 2, 2, "F");
  pdf.setTextColor(65, 65, 75);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.text(noteLines, margin + 4, nextY + 7);

  let stampY = nextY + noteHeight + 6;
  if (stampY > pageHeight - 52) {
    pdf.addPage();
    stampY = 18;
  }
  await addResponsibleStampToPdf(pdf, { y: stampY, width: 72, label: "Diretoria Responsável" });

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(225, 225, 232);
    pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    pdf.setTextColor(110, 110, 120);
    pdf.setFontSize(7.5);
    pdf.text(`Documento gerado automaticamente pelo Vestibulando • Matrícula ${data.matricula}`, margin, pageHeight - 8);
    pdf.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  const namePart = safeFileName(data.nome) || "aluno";
  pdf.save(`solicitacao-matricula-${data.matricula}-${namePart}.pdf`);
}
