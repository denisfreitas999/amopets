import type { CookieOptions, Request } from "express";
import { SESSION_DURATION_MS } from "@shared/const";

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  const isHttps = req.protocol === "https";

  const rawSameSite = process.env.COOKIE_SAMESITE?.trim().toLowerCase();
  let sameSite: "lax" | "strict" | "none" = "lax";

  if (rawSameSite === "none") {
    sameSite = "none";
  } else if (rawSameSite === "strict") {
    sameSite = "strict";
  } else {
    sameSite = "lax";
  }

  // SameSite=None requer Secure=true por especificação dos navegadores
  const secure = sameSite === "none" ? true : isHttps;

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
    maxAge: SESSION_DURATION_MS,
  };
}
