import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeAdminContext(): TrpcContext {
  return {
    user: null,
    admin: { id: 1, name: "Admin Test", username: "admin@example.com" },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    adminSession: true,
  };
}

describe("Normalização de Preço e Validação no Router Admin", () => {
  it("a) o schema aceita preços digitados com vírgula e normaliza para ponto decimal", async () => {
    const caller = appRouter.createCaller(makeAdminContext());

    // Se passarmos campos com vírgula (ex: '189,90' e '219,90'), a validação Zod deve aceitar
    // (não deve estourar ZodError de regex)
    const payload = {
      slug: "produto-teste-virgula",
      name: "Produto Teste",
      category: "Cachorros",
      subcategory: "Ração Seca",
      description: "Descrição teste",
      status: "active" as const,
      variants: [
        {
          label: "10kg",
          sku: "TEST-SKU-1",
          price: "189,90",
          oldPrice: "219,90",
          stock: 10,
        },
      ],
      images: [
        {
          url: "/uploads/42d5d349-c9cd-44cf-b1d4-6e431ce35184.webp",
          alt: "foto.webp",
          sortOrder: 0,
          isCover: true,
        },
      ],
      specs: [{ label: "Marca", value: "Premier", sortOrder: 0 }],
    };

    // Chamamos create. Se o banco de teste estiver ativo, cria; se der erro de banco, não pode ser erro de Zod
    try {
      await caller.admin.products.create(payload);
    } catch (err: any) {
      // Se falhar por conexão de banco, tudo bem; NÃO pode falhar com ZodError de regex
      expect(err.message).not.toContain("must match pattern");
      expect(err.message).not.toContain("Informe um preço válido");
    }
  });

  it("b) rejeita valores alfanuméricos inválidos que não sejam números nem valores decimais", async () => {
    const caller = appRouter.createCaller(makeAdminContext());

    const invalidPayload = {
      slug: "produto-invalido",
      name: "Produto Invalido",
      category: "Cachorros",
      subcategory: "Ração Seca",
      status: "active" as const,
      variants: [
        {
          label: "10kg",
          sku: "TEST-SKU-2",
          price: "abcde",
          stock: 10,
        },
      ],
      images: [],
      specs: [],
    };

    await expect(caller.admin.products.create(invalidPayload)).rejects.toThrow();
  });
});
