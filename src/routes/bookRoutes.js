import { Router } from "express";

import {
    createBook,
    getBooks,
    getBookById,
    updateBook,
    deactivateBook,
} from "../controllers/bookController.js";

const router = Router();

router.route("/")
    .post(createBook)
    .get(getBooks);

// Keep specific routes above /:id if you add any later.
router.patch("/:id/deactivate", deactivateBook);
router.route("/:id")
    .get(getBookById)
    .patch(updateBook);

export default router;