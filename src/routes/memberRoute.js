import express from "express";
import {
  registerMember,
  getSingleMember,
  listOfBorrowedBooks,
  deleteMyAccount,
} from "../controllers/memberController.js";

const memberRouter = express.Router();

memberRouter.post("/", registerMember);
memberRouter.get("/:id", getSingleMember);
memberRouter.get("/:id/borrowings", listOfBorrowedBooks);
memberRouter.delete("/me", deleteMyAccount);

export default memberRouter;
