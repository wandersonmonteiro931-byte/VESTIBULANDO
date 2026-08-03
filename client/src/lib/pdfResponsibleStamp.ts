import stampUrl from "@assets/carimbo_vestibulando_diretoria_responsavel.png";

export interface PdfStampOptions {
  y: number;
  x?: number;
  width?: number;
  height?: number;
  label?: string;
}

export async function addResponsibleStampToPdf(pdf: any, options: PdfStampOptions): Promise<{ width: number; height: number }> {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const width = options.width ?? 68;
  let height = options.height;

  const img = new Image();
  img.src = stampUrl;

  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  if (!height) {
    const naturalWidth = img.naturalWidth || img.width || 1;
    const naturalHeight = img.naturalHeight || img.height || 1;
    height = width * (naturalHeight / naturalWidth);
  }

  const x = options.x ?? (pageWidth - width) / 2;

  try {
    pdf.addImage(img, "PNG", x, options.y, width, height);
  } catch (error) {
    console.error("Erro ao aplicar carimbo no PDF:", error);
    const lineWidth = 70;
    const lineX = (pageWidth - lineWidth) / 2;
    pdf.line(lineX, options.y + 10, lineX + lineWidth, options.y + 10);
    pdf.text(options.label || "Diretoria Responsável", pageWidth / 2, options.y + 15, { align: "center" });
  }

  return { width, height };
}
