import { Router } from "express";
import { authorize, protect } from "../middleware/auth.js";

import {
    createBook,
    getBooks,
    getBookById,
    updateBook,
    deactivateBook,
} from "../controllers/bookController.js";

const router = Router();

router.route("/")
    .post(protect, authorize("admin", "librarian"), createBook)
    .get(getBooks);

router.patch("/:id/deactivate", protect, authorize("admin", "librarian"), deactivateBook);
router.route("/:id")
    .get(getBookById)
    .patch(protect, authorize("admin", "librarian"), updateBook);

export default router;