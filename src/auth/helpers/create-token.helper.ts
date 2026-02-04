import * as jose from "jose";
import type { AuthPayload } from "../types/auth-payload.type.ts";

const privatePEM = process.env.PRIVATE_KEY;

// Manual token expiration
const ACCESS_TOKEN_EXPIRATION = "8h";
const REFRESH_TOKEN_EXPIRATION = "30d";

export const createAccessToken = async (user: AuthPayload) => {
  if (!privatePEM) throw new Error("Private key required");

  // Importing the private key (PKCS8 format) for RS256 signing
  const privateKey = await jose.importPKCS8(privatePEM, "RS256");

  // Access token (short exp date)
  const accessToken = await new jose.SignJWT(user)
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
    .sign(privateKey);

  return accessToken;
};

export const createRefreshToken = async (user: AuthPayload) => {
  if (!privatePEM) throw new Error("Private key required");

  // Importing the private key (PKCS8 format) for RS256 signing
  const privateKey = await jose.importPKCS8(privatePEM, "RS256");

  const refreshToken = await new jose.SignJWT(user)
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(REFRESH_TOKEN_EXPIRATION)
    .sign(privateKey);

  return refreshToken;
};
