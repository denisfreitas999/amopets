export const ORDER_STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  preparing: "Em preparo",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  requested: "Solicitado",
  confirmed: "Confirmado",
  refused: "Recusado",
  completed: "Concluído",
};

export function getFirstName(fullName?: string | null): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] || "";
}

export function formatOrderDate(date: Date | string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatBookingDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.trim().split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
  return dateStr;
}

export function translateOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function translateBookingStatus(status: string): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}

export const ORDER_PROGRESS_STEPS = [
  "Recebido",
  "Em preparo",
  "Saiu para entrega",
  "Entregue",
] as const;

export const BOOKING_PROGRESS_STEPS = [
  "Solicitado",
  "Confirmado",
  "Concluído",
] as const;

export type ProgressTerminal = "cancelled" | "refused" | "unknown" | null;

export interface ProgressResult {
  steps: readonly string[];
  currentIndex: number;
  terminal: ProgressTerminal;
}

export function getOrderProgress(status: string): ProgressResult {
  switch (status) {
    case "received":
      return { steps: ORDER_PROGRESS_STEPS, currentIndex: 0, terminal: null };
    case "preparing":
      return { steps: ORDER_PROGRESS_STEPS, currentIndex: 1, terminal: null };
    case "out_for_delivery":
      return { steps: ORDER_PROGRESS_STEPS, currentIndex: 2, terminal: null };
    case "delivered":
      return { steps: ORDER_PROGRESS_STEPS, currentIndex: 3, terminal: null };
    case "cancelled":
      return { steps: ORDER_PROGRESS_STEPS, currentIndex: -1, terminal: "cancelled" };
    default:
      return { steps: ORDER_PROGRESS_STEPS, currentIndex: -1, terminal: "unknown" };
  }
}

export function getBookingProgress(status: string): ProgressResult {
  switch (status) {
    case "requested":
      return { steps: BOOKING_PROGRESS_STEPS, currentIndex: 0, terminal: null };
    case "confirmed":
      return { steps: BOOKING_PROGRESS_STEPS, currentIndex: 1, terminal: null };
    case "completed":
      return { steps: BOOKING_PROGRESS_STEPS, currentIndex: 2, terminal: null };
    case "refused":
      return { steps: BOOKING_PROGRESS_STEPS, currentIndex: -1, terminal: "refused" };
    default:
      return { steps: BOOKING_PROGRESS_STEPS, currentIndex: -1, terminal: "unknown" };
  }
}

