/**
 * Utilitários para trabalhar com horário de Brasília (UTC-3)
 * 
 * IMPORTANTE: Todas as datas no sistema devem ser armazenadas em UTC no Firestore,
 * mas tratadas como horário de Brasília na interface do usuário.
 */

/**
 * Converte uma data local do usuário (assumida como Brasília) para UTC ISO string
 * para armazenamento no banco de dados.
 * 
 * @param localDateString - String no formato "YYYY-MM-DD"
 * @param localTimeString - String no formato "HH:mm"
 * @returns ISO string em UTC
 */
export function brasiliaToUTC(localDateString: string, localTimeString: string): string {
  // Criar data assumindo que é horário de Brasília
  const [year, month, day] = localDateString.split('-').map(Number);
  const [hours, minutes] = localTimeString.split(':').map(Number);
  
  // Criar data em Brasília (sem timezone)
  const brasiliaDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  
  // Adicionar 3 horas para converter de Brasília (UTC-3) para UTC
  const utcDate = new Date(brasiliaDate.getTime() + (3 * 60 * 60 * 1000));
  
  return utcDate.toISOString();
}

/**
 * Converte uma ISO string UTC do banco de dados para data/hora local de Brasília
 * para exibição em inputs datetime-local.
 * 
 * @param isoString - ISO string em UTC
 * @returns Objeto com dateString e timeString em horário de Brasília
 */
export function utcToBrasilia(isoString: string): { dateString: string; timeString: string } {
  const utcDate = new Date(isoString);
  
  // Subtrair 3 horas para converter de UTC para Brasília (UTC-3)
  const brasiliaDate = new Date(utcDate.getTime() - (3 * 60 * 60 * 1000));
  
  const year = brasiliaDate.getUTCFullYear();
  const month = String(brasiliaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brasiliaDate.getUTCDate()).padStart(2, '0');
  const hours = String(brasiliaDate.getUTCHours()).padStart(2, '0');
  const minutes = String(brasiliaDate.getUTCMinutes()).padStart(2, '0');
  
  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${hours}:${minutes}`
  };
}

/**
 * Obtém a data/hora atual em horário de Brasília formatada para inputs
 * 
 * @returns Objeto com dateString e timeString em horário de Brasília
 */
export function getNowBrasilia(): { dateString: string; timeString: string } {
  const now = new Date();
  return utcToBrasilia(now.toISOString());
}

/**
 * Converte timestamp para horário de Brasília (para registro de logs)
 * 
 * @param date - Date object (padrão: agora)
 * @returns ISO string ajustado para Brasília
 */
export function toBrasiliaTime(date: Date = new Date()): string {
  // Subtrair 3 horas para Brasília (UTC-3)
  const brasiliaDate = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  return brasiliaDate.toISOString();
}

/**
 * Formata uma ISO string para exibição em português (horário de Brasília)
 * 
 * @param isoString - ISO string em UTC
 * @returns String formatada "dd/MM/yyyy às HH:mm"
 */
export function formatBrasiliaDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return "Data inválida";
  }
}
