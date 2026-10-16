import { Router } from "express";
import { issueBook, returnBook } from "../controllers/borrowingController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = Router();
const staffRoles = ["superAdmin", "admin", "librarian"];

router.post("/", protect, authorize(...staffRoles), issueBook);
router.patch("/:id/return", protect, authorize(...staffRoles), returnBook);

export default router;
