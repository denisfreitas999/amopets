import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

describe("Passo I1 - Política de Privacidade e Checklist LGPD", () => {
  const appTsxPath = path.join(rootDir, "client", "src", "App.tsx");
  const appTsxContent = fs.readFileSync(appTsxPath, "utf-8");

  it("a) o checkbox do checkout mantém o link para /politica-de-privacidade", () => {
    expect(appTsxContent).toMatch(
      /<Link\s+href=["']\/politica-de-privacidade["']>\s*Política de Privacidade\s*<\/Link>/i
    );
  });

  it("b) o componente StaticPage registra a rota /politica-de-privacidade com as 9 seções obrigatórias", () => {
    const requiredSections = [
      "Dados coletados",
      "Finalidades e base legal",
      "Com quem compartilhamos",
      "Cookies e armazenamento",
      "Por quanto tempo guardamos",
      "Seus direitos",
      "Segurança",
      "Controlador",
      "Data de atualização e mudanças",
    ];

    for (const section of requiredSections) {
      expect(
        appTsxContent,
        `Seção obrigatória "${section}" deve estar presente na Política de Privacidade`
      ).toContain(`"${section}"`);
    }
  });

  it("c) o texto não contém termos vagos ou condicionais como 'poderiam' ou 'pode ser'", () => {
    // Isola o trecho da política de privacidade
    const match = appTsxContent.match(/"\/politica-de-privacidade":\s*\{[\s\S]*?\n\s*\},/);
    expect(match).not.toBeNull();
    const privacyBlock = match![0];

    expect(privacyBlock).not.toMatch(/\bpoderiam\b/i);
    expect(privacyBlock).not.toMatch(/\bpode ser\b/i);
  });

  it("d) a política menciona as bases legais expressas, direitos da LGPD e os canais de atendimento", () => {
    const match = appTsxContent.match(/"\/politica-de-privacidade":\s*\{[\s\S]*?\n\s*\},/);
    expect(match).not.toBeNull();
    const privacyBlock = match![0];

    // Bases legais
    expect(privacyBlock).toContain("execução de contrato");
    expect(privacyBlock).toContain("consentimento");
    expect(privacyBlock).toContain("legítimo interesse");

    // Provedores
    expect(privacyBlock).toContain("Hostinger");
    expect(privacyBlock).toContain("WhatsApp");
    expect(privacyBlock).toContain("Google");
    expect(privacyBlock).toContain("ViaCEP");

    // Canais e direitos
    expect(privacyBlock).toContain("privacidade@amopets.com.br");
    expect(privacyBlock).toContain("(79) 99662-0430");
    expect(privacyBlock).toContain("15 dias");
    expect(privacyBlock).toContain("5 anos");
  });
});

