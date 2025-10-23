// Extensões de arquivos perigosas/maliciosas
const DANGEROUS_EXTENSIONS = [
  // Executáveis
  ".exe", ".com", ".bat", ".cmd", ".msi", ".scr", ".pif",
  // Scripts
  ".js", ".vbs", ".vb", ".ps1", ".sh", ".bash",
  // Outros perigosos
  ".dll", ".sys", ".drv", ".jar", ".app", ".deb", ".rpm",
  // Compactados que podem conter executáveis (serão verificados pelo MIME type também)
  ".rar", ".7z", ".tar", ".gz", ".bz2",
];

// MIME types perigosos
const DANGEROUS_MIME_TYPES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
  "application/x-bat",
  "application/x-jar",
  "text/javascript",
];

// Extensões permitidas (whitelist)
const ALLOWED_EXTENSIONS = [
  // Documentos
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".odt", ".ods", ".odp",
  // Imagens
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp",
  // Vídeos
  ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mkv",
  // Áudio
  ".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac",
  // Compactados seguros
  ".zip",
];

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  isDangerous?: boolean;
}

export function validateFile(file: File, maxSize: number = 20 * 1024 * 1024): FileValidationResult {
  // Verificar tamanho
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1);
    return {
      isValid: false,
      error: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`,
    };
  }

  // Verificar tamanho mínimo (para evitar arquivos vazios ou corrompidos)
  if (file.size === 0) {
    return {
      isValid: false,
      error: "Arquivo vazio ou corrompido",
    };
  }

  // Obter extensão do arquivo
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.'));

  // Verificar se tem extensão
  if (!extension || extension === fileName) {
    return {
      isValid: false,
      error: "Arquivo sem extensão válida",
    };
  }

  // Verificar extensões perigosas
  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    return {
      isValid: false,
      error: "Tipo de arquivo não permitido por questões de segurança",
      isDangerous: true,
    };
  }

  // Verificar se está na whitelist
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      isValid: false,
      error: `Extensão .${extension.substring(1)} não é permitida`,
    };
  }

  // Verificar MIME type perigoso
  if (DANGEROUS_MIME_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: "Tipo de arquivo não permitido por questões de segurança",
      isDangerous: true,
    };
  }

  // Verificar nomes suspeitos
  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return {
      isValid: false,
      error: "Nome de arquivo inválido",
      isDangerous: true,
    };
  }

  // Validação específica por tipo
  const mimeType = file.type.toLowerCase();

  // Imagens
  if (extension.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
    if (!mimeType.startsWith("image/")) {
      return {
        isValid: false,
        error: "Arquivo de imagem inválido ou corrompido",
      };
    }
  }

  // Vídeos
  if (extension.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/)) {
    if (!mimeType.startsWith("video/")) {
      return {
        isValid: false,
        error: "Arquivo de vídeo inválido ou corrompido",
      };
    }
  }

  // Áudio
  if (extension.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/)) {
    if (!mimeType.startsWith("audio/")) {
      return {
        isValid: false,
        error: "Arquivo de áudio inválido ou corrompido",
      };
    }
  }

  return { isValid: true };
}

export function getFileTypeCategory(fileName: string): "imagem" | "video" | "audio" | "documento" {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  
  if (extension.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/)) return "imagem";
  if (extension.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)$/)) return "video";
  if (extension.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/)) return "audio";
  return "documento";
}
