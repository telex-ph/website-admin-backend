import type { Request, Response } from 'express';
import crypto from 'crypto';
import {
  createApplicant,
  getAllApplicants,
  getApplicantById,
  updateApplicantStatus,
} from './applicant.service.js';
import { sendMail }           from '../common/mailer.js';
import { buildApprovalEmail } from './applicant-approved.email.js';
import { buildRejectionEmail } from './applicant-rejected.email.js';
import VAUser from '../va-users/VAUser.model.js';

const ACTIVATION_EXPIRY_HOURS = 48;

// POST /applicants
export const submitApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      firstName, lastName, middleName,
      email, phone, address, city, state, zip, country, dob, gender,
      services, experienceLevel, availability, timezone, rate, startDate,
      coverLetter,
    } = req.body;

    let parsedServices: string[] = [];
    try {
      parsedServices = typeof services === 'string' ? JSON.parse(services) : services;
    } catch { parsedServices = []; }

    const file = req.file as Express.Multer.File | undefined;

    const applicant = await createApplicant({
      firstName,
      lastName,
      middleName:         middleName         ?? '',
      email,
      phone,
      address,
      city,
      state:              state              ?? '',
      zip,
      country,
      dob,
      gender:             gender             ?? '',
      services:           parsedServices,
      experienceLevel,
      availability,
      timezone,
      rate,
      startDate:          startDate          ?? '',
      coverLetter:        coverLetter        ?? '',
      resumeUrl:          file ? `/uploads/resumes/${file.filename}` : '',
      resumeOriginalName: file ? file.originalname : '',
    });

    res.status(201).json({
      message: 'Application submitted successfully.',
      confirmCode: applicant.confirmCode,
      id: applicant._id,
    });
  } catch (err: unknown) {
    console.error('[Applicants] submitApplication error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// GET /applicants  (admin only)
export const listApplicants = async (_req: Request, res: Response): Promise<void> => {
  try {
    const applicants = await getAllApplicants();
    res.status(200).json(applicants);
  } catch (err) {
    console.error('[Applicants] listApplicants error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// GET /applicants/:id  (admin only)
export const getApplicant = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicant = await getApplicantById(req.params['id'] as string);
    if (!applicant) { res.status(404).json({ message: 'Applicant not found.' }); return; }
    res.status(200).json(applicant);
  } catch (err) {
    console.error('[Applicants] getApplicant error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// ── PATCH /applicants/:id/approve  (admin only) ───────────────────────────────
export const approveApplicant = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicant = await updateApplicantStatus(req.params['id'] as string, 'approved');
    if (!applicant) { res.status(404).json({ message: 'Applicant not found.' }); return; }

    // Generate secure one-time activation token
    const activationToken  = crypto.randomBytes(32).toString('hex');
    const activationExpiry = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);

    // Create VA user account (not yet activated — no password yet)
    const existingVAUser = await VAUser.findOne({ email: applicant.email });
    if (!existingVAUser) {
      await VAUser.create({
        applicantId:      applicant._id,
        firstName:        applicant.firstName,
        lastName:         applicant.lastName,
        email:            applicant.email,
        services:         applicant.services ?? [],
        activationToken,
        activationExpiry,
        isActivated:      false,
        isActive:         false,
      });
    } else {
      // Re-issue token if already exists (re-approval case)
      existingVAUser.activationToken  = activationToken;
      existingVAUser.activationExpiry = activationExpiry;
      existingVAUser.isActivated      = false;
      existingVAUser.isActive         = false;
      await existingVAUser.save();
    }

    // Build activation URL pointing to frontend activation page
    const baseUrl       = process.env.VA_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
    const activationUrl = `${baseUrl}/VirtualAssistant/activate?token=${activationToken}`;

    // Send approval email with activation link
    try {
      await sendMail({
        to:      { name: `${applicant.firstName} ${applicant.lastName}`, email: applicant.email },
        subject: 'Your Virtual Assistant Application Has Been Approved – TelexPH',
        html:    buildApprovalEmail({
          firstName:     applicant.firstName,
          lastName:      applicant.lastName,
          activationUrl,
          expiryHours:   ACTIVATION_EXPIRY_HOURS,
        }),
      });
      console.log(`[Applicants] Approval + activation email sent → ${applicant.email}`);
    } catch (mailErr) {
      console.error('[Applicants] Approval email failed:', mailErr);
    }

    res.status(200).json({
      message: 'Applicant approved. Activation email sent.',
      applicant,
    });
  } catch (err) {
    console.error('[Applicants] approveApplicant error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// ── PATCH /applicants/:id/reject  (admin only) ────────────────────────────────
export const rejectApplicant = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicant = await updateApplicantStatus(req.params['id'] as string, 'rejected');
    if (!applicant) { res.status(404).json({ message: 'Applicant not found.' }); return; }

    try {
      await sendMail({
        to:      { name: `${applicant.firstName} ${applicant.lastName}`, email: applicant.email },
        subject: 'Update Regarding Your Virtual Assistant Application – TelexPH',
        html:    buildRejectionEmail({
          firstName: applicant.firstName,
          lastName:  applicant.lastName,
        }),
      });
      console.log(`[Applicants] Rejection email sent → ${applicant.email}`);
    } catch (mailErr) {
      console.error('[Applicants] Rejection email failed:', mailErr);
    }

    res.status(200).json({
      message: 'Applicant rejected. Notification sent via email.',
      applicant,
    });
  } catch (err) {
    console.error('[Applicants] rejectApplicant error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
