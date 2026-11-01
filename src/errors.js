export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err?.name === "ZodError")
    return res
      .status(400)
      .json({ message: err.issues.map((i) => i.message).join(" ") });
  if (err?.code === 11000)
    return res
      .status(409)
      .json({
        message:
          "You already borrowed this book. Return it before borrowing again.",
      });
  if (err?.type === "entity.parse.failed")
    return res.status(400).json({ message: "Invalid JSON request." });
  if (err?.type === "entity.too.large")
    return res.status(413).json({ message: "Request is too large." });
  if (!err.status) console.error("Request failed:", err.name);
  return res
    .status(err.status || 500)
    .json({
      message: err.status
        ? err.message
        : "The library service is unavailable. Please try again.",
    });
}
