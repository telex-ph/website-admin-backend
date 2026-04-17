// src/va-users/va-auth.routes.ts
import { Router } from 'express';
import { authenticateVA, getVAProfile, logoutVA } from './va-auth.controller.js';

const router = Router();

router.post('/authenticate', authenticateVA);  // POST /auth/va/authenticate
router.get('/me',            getVAProfile);     // GET  /auth/va/me
router.post('/logout',       logoutVA);         // POST /auth/va/logout

export default router;
