import express from "express";

import {
  getInventoryReport,
  getOverdueReport,
  getBorrowingHistoryReport,
  getMemberActivityReport,
  getReturnsReport,
} from "../controllers/reportController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin", "librarian"));

// GET /api/reports/inventory
router.get("/inventory", getInventoryReport);

// GET /api/reports/overdue
router.get("/overdue", getOverdueReport);

// GET /api/reports/borrowings
// Optional filter: ?status=borrowed or ?status=returned
router.get("/borrowings", getBorrowingHistoryReport);

// GET /api/reports/members
router.get("/members", getMemberActivityReport);

// GET /api/reports/returns
// Optional query parameters: ?page=1&limit=10
router.get("/returns", getReturnsReport);

export default router;
