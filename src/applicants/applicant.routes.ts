import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  submitApplication,
  listApplicants,
  getApplicant,
  approveApplicant,
  rejectApplicant,
} from './applicant.controller.ts';
import { verifyJwt } from '../middlewares/verify-jwt.middleware.ts';

const router = Router();

// ── Multer setup for resume uploads ──────────────────────────────────────────
const uploadDir = path.join(process.cwd(), 'uploads', 'resumes');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Public — VA submits their application
router.post('/', upload.single('resume'), submitApplication);

// Admin-only routes (protected by verifyJwt middleware)
router.get('/',              verifyJwt, listApplicants);
router.get('/:id',           verifyJwt, getApplicant);
router.patch('/:id/approve', verifyJwt, approveApplicant);
router.patch('/:id/reject',  verifyJwt, rejectApplicant);

export default router;