import { describe, expect, it } from "vitest";
import {
  getFirstName,
  formatOrderDate,
  formatBookingDate,
  translateOrderStatus,
  translateBookingStatus,
} from "../shared/accountFormatters";

describe("accountFormatters - Funções puras de formatação e tradução de status (Passo F)", () => {
  it("getFirstName: extrai o primeiro nome de um nome completo", () => {
    expect(getFirstName("Ana Maria Silva")).toBe("Ana");
    expect(getFirstName("Carlos")).toBe("Carlos");
    expect(getFirstName(" João ")).toBe("João");
    expect(getFirstName("")).toBe("");
    expect(getFirstName(null)).toBe("");
    expect(getFirstName(undefined)).toBe("");
  });

  it("formatOrderDate: formata Date ou string ISO como dd/mm/aaaa", () => {
    // 2026-10-25T14:30:00Z -> 25/10/2026
    const date = new Date("2026-10-25T14:30:00Z");
    expect(formatOrderDate(date)).toMatch(/^25\/10\/2026$/);
    expect(formatOrderDate("2026-10-25T14:30:00Z")).toMatch(/^25\/10\/2026$/);
  });

  it("formatBookingDate: formata string AAAA-MM-DD para dd/mm/aaaa", () => {
    expect(formatBookingDate("2026-10-25")).toBe("25/10/2026");
    expect(formatBookingDate("2026-05-09")).toBe("09/05/2026");
  });

  it("translateOrderStatus: traduz corretamente os status de pedido", () => {
    expect(translateOrderStatus("received")).toBe("Recebido");
    expect(translateOrderStatus("preparing")).toBe("Em preparo");
    expect(translateOrderStatus("out_for_delivery")).toBe("Saiu para entrega");
    expect(translateOrderStatus("delivered")).toBe("Entregue");
    expect(translateOrderStatus("cancelled")).toBe("Cancelado");
    expect(translateOrderStatus("unknown_status")).toBe("unknown_status");
  });

  it("translateBookingStatus: traduz corretamente os status de agendamento", () => {
    expect(translateBookingStatus("requested")).toBe("Solicitado");
    expect(translateBookingStatus("confirmed")).toBe("Confirmado");
    expect(translateBookingStatus("refused")).toBe("Recusado");
    expect(translateBookingStatus("completed")).toBe("Concluído");
    expect(translateBookingStatus("unknown_status")).toBe("unknown_status");
  });
});

