import { Router } from "express";
import { objectId } from "./validation.js";
import { HttpError } from "./errors.js";
export function bookReads({ db, auth }) {
  const router = Router();
  const books = db.collection("books");
  router.get(
    "/books",
    (req, res, next) =>
      req.query.mine === "true" ? auth(req, res, next) : next(),
    async (req, res) => {
      const query = req.query.mine === "true" ? { ownerId: req.user.id } : {};
      const limit = req.query.limit === undefined ? 0 : Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 0 || limit > 100)
        throw new HttpError(400, "Limit must be between 0 and 100.");
      const projection =
        req.query.mine === "true" ? {} : { ownerEmail: 0, ownerId: 0 };
      res.json(
        await books
          .find(query, { projection })
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .toArray(),
      );
    },
  );
  router.get("/books/:id", auth, async (req, res) => {
    const book = await books.findOne({ _id: objectId(req.params.id) });
    if (!book) throw new HttpError(404, "This book could not be found.");
    res.json(book);
  });
  return router;
}
