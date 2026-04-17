// src/va-users/va-users.controller.ts
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import VAUser from './VAUser.model.js';

// ── GET /va-users/activate?token=xxx ─────────────────────────────────────────
export const validateActivationToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.query['token'] as string;
    if (!token) { res.status(400).json({ message: 'Activation token is required.' }); return; }

    const vaUser = await VAUser.findOne({ activationToken: token });

    if (!vaUser) {
      res.status(404).json({ valid: false, message: 'Invalid or expired activation link.' });
      return;
    }
    if (vaUser.isActivated) {
      res.status(400).json({ valid: false, message: 'Account already activated. Please log in.' });
      return;
    }
    if (new Date() > vaUser.activationExpiry) {
      res.status(400).json({ valid: false, message: 'Activation link has expired. Please contact support.' });
      return;
    }

    res.status(200).json({
      valid:     true,
      firstName: vaUser.firstName,
      lastName:  vaUser.lastName,
      email:     vaUser.email,
    });
  } catch (err) {
    console.error('[VA Users] validateActivationToken error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// ── POST /va-users/activate ───────────────────────────────────────────────────
export const activateAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token)            { res.status(400).json({ message: 'Activation token is required.' }); return; }
    if (!password)         { res.status(400).json({ message: 'Password is required.' }); return; }
    if (password.length < 8) { res.status(400).json({ message: 'Password must be at least 8 characters.' }); return; }

    const vaUser = await VAUser.findOne({ activationToken: token });

    if (!vaUser) {
      res.status(404).json({ message: 'Invalid or expired activation link.' });
      return;
    }
    if (vaUser.isActivated) {
      res.status(400).json({ message: 'Account already activated. Please log in.' });
      return;
    }
    if (new Date() > vaUser.activationExpiry) {
      res.status(400).json({ message: 'Activation link has expired. Please contact support.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Use findByIdAndUpdate to avoid re-triggering required validation on other fields
    await VAUser.findByIdAndUpdate(
      vaUser._id,
      {
        $set: {
          password:        hashedPassword,
          isActivated:     true,
          isActive:        true,
          activationToken: '',   // invalidate token
        },
      },
      { runValidators: false }
    );

    console.log(`[VA Users] Account activated: ${vaUser.email}`);

    res.status(200).json({
      message: 'Account activated successfully. You can now log in.',
      email:   vaUser.email,
    });
  } catch (err) {
    console.error('[VA Users] activateAccount error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// ── GET /va-users/list  (admin only) ─────────────────────────────────────────
export const listVAUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await VAUser.find()
      .select('-password -activationToken')
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error('[VA Users] listVAUsers error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
