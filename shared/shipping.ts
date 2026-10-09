export type ShippingMode = "fixed" | "quote" | "unavailable";
export type ShippingRuleType = "local_neighborhoods" | "other_cities" | "other_regions";

export type ShippingRuleLike = {
  ruleType: ShippingRuleType;
  neighborhoods: string;
  city?: string | null;
  mode: ShippingMode;
};

export type ShippingAddress = {
  neighborhood?: string;
  city?: string;
};

export const shippingRuleLabels: Record<ShippingRuleType, string> = {
  local_neighborhoods: "Bairros locais",
  other_cities: "Outras cidades",
  other_regions: "Outras regiões",
};

export function normalizeShippingText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function listedNeighborhoods(value: string) {
  return normalizeShippingText(value).split(",").map((item) => item.trim()).filter(Boolean);
}

export function findShippingRule<T extends ShippingRuleLike>(rules: T[], address: ShippingAddress) {
  const neighborhood = normalizeShippingText(address.neighborhood);
  const city = normalizeShippingText(address.city);
  const order: Record<ShippingRuleType, number> = { local_neighborhoods: 0, other_cities: 1, other_regions: 2 };
  return [...rules].sort((a, b) => order[a.ruleType] - order[b.ruleType]).find((rule) => {
    if (rule.ruleType === "other_regions") return true;
    if (!city || normalizeShippingText(rule.city) !== city) return false;
    if (rule.ruleType === "other_cities") return true;
    return Boolean(neighborhood) && listedNeighborhoods(rule.neighborhoods).includes(neighborhood);
  });
}
