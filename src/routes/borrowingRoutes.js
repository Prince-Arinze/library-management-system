import { Router } from "express";
import { issueBook } from "../controllers/borrowingController.js";

const router = Router();

router.post("/", issueBook);

export default router;