import { describe, expect, it } from "vitest";
import { bookingStatusLabel } from "./bookingPdf";

describe("booking PDF labels", () => {
  it("uses human-readable labels for every booking status", () => {
    expect(bookingStatusLabel("requested")).toBe("Solicitado");
    expect(bookingStatusLabel("confirmed")).toBe("Confirmado");
    expect(bookingStatusLabel("refused")).toBe("Recusado");
    expect(bookingStatusLabel("completed")).toBe("Concluído");
  });
});
