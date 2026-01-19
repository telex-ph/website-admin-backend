import { Router } from "express";

import { authenticate, refresh } from "./auth.controller.ts";

const router = Router();

router.post("/authenticate", authenticate);
router.post("/refresh", refresh);

export default router;
