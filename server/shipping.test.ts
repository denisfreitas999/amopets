import { describe, expect, it } from "vitest";
import { findShippingRule } from "../shared/shipping";

describe("shipping rules", () => {
  const rules = [
    { ruleType: "other_regions" as const, neighborhoods: "", city: null, mode: "quote" as const },
    { ruleType: "other_cities" as const, neighborhoods: "", city: "Aracaju", mode: "fixed" as const },
    { ruleType: "local_neighborhoods" as const, neighborhoods: "Jabotiana, Luzia", city: "Aracaju", mode: "fixed" as const },
  ];

  it("prefers Bairros locais and ignores accents/case", () => {
    expect(findShippingRule(rules, { neighborhood: "jabotiana", city: "ARACAJU" })?.ruleType).toBe("local_neighborhoods");
  });

  it("falls back to Outras cidades when the neighborhood does not match", () => {
    expect(findShippingRule(rules, { neighborhood: "Atalaia", city: "Aracaju" })?.ruleType).toBe("other_cities");
  });

  it("uses the city rule even when the neighborhood is missing", () => {
    expect(findShippingRule(rules, { city: "Aracaju" })?.ruleType).toBe("other_cities");
  });

  it("uses Outras regiões when no city rule matches", () => {
    expect(findShippingRule(rules, { neighborhood: "Centro", city: "Salvador" })?.ruleType).toBe("other_regions");
  });

  it("uses Outras regiões when the address has no city yet", () => {
    expect(findShippingRule(rules, {})?.ruleType).toBe("other_regions");
  });
});
