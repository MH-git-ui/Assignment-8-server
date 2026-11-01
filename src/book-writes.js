import { Router } from "express";
import { objectId, bookSchema } from "./validation.js";
import { HttpError } from "./errors.js";
export function bookWrites({ db, client, auth }) {
  const router = Router();
  const books = db.collection("books");
  router.post("/books", auth, async (req, res) => {
    const input = bookSchema.parse(req.body);
    const book = {
      ...input,
      availableCopies: input.totalCopies,
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      createdAt: new Date(),
    };
    const { insertedId } = await books.insertOne(book);
    res.status(201).json({ ...book, _id: insertedId });
  });
  router.patch("/books/:id", auth, async (req, res) => {
    const id = objectId(req.params.id);
    const input = bookSchema.parse(req.body);
    let updated;
    await client.withSession((session) =>
      session.withTransaction(async () => {
        const old = await books.findOne({ _id: id }, { session });
        if (!old) throw new HttpError(404, "This book could not be found.");
        if (old.ownerId !== req.user.id)
          throw new HttpError(403, "You can only edit books you added.");
        const borrowed = old.totalCopies - old.availableCopies;
        if (input.totalCopies < borrowed)
          throw new HttpError(
            409,
            `At least ${borrowed} copies are currently borrowed.`,
          );
        updated = await books.findOneAndUpdate(
          { _id: id },
          {
            $set: { ...input, updatedAt: new Date() },
            $inc: { availableCopies: input.totalCopies - old.totalCopies },
          },
          { session, returnDocument: "after" },
        );
      }),
    );
    res.json(updated);
  });
  router.delete("/books/:id", auth, async (req, res) => {
    const id = objectId(req.params.id);
    await client.withSession((session) =>
      session.withTransaction(async () => {
        const book = await books.findOne({ _id: id }, { session });
        if (!book) throw new HttpError(404, "This book could not be found.");
        if (book.ownerId !== req.user.id)
          throw new HttpError(403, "You can only delete books you added.");
        if (book.availableCopies !== book.totalCopies)
          throw new HttpError(
            409,
            "This book has active borrows. Wait for all copies to be returned.",
          );
        await books.deleteOne({ _id: id, ownerId: req.user.id }, { session });
      }),
    );
    res.json({ message: "Book deleted." });
  });
  return router;
}
