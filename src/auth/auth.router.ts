import { Router } from "express";

import { authenticate, logout, refresh } from "./auth.controller.ts";

const router = Router();

router.post("/authenticate", authenticate);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
