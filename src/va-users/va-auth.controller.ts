// src/va-users/va-auth.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as jose from 'jose';
import VAUser from './VAUser.model.ts';

const isProduction = process.env.NODE_ENV === 'production';
const ACCESS_TOKEN_MS  = 8  * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function createToken(payload: object, expiresIn: string): Promise<string> {
  const privatePEM = process.env.PRIVATE_KEY;
  if (!privatePEM) throw new Error('PRIVATE_KEY not set');
  const privateKey = await jose.importPKCS8(privatePEM, 'RS256');
  return new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

const cookieOpts = {
  httpOnly: true,
  secure:   isProduction,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  path:     '/',
};

// POST /auth/va/authenticate
export const authenticateVA = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  try {
    if (!email)    throw new Error('Email is required.');
    if (!password) throw new Error('Password is required.');

    const vaUser = await VAUser.findOne({ email });
    if (!vaUser) { res.status(400).json({ error: 'Invalid email or password.' }); return; }

    if (!vaUser.isActivated) {
      res.status(403).json({ error: 'Account not yet activated. Please check your email for the activation link.' });
      return;
    }
    if (!vaUser.isActive) {
      res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, vaUser.password);
    if (!isMatch) { res.status(400).json({ error: 'Invalid email or password.' }); return; }

    const tokenPayload = {
      id:    vaUser._id.toString(),
      email: vaUser.email,
      role:  'va',
    };

    const accessToken  = await createToken(tokenPayload, '8h');
    const refreshToken = await createToken(tokenPayload, '30d');

    res.cookie('vaAccessToken',  accessToken,  { ...cookieOpts, maxAge: ACCESS_TOKEN_MS });
    res.cookie('vaRefreshToken', refreshToken, { ...cookieOpts, maxAge: REFRESH_TOKEN_MS });

    res.status(200).json({ message: 'Successfully authenticated.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error.';
    res.status(400).json({ error: msg });
  }
};

// GET /auth/va/me  (requires vaAccessToken cookie)
export const getVAProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.vaAccessToken;
    if (!token) { res.status(401).json({ error: 'Unauthorized.' }); return; }

    const publicPEM = process.env.PUBLIC_KEY;
    if (!publicPEM) throw new Error('PUBLIC_KEY not set');
    const publicKey = await jose.importSPKI(publicPEM, 'RS256');
    const { payload } = await jose.jwtVerify(token, publicKey);

    const vaUser = await VAUser.findById((payload as any).id).select('-password -activationToken');
    if (!vaUser) { res.status(404).json({ error: 'VA user not found.' }); return; }

    res.status(200).json({
      id:        vaUser._id.toString(),
      firstName: vaUser.firstName,
      lastName:  vaUser.lastName,
      email:     vaUser.email,
      services:  vaUser.services,
    });
  } catch {
    res.status(401).json({ error: 'Unauthorized.' });
  }
};

// POST /auth/va/logout
export const logoutVA = async (req: Request, res: Response): Promise<void> => {
  const clear = { ...cookieOpts, expires: new Date(0) };
  res.cookie('vaAccessToken',  '', clear);
  res.cookie('vaRefreshToken', '', clear);
  res.status(200).json({ message: 'Logged out successfully.' });
};