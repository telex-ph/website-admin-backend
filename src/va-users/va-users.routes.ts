// src/va-users/va-users.routes.ts
import { Router } from 'express';
import {
  validateActivationToken,
  activateAccount,
  listVAUsers,
} from './va-users.controller.ts';
import { verifyJwt } from '../middlewares/verify-jwt.middleware.ts';

const router = Router();

// Public — VA activation flow
router.get('/',          validateActivationToken); // GET /va-users/activate?token=xxx
router.post('/',         activateAccount);          // POST /va-users/activate

// Admin only
router.get('/list',      verifyJwt, listVAUsers);

export default router;