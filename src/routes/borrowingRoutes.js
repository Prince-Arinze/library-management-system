
import { Router } from "express";

import {
  returnBook,
  getBorrowingHistory,
  getOverdueBorrowings,
} from "../controllers/borrowingController.js";

const router = Router();

// GET /api/borrowings/overdue
router.get("/overdue", getOverdueBorrowings);

// GET /api/borrowings
router.get("/", getBorrowingHistory);

// PATCH /api/borrowings/:id/return
router.patch("/:id/return", returnBook);

export default router;
