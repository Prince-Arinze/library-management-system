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

router.patch("/:id/deactivate", deactivateBook);
router.route("/:id")
    .get(getBookById)
    .patch(updateBook);

export default router;