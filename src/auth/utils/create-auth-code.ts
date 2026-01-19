import crypto from "crypto";
import { redis } from "../../config/redis.client.ts";

interface CreateAuthCodeParams {
  userId: string;
  clientId: string;
  codeChallenge?: string;
  expiresInMs?: number;
}

export const createAuthorizationCode = async ({
  userId,
  clientId,
  codeChallenge,
  expiresInMs = 5 * 60 * 1000,
}: CreateAuthCodeParams) => {
  const code = crypto.randomBytes(32).toString("hex");

  const value = JSON.stringify({ userId, clientId, codeChallenge });
  redis.setEx(code, expiresInMs, value);

  return code;
};
