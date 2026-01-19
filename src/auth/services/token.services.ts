import * as jose from "jose";

const ACCESS_TOKEN_EXPIRATION = "15m";
const REFRESH_TOKEN_EXPIRATION = "30d";

const privatePEM = process.env.PRIVATE_KEY;

export const createAccessToken = async (payload: object) => {
  if (!privatePEM) throw new Error("Private PEM key is required");

  const privateKey = await jose.importPKCS8(privatePEM, "RS256");
  await new jose.SignJWT({ payload })
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
    .sign(privateKey);
};

export const createRefreshToken = async (payload: object) => {
  if (!privatePEM) throw new Error("Private PEM key is required");

  const privateKey = await jose.importPKCS8(privatePEM, "RS256");
  await new jose.SignJWT({ payload })
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(REFRESH_TOKEN_EXPIRATION)
    .sign(privateKey);
};

export const createIdToken = async (payload: object) => {
  if (!privatePEM) throw new Error("Private PEM key is required");

  const privateKey = await jose.importPKCS8(privatePEM, "RS256");
  await new jose.SignJWT({ payload })
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
    .sign(privateKey);
};
