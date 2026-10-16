import { Router } from "express";
import { issueBook } from "../controllers/borrowingController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = Router();

router.post("/", protect, authorize("admin", "librarian"), issueBook);

export default router;