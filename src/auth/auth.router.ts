import { Router } from "express";
import bcrypt from "bcrypt";

import { authorize, token } from "./auth.controller.ts";

const router = Router();

// router.post("/login", login);
router.post("/authorize", authorize);
router.post("/token", token);

export default router;
