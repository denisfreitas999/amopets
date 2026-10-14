import crypto from "crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

export const GOOGLE_AUTH_STATE_COOKIE = "google_auth_state";
export const GOOGLE_AUTH_VERIFIER_COOKIE = "google_auth_verifier";
export const GOOGLE_AUTH_NONCE_COOKIE = "google_auth_nonce";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function clearAuthCookies(res: Response, req: Request) {
  const clearOpts = {
    path: "/api/auth/google",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: req.protocol === "https",
  };
  res.clearCookie(GOOGLE_AUTH_STATE_COOKIE, clearOpts);
  res.clearCookie(GOOGLE_AUTH_VERIFIER_COOKIE, clearOpts);
  res.clearCookie(GOOGLE_AUTH_NONCE_COOKIE, clearOpts);
}

function getOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: ENV.googleClientId,
    clientSecret: ENV.googleClientSecret,
    redirectUri: `${ENV.appUrl}/api/auth/google/callback`,
  });
}

export async function handleGoogleAuth(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");

  if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.appUrl) {
    console.warn("[GoogleAuth] Missing credentials or APP_URL (code: MISSING_CONFIG)");
    res.status(503).send("Login com Google não configurado.");
    return;
  }

  try {
    const client = getOAuthClient();
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = crypto.randomBytes(32).toString("hex");
    const nonce = crypto.randomBytes(16).toString("hex");

    const authUrl = client.generateAuthUrl({
      access_type: "online",
      response_type: "code",
      scope: ["openid", "email", "profile"],
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      state,
      nonce,
      redirect_uri: `${ENV.appUrl}/api/auth/google/callback`,
    });

    const cookieOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/api/auth/google",
      maxAge: 10 * 60 * 1000, // 10 minutos
      secure: req.protocol === "https",
    };

    res.cookie(GOOGLE_AUTH_STATE_COOKIE, state, cookieOpts);
    res.cookie(GOOGLE_AUTH_VERIFIER_COOKIE, codeVerifier, cookieOpts);
    res.cookie(GOOGLE_AUTH_NONCE_COOKIE, nonce, cookieOpts);

    res.redirect(302, authUrl);
  } catch {
    console.error("[GoogleAuth] Failed to initiate Google auth (code: INIT_ERROR)");
    res.status(500).send("Não foi possível iniciar o login com Google.");
  }
}

export async function handleGoogleAuthCallback(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");

  if (req.query.error) {
    console.warn("[GoogleAuth] Auth denied or errored from provider (code: PROVIDER_ERROR)");
    clearAuthCookies(res, req);
    res.redirect(302, "/");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;

  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const stateCookie = cookies[GOOGLE_AUTH_STATE_COOKIE];
  const verifierCookie = cookies[GOOGLE_AUTH_VERIFIER_COOKIE];
  const nonceCookie = cookies[GOOGLE_AUTH_NONCE_COOKIE];

  if (!code || !state || !stateCookie || !verifierCookie || !nonceCookie) {
    console.warn("[GoogleAuth] Missing parameters or cookies (code: MISSING_AUTH_PARAMS)");
    clearAuthCookies(res, req);
    res.status(400).send("Resposta de autenticação inválida.");
    return;
  }

  if (!safeEqual(state, stateCookie)) {
    console.warn("[GoogleAuth] State mismatch (code: STATE_MISMATCH)");
    clearAuthCookies(res, req);
    res.status(400).send("Resposta de autenticação inválida.");
    return;
  }

  const client = getOAuthClient();

  let tokens;
  try {
    const tokenResponse = await client.getToken({
      code,
      codeVerifier: verifierCookie,
    });
    tokens = tokenResponse.tokens;
  } catch {
    console.error("[GoogleAuth] Token exchange failed (code: TOKEN_EXCHANGE_ERROR)");
    clearAuthCookies(res, req);
    res.status(500).send("Não foi possível concluir o login com Google.");
    return;
  }

  if (!tokens || !tokens.id_token) {
    console.error("[GoogleAuth] Missing id_token in token response (code: MISSING_ID_TOKEN)");
    clearAuthCookies(res, req);
    res.status(500).send("Não foi possível concluir o login com Google.");
    return;
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: ENV.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    console.error("[GoogleAuth] ID token verification failed (code: ID_TOKEN_ERROR)");
    clearAuthCookies(res, req);
    res.status(400).send("Resposta de autenticação inválida.");
    return;
  }

  if (!payload || !payload.sub) {
    console.error("[GoogleAuth] Invalid ticket payload (code: INVALID_PAYLOAD)");
    clearAuthCookies(res, req);
    res.status(400).send("Resposta de autenticação inválida.");
    return;
  }

  if (!payload.nonce || !safeEqual(payload.nonce, nonceCookie)) {
    console.warn("[GoogleAuth] Nonce mismatch (code: NONCE_MISMATCH)");
    clearAuthCookies(res, req);
    res.status(400).send("Resposta de autenticação inválida.");
    return;
  }

  if (payload.email_verified !== true) {
    console.warn("[GoogleAuth] Email not verified (code: EMAIL_NOT_VERIFIED)");
    clearAuthCookies(res, req);
    res.status(403).send("A conta Google precisa ter e-mail verificado.");
    return;
  }

  const openId = `google:${payload.sub}`;
  const name = payload.name || payload.email || "Usuário";
  const email = payload.email || null;

  try {
    await db.upsertUser({
      openId,
      name,
      email,
      loginMethod: "google",
      role: "user",
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(openId, {
      name,
      expiresInMs: SESSION_DURATION_MS,
    });

    const sessionCookieOpts = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, sessionCookieOpts);

    clearAuthCookies(res, req);
    res.redirect(302, "/");
  } catch {
    console.error("[GoogleAuth] Failed to persist user or create session (code: USER_SESSION_ERROR)");
    clearAuthCookies(res, req);
    res.status(500).send("Não foi possível concluir o login com Google.");
  }
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google", handleGoogleAuth);
  app.get("/api/auth/google/callback", handleGoogleAuthCallback);
}

