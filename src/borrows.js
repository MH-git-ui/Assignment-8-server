import { Router } from "express";
import { objectId, borrowSchema } from "./validation.js";
import { HttpError } from "./errors.js";
export function borrowRoutes({ db, client, auth }) {
  const router = Router();
  const books = db.collection("books");
  const borrows = db.collection("borrows");
  router.post("/borrows", auth, async (req, res) => {
    const { bookId } = borrowSchema.parse(req.body);
    const id = objectId(bookId);
    let borrow;
    await client.withSession((session) =>
      session.withTransaction(async () => {
        if (
          await borrows.findOne(
            { bookId: id, userId: req.user.id },
            { session },
          )
        )
          throw new HttpError(
            409,
            "You already borrowed this book. Return it before borrowing again.",
          );
        const book = await books.findOneAndUpdate(
          { _id: id, availableCopies: { $gt: 0 } },
          { $inc: { availableCopies: -1 } },
          { session, returnDocument: "after" },
        );
        if (!book)
          throw new HttpError(409, "This book is not available right now.");
        const borrowDate = new Date();
        const returnDate = new Date(borrowDate.getTime() + 14 * 86400000);
        borrow = {
          bookId: id,
          bookTitle: book.title,
          bookImage: book.image,
          userId: req.user.id,
          userEmail: req.user.email,
          borrowDate,
          returnDate,
        };
        const { insertedId } = await borrows.insertOne(borrow, { session });
        borrow._id = insertedId;
      }),
    );
    res.status(201).json(borrow);
  });
  router.get("/borrows", auth, async (req, res) =>
    res.json(
      await borrows
        .find({ userId: req.user.id })
        .sort({ borrowDate: -1 })
        .toArray(),
    ),
  );
  router.delete("/borrows/:id", auth, async (req, res) => {
    const id = objectId(req.params.id);
    await client.withSession((session) =>
      session.withTransaction(async () => {
        const borrow = await borrows.findOneAndDelete(
          { _id: id, userId: req.user.id },
          { session },
        );
        if (!borrow)
          throw new HttpError(
            404,
            "This borrow could not be found in your account.",
          );
        const { matchedCount } = await books.updateOne(
          { _id: borrow.bookId },
          { $inc: { availableCopies: 1 } },
          { session },
        );
        if (!matchedCount)
          throw new HttpError(
            409,
            "The book record is unavailable. Please contact the library.",
          );
      }),
    );
    res.json({ message: "Book returned. Thank you for sharing the story." });
  });
  return router;
}
