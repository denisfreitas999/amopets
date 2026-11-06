/**
 * Utilitários de formatação de datas para o fuso horário de Brasília
 * (America/Sao_Paulo). As funções usam Intl.DateTimeFormat com timeZone
 * explícito, garantindo resultado correto independentemente do TZ do processo.
 */

const TIMEZONE = "America/Sao_Paulo";

/**
 * Formata uma data com hora no padrão brasileiro: "DD/MM/AAAA HH:mm"
 * Exemplo: new Date("2026-10-15T02:30:00Z") → "14/10/2026 23:30"
 */
export function formatDateTimeBR(date: Date): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // Intl pode retornar "14/10/2026, 23:30" — normalizamos para "14/10/2026 23:30"
  return fmt.format(date).replace(",", "").replace(/\s+/, " ").trim();
}

/**
 * Formata apenas a data no padrão brasileiro: "DD/MM/AAAA"
 * Exemplo: new Date("2026-10-15T02:30:00Z") → "14/10/2026"
 */
export function formatDateBR(date: Date): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return fmt.format(date);
}

