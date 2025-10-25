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
 * @param localTimeString - String no formato "HH:mm" ou "HH:mm:ss"
 * @returns ISO string em UTC
 */
export function brasiliaToUTC(localDateString: string, localTimeString: string): string {
  // Criar data assumindo que é horário de Brasília
  const [year, month, day] = localDateString.split('-').map(Number);
  const timeParts = localTimeString.split(':').map(Number);
  const hours = timeParts[0];
  const minutes = timeParts[1];
  const seconds = timeParts[2] || 0;
  
  // Brasília é UTC-3, então adicionar 3 horas para converter para UTC
  // Usar Date.UTC para criar timestamp independente do timezone local
  const utcTimestamp = Date.UTC(year, month - 1, day, hours, minutes, seconds) + (3 * 60 * 60 * 1000);
  
  return new Date(utcTimestamp).toISOString();
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
  
  // Usar Intl para obter o horário de Brasília independente do timezone do usuário
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const dateParts = dateFormatter.formatToParts(now);
  const timeParts = timeFormatter.formatToParts(now);
  
  const day = dateParts.find(p => p.type === 'day')?.value || '01';
  const month = dateParts.find(p => p.type === 'month')?.value || '01';
  const year = dateParts.find(p => p.type === 'year')?.value || '2025';
  
  const hour = timeParts.find(p => p.type === 'hour')?.value || '00';
  const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
  
  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${hour}:${minute}`
  };
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

/**
 * Obtém o timestamp atual em horário de Brasília e retorna como ISO string em UTC
 * Esta função garante que o timestamp represente o momento atual em Brasília,
 * convertido para UTC para armazenamento consistente no banco de dados.
 * 
 * @returns ISO string em UTC representando o momento atual em Brasília
 */
export function getNowBrasiliaISO(): string {
  const now = new Date();
  
  // Usar Intl para obter o horário de Brasília independente do timezone do usuário
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const dateParts = dateFormatter.formatToParts(now);
  const timeParts = timeFormatter.formatToParts(now);
  
  const day = dateParts.find(p => p.type === 'day')?.value || '01';
  const month = dateParts.find(p => p.type === 'month')?.value || '01';
  const year = dateParts.find(p => p.type === 'year')?.value || '2025';
  
  const hour = timeParts.find(p => p.type === 'hour')?.value || '00';
  const minute = timeParts.find(p => p.type === 'minute')?.value || '00';
  const second = timeParts.find(p => p.type === 'second')?.value || '00';
  
  // Converter horário de Brasília para UTC ISO string
  return brasiliaToUTC(`${year}-${month}-${day}`, `${hour}:${minute}:${second}`);
}

/**
 * Formata uma ISO string para exibir apenas o horário no formato XX:XX (horário de Brasília)
 * 
 * @param isoString - ISO string em UTC
 * @returns String formatada "HH:mm" em horário de Brasília
 */
export function formatBrasiliaTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    return "";
  }
}

/**
 * Formata uma ISO string para exibir data e hora de forma amigável
 * Retorna "Hoje", "Ontem" ou a data completa
 * 
 * @param isoString - ISO string em UTC
 * @returns String formatada como "Hoje", "Ontem" ou "dd/MM/yyyy"
 */
export function formatBrasiliaDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    
    // Obter data no timezone de Brasília
    const brasiliaFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const dateParts = brasiliaFormatter.formatToParts(date);
    const day = dateParts.find(p => p.type === 'day')?.value || '01';
    const month = dateParts.find(p => p.type === 'month')?.value || '01';
    const year = dateParts.find(p => p.type === 'year')?.value || '2025';
    
    // Obter data atual de Brasília
    const nowParts = brasiliaFormatter.formatToParts(new Date());
    const nowDay = nowParts.find(p => p.type === 'day')?.value || '01';
    const nowMonth = nowParts.find(p => p.type === 'month')?.value || '01';
    const nowYear = nowParts.find(p => p.type === 'year')?.value || '2025';
    
    // Verificar se é hoje
    if (day === nowDay && month === nowMonth && year === nowYear) {
      return "Hoje";
    }
    
    // Verificar se é ontem
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayParts = brasiliaFormatter.formatToParts(yesterday);
    const yesterdayDay = yesterdayParts.find(p => p.type === 'day')?.value || '01';
    const yesterdayMonth = yesterdayParts.find(p => p.type === 'month')?.value || '01';
    const yesterdayYear = yesterdayParts.find(p => p.type === 'year')?.value || '2025';
    
    if (day === yesterdayDay && month === yesterdayMonth && year === yesterdayYear) {
      return "Ontem";
    }
    
    // Retornar data formatada
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}
