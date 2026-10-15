import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();

// GET /api/dashboard/summary
router.get("/summary", getDashboardSummary);

export default router;
