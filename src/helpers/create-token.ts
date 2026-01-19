import * as jose from "jose";

const privatePEM = process.env.PRIVATE_KEY;

// Manual token expiration
const ACCESS_TOKEN_EXPIRATION = "15m";
const REFRESH_TOKEN_EXPIRATION = "30d";

// Type of payload, para maangas
type payload = {
  email: String;
  role: String;
};

const createToken = async (user: payload) => {
  if (!privatePEM) throw new Error("Private key required");

  // Importing the private key (PKCS8 format) for RS256 signing
  const privateKey = await jose.importPKCS8(privatePEM, "RS256");

  // Access token (short exp date)
  const accessToken = await new jose.SignJWT(user)
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
    .sign(privateKey);

  const refreshToken = await new jose.SignJWT(user)
    .setProtectedHeader({ alg: "RS256" })
    .setExpirationTime(REFRESH_TOKEN_EXPIRATION)
    .sign(privateKey);

  return { accessToken, refreshToken };
};

export default createToken;
