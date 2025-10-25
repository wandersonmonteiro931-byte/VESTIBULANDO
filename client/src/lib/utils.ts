import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
