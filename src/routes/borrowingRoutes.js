import { Router } from "express";
import { issueBook } from "../controllers/borrowingController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = Router();
const staffRoles = ["superAdmin", "admin", "librarian"];

router.post("/", protect, authorize(...staffRoles), issueBook);

export default router;