import { z } from "zod";
import { ObjectId } from "mongodb";
import { HttpError } from "./errors.js";
export const categories = ["Fiction", "Science", "History", "Kids", "Others"];
export const bookSchema = z
  .object({
    title: z.string().trim().min(1, "A title is required.").max(160),
    author: z.string().trim().min(1, "An author is required.").max(120),
    category: z.enum(categories),
    image: z
      .url()
      .refine(
        (value) => value.startsWith("https://"),
        "Use an HTTPS image URL.",
      ),
    description: z
      .string()
      .trim()
      .min(10, "Write a description of at least 10 characters.")
      .max(4000),
    totalCopies: z.number().int().min(1).max(10000),
  })
  .strict();
export const borrowSchema = z
  .object({ bookId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid book ID.") })
  .strict();
export function objectId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new HttpError(400, "Invalid record ID.");
  return new ObjectId(value);
}
