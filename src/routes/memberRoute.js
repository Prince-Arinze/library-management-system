import express from "express";
import {
  registerMember,
  getSingleMember,
  listOfBorrowedBooks,
  updateMember,
  deactivateMember,
} from "../controllers/memberController.js";
import { protect, authorize } from "../middleware/auth.js";

const memberRouter = express.Router();

memberRouter.use(protect, authorize("admin", "librarian"));

memberRouter.post("/", registerMember);
memberRouter.get("/:id/borrowings", listOfBorrowedBooks);
memberRouter.patch("/:id/deactivate", authorize("admin"), deactivateMember);
memberRouter.route("/:id").get(getSingleMember).patch(updateMember);

export default memberRouter;
