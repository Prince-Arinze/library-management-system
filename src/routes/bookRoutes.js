import { Router } from "express";
import { authorize, optionalProtect, protect } from "../middleware/auth.js";

import {
    createBook,
    getBooks,
    getBookById,
    updateBook,
    deactivateBook,
} from "../controllers/bookController.js";

const router = Router();
const staffRoles = ["superAdmin", "admin", "librarian"];

router.route("/")
    .post(protect, authorize(...staffRoles), createBook)
    .get(optionalProtect, getBooks);

router.patch("/:id/deactivate", protect, authorize(...staffRoles), deactivateBook);
router.route("/:id")
    .get(optionalProtect, getBookById)
    .patch(protect, authorize(...staffRoles), updateBook);

export default router;