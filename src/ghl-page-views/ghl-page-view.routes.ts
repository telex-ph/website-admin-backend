import express from "express";
import { verifyJwt } from "../middlewares/verify-jwt.middleware.js";
import { 
  getGhlFunnelClientDashboard, 
  getFunnelsAnalytics, 
  getFunnelDetailAnalytics 
} from "./ghl-page-view.controller.js";

const router = express.Router();

router.get("/dashboard", verifyJwt, getGhlFunnelClientDashboard);

// Admin funnel analytics routes
router.get("/funnels", verifyJwt, getFunnelsAnalytics);
router.get("/funnels/:url", verifyJwt, getFunnelDetailAnalytics);

export default router;
