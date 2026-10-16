export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  appUrl: (process.env.APP_URL ?? "").replace(/\/+$/, ""),
};

export function assertSessionSecret(env: Record<string, string | undefined>): boolean {
  const nodeEnv = env.NODE_ENV || "development";
  const secret = env.JWT_SECRET || "";

  if (nodeEnv === "production") {
    if (!secret || secret.length < 32) {
      throw new Error(
        "JWT_SECRET é obrigatório e deve ter no mínimo 32 caracteres em ambiente de produção."
      );
    }
    return true;
  }

  if (!secret || secret.length < 32) {
    console.warn(
      "[Security] JWT_SECRET ausente ou menor que 32 caracteres em ambiente de desenvolvimento."
    );
    return false;
  }

  return true;
}

