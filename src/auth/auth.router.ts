import { Router } from "express";
import { authenticate, authenticateClient, registerClient, logout, refresh, getClientProfile } from "./auth.controller.js";
// Import ang verifyJwt middleware mula sa middlewares folder
import { verifyJwt } from "../middlewares/verify-jwt.middleware.js";

const router = Router();

// Public routes: Pwedeng ma-access kahit hindi naka-login
router.post("/authenticate", authenticate);
router.post("/refresh", refresh);

// 👤 Client login route
router.post("/client/authenticate", authenticateClient);

// 👤 Client self-registration (public — no JWT required)
router.post("/client/register", registerClient);

// 👤 Get current logged-in client profile (reads JWT cookie via verifyJwt)
router.get("/client/me", verifyJwt, getClientProfile);

// Protected route: Kailangan ng valid token para makapag-logout
// Kapag tinangka itong i-access manually o via script nang walang token, 
// haharangin ito ng verifyJwt.
router.post("/logout", verifyJwt, logout);

export default router;
