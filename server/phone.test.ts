import { describe, expect, it } from "vitest";
import { formatWhatsapp, isValidWhatsapp, normalizeWhatsapp, whatsappInternational } from "../shared/phone";

describe("WhatsApp formatting", () => {
  it("normalizes Brazilian numbers to DDD plus subscriber digits", () => {
    expect(normalizeWhatsapp("(79) 99999-9999")).toBe("79999999999");
    expect(normalizeWhatsapp("+55 79 99999-9999")).toBe("79999999999");
    expect(normalizeWhatsapp("79 3333-4444")).toBe("7933334444");
  });

  it("formats progressively for friendly input", () => {
    expect(formatWhatsapp("79999999999")).toBe("(79) 99999-9999");
    expect(formatWhatsapp("7933334444")).toBe("(79) 3333-4444");
  });

  it("builds an international WhatsApp number with Brazil country code", () => {
    expect(whatsappInternational("79 9 88029702")).toBe("5579988029702");
    expect(whatsappInternational("+55 (79) 98802-9702")).toBe("5579988029702");
  });

  it("accepts only Brazilian phone lengths with DDD", () => {
    expect(isValidWhatsapp("(79) 99999-9999")).toBe(true);
    expect(isValidWhatsapp("(79) 3333-4444")).toBe(true);
    expect(isValidWhatsapp("9999-9999")).toBe(false);
    expect(isValidWhatsapp("(79) 9999-999")).toBe(false);
  });
});
