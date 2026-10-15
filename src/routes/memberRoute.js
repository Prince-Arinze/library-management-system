import express from "express";
import {
  registerMember,
  getSingleMember,
  listOfBorrowedBooks,
  deleteMyAccount,
  updateProfile
} from "../controllers/memberController.js";

const memberRouter = express.Router();

memberRouter.post("/", registerMember);
memberRouter.get("/:id", getSingleMember);
memberRouter.get("/:id/borrowings", listOfBorrowedBooks);
memberRouter.delete("/delete-me", deleteMyAccount);
memberRouter.patch("/profile/update", updateProfile);

export default memberRouter;
