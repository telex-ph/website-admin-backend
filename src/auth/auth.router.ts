import { Router } from "express";
import bcrypt from "bcrypt";

import { login } from "./auth.controller.ts";

const router = Router();

router.post("/login", login);

export default router;
