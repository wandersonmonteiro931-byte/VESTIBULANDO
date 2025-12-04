import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNota(nota: number | null | undefined): string {
  if (nota === null || nota === undefined) return "-";
  return nota.toFixed(1).replace(".", ",");
}

export function parseNota(value: string): number | null {
  if (!value || value.trim() === "") return null;
  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0 || parsed > 10) return null;
  return parsed;
}

export function getTipoAlunoGenero(sexo?: string): string {
  if (!sexo) return "Aluno(a)";
  
  switch (sexo.toLowerCase()) {
    case "masculino":
      return "Aluno";
    case "feminino":
      return "Aluna";
    case "nao-binario":
    case "não-binario":
      return "Aluno(a)";
    case "prefiro-nao-informar":
      return "Aluno(a)";
    default:
      return "Aluno(a)";
  }
}
