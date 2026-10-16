import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();
const staffRoles = ["superAdmin", "admin", "librarian"];

router.use(protect, authorize(...staffRoles));

// GET /api/dashboard/summary
router.get("/summary", getDashboardSummary);

export default router;
