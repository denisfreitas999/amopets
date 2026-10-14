import { describe, expect, it } from "vitest";
import {
  getFirstName,
  formatOrderDate,
  formatBookingDate,
  translateOrderStatus,
  translateBookingStatus,
  getOrderProgress,
  getBookingProgress,
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

  describe("getOrderProgress - Barra de progresso de pedidos (Passo P)", () => {
    it("a) received -> 0, preparing -> 1, out_for_delivery -> 2, delivered -> 3", () => {
      expect(getOrderProgress("received")).toEqual({
        steps: ["Recebido", "Em preparo", "Saiu para entrega", "Entregue"],
        currentIndex: 0,
        terminal: null,
      });
      expect(getOrderProgress("preparing")).toEqual({
        steps: ["Recebido", "Em preparo", "Saiu para entrega", "Entregue"],
        currentIndex: 1,
        terminal: null,
      });
      expect(getOrderProgress("out_for_delivery")).toEqual({
        steps: ["Recebido", "Em preparo", "Saiu para entrega", "Entregue"],
        currentIndex: 2,
        terminal: null,
      });
      expect(getOrderProgress("delivered")).toEqual({
        steps: ["Recebido", "Em preparo", "Saiu para entrega", "Entregue"],
        currentIndex: 3,
        terminal: null,
      });
    });

    it("b) cancelled -> terminal 'cancelled' e nenhuma etapa marcada como concluída (currentIndex: -1)", () => {
      const res = getOrderProgress("cancelled");
      expect(res).toEqual({
        steps: ["Recebido", "Em preparo", "Saiu para entrega", "Entregue"],
        currentIndex: -1,
        terminal: "cancelled",
      });
      expect(res.currentIndex).toBeLessThan(0);
    });

    it("c) status desconhecido -> sem barra (terminal 'unknown')", () => {
      expect(getOrderProgress("desconhecido")).toEqual({
        steps: ["Recebido", "Em preparo", "Saiu para entrega", "Entregue"],
        currentIndex: -1,
        terminal: "unknown",
      });
      expect(getOrderProgress("")).toEqual({
        steps: ["Recebido", "Em preparo", "Saiu para entrega", "Entregue"],
        currentIndex: -1,
        terminal: "unknown",
      });
    });
  });

  describe("getBookingProgress - Barra de progresso de agendamentos (Passo P)", () => {
    it("d) requested -> 0, confirmed -> 1, completed -> 2", () => {
      expect(getBookingProgress("requested")).toEqual({
        steps: ["Solicitado", "Confirmado", "Concluído"],
        currentIndex: 0,
        terminal: null,
      });
      expect(getBookingProgress("confirmed")).toEqual({
        steps: ["Solicitado", "Confirmado", "Concluído"],
        currentIndex: 1,
        terminal: null,
      });
      expect(getBookingProgress("completed")).toEqual({
        steps: ["Solicitado", "Confirmado", "Concluído"],
        currentIndex: 2,
        terminal: null,
      });
    });

    it("e) refused -> terminal 'refused' e nenhuma etapa concluída (currentIndex: -1)", () => {
      const res = getBookingProgress("refused");
      expect(res).toEqual({
        steps: ["Solicitado", "Confirmado", "Concluído"],
        currentIndex: -1,
        terminal: "refused",
      });
      expect(res.currentIndex).toBeLessThan(0);
    });

    it("f) status desconhecido -> sem barra (terminal 'unknown')", () => {
      expect(getBookingProgress("outro")).toEqual({
        steps: ["Solicitado", "Confirmado", "Concluído"],
        currentIndex: -1,
        terminal: "unknown",
      });
      expect(getBookingProgress("")).toEqual({
        steps: ["Solicitado", "Confirmado", "Concluído"],
        currentIndex: -1,
        terminal: "unknown",
      });
    });
  });
});

