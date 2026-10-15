import express from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  activateUser
} from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.route("/")
  .get(getUsers)
  .post(createUser);

router.route("/:id")
  .get(getUserById)
  .patch(updateUser);

router.patch("/:id/deactivate", deactivateUser);
router.patch("/:id/activate", activateUser);

export default router;