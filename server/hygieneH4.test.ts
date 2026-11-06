import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");

describe("Passo H4b - Testes de Higiene do Repositório (Limpeza Manus e Analytics)", () => {
  it("a) client/index.html não contém 'umami' nem '%VITE_' e o único <script> é /src/main.tsx", () => {
    const htmlPath = path.join(rootDir, "client", "index.html");
    const content = fs.readFileSync(htmlPath, "utf-8");

    expect(content.toLowerCase()).not.toContain("umami");
    expect(content).not.toContain("%VITE_");

    const scriptTags = Array.from(content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[0]);
    expect(scriptTags).toHaveLength(1);
    expect(scriptTags[0]).toMatch(/src=["']\/src\/main\.tsx["']/);
  });

  it("b) vite.config.ts não referencia manus, jsx-loc nem debug-collector", () => {
    const configPath = path.join(rootDir, "vite.config.ts");
    const content = fs.readFileSync(configPath, "utf-8");

    expect(content).not.toMatch(/manus/i);
    expect(content).not.toMatch(/jsx-loc/i);
    expect(content).not.toMatch(/debug-collector/i);
  });

  it("c) package.json não lista: vite-plugin-manus-runtime, @builder.io/vite-plugin-jsx-loc, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, axios, @types/google.maps, add", () => {
    const pkgPath = path.join(rootDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    const forbidden = [
      "vite-plugin-manus-runtime",
      "@builder.io/vite-plugin-jsx-loc",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
      "axios",
      "@types/google.maps",
      "add",
    ];

    for (const dep of forbidden) {
      expect(allDeps, `package.json não deve listar ${dep}`).not.toHaveProperty(dep);
    }
  });

  it("d) Nenhum arquivo em server/ e client/src contém 'forge.manus', 'manus-storage' ou 'manus.im'", () => {
    const getFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFiles(fullPath));
        } else if (
          entry.isFile() &&
          !entry.name.endsWith(".test.ts") &&
          !entry.name.endsWith(".spec.ts")
        ) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const targetDirs = [path.join(rootDir, "server"), path.join(rootDir, "client", "src")];
    const allFiles = targetDirs.flatMap(getFiles);

    const forbiddenPhrases = ["forge.manus", "manus-storage", "manus.im"];
    const violations: { file: string; phrase: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const phrase of forbiddenPhrases) {
        if (content.includes(phrase)) {
          violations.push({ file: path.relative(rootDir, file), phrase });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("e) Nenhum import.meta.env.VITE_* lido em client/src tem KEY, SECRET ou TOKEN no nome", () => {
    const getFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFiles(fullPath));
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const clientSrc = path.join(rootDir, "client", "src");
    const files = getFiles(clientSrc);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g);
      for (const match of matches) {
        const varName = match[1];
        if (/(KEY|SECRET|TOKEN)/i.test(varName)) {
          violations.push(`${path.relative(rootDir, file)}: ${varName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("f) .gitignore contém '.manus-logs' e a pasta .manus-logs não existe", () => {
    const gitignorePath = path.join(rootDir, ".gitignore");
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
    expect(gitignoreContent).toMatch(/\.manus-logs/);

    const manusLogsDir = path.join(rootDir, ".manus-logs");
    expect(fs.existsSync(manusLogsDir)).toBe(false);
  });

  it("g) Nenhum className em client/src contém o caractere '/' dentro de um nome de classe", () => {
    const getFiles = (dir: string): string[] => {
      if (!fs.existsSync(dir)) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFiles(fullPath));
        } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const clientSrc = path.join(rootDir, "client", "src");
    const files = getFiles(clientSrc);
    const violations: string[] = [];

    // Tailwind standard utilities allow slashes for fractions (w-1/2) and opacity (bg-black/50)
    const isTailwindSlash = (cls: string) =>
      /\/\d+(:[a-z-]+)?$/.test(cls) || // opacity e.g. bg-white/80, ring-ring/50
      /\d+\/\d+$/.test(cls) || // fractions e.g. top-1/2, w-3/4
      cls.includes("/drawer-content"); // Tailwind named group container

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const matches = content.matchAll(/className=["']([^"']+)["']/g);
      for (const match of matches) {
        const classNames = match[1].split(/\s+/);
        for (const cls of classNames) {
          if (cls.includes("/") && !isTailwindSlash(cls)) {
            violations.push(`${path.relative(rootDir, file)}: ${cls}`);
          }
        }
      }
      const statusMatches = content.matchAll(/["'](status-[^"']+)["']/g);
      for (const m of statusMatches) {
        if (m[1].includes("/")) {
          violations.push(`${path.relative(rootDir, file)}: ${m[1]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
