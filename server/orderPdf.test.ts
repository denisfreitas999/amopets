import { describe, expect, it } from "vitest";
import { statusLabel } from "./orderPdf";

describe("order PDF labels", () => {
  it("uses human-readable labels for every order status", () => {
    expect(statusLabel("received")).toBe("Recebido");
    expect(statusLabel("preparing")).toBe("Em preparo");
    expect(statusLabel("out_for_delivery")).toBe("Saiu para entrega");
    expect(statusLabel("delivered")).toBe("Entregue");
    expect(statusLabel("cancelled")).toBe("Cancelado");
  });
});
