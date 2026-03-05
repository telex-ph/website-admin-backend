import { Router } from "express";
import { authenticate, authenticateClient, logout, refresh, getClientProfile } from "./auth.controller.ts";
// Import ang verifyJwt middleware mula sa middlewares folder
import { verifyJwt } from "../middlewares/verify-jwt.middleware.ts";

const router = Router();

// Public routes: Pwedeng ma-access kahit hindi naka-login
router.post("/authenticate", authenticate);
router.post("/refresh", refresh);

// 👤 Client login route
router.post("/client/authenticate", authenticateClient);

// 👤 Get current logged-in client profile (reads JWT cookie via verifyJwt)
router.get("/client/me", verifyJwt, getClientProfile);

// Protected route: Kailangan ng valid token para makapag-logout
// Kapag tinangka itong i-access manually o via script nang walang token, 
// haharangin ito ng verifyJwt.
router.post("/logout", verifyJwt, logout);

export default router;