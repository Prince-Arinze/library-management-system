import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin", "librarian"));

// GET /api/dashboard/summary
router.get("/summary", getDashboardSummary);

export default router;
