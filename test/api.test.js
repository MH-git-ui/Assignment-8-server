import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { generateKeyPair, SignJWT, jwtVerify } from "jose";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createIndexes } from "../src/db.js";
import { requireAuth } from "../src/auth.js";
import { bookReads } from "../src/book-reads.js";
import { bookWrites } from "../src/book-writes.js";
import { borrowRoutes } from "../src/borrows.js";
let repl, client, db, app, keys;
const config = { origin: "http://localhost:3000" };
const book = {
  title: "A Test Story",
  author: "A Reader",
  category: "Fiction",
  image: "https://i.ibb.co/example/cover.jpg",
  description: "A book for integration tests.",
  totalCopies: 2,
};
async function token(id = "alice", overrides = {}) {
  return new SignJWT({ email: `${id}@example.com`, name: id })
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(id)
    .setIssuer(overrides.issuer || "booknook-test")
    .setAudience("booknook-api")
    .setExpirationTime(overrides.exp || "5m")
    .sign(keys.privateKey);
}
async function authorized(method, path, id = "alice") {
  return request(app)
    [method](path)
    .set("Authorization", `Bearer ${await token(id)}`);
}
async function add(input = book, id = "alice") {
  return request(app)
    .post("/books")
    .set("Authorization", `Bearer ${await token(id)}`)
    .send(input);
}
before(async () => {
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  client = await new MongoClient(repl.getUri()).connect();
  db = client.db("booknook-test");
  await createIndexes(db);
  keys = await generateKeyPair("EdDSA");
  const auth = requireAuth((value) =>
    jwtVerify(value, keys.publicKey, {
      issuer: "booknook-test",
      audience: "booknook-api",
      algorithms: ["EdDSA"],
    }),
  );
  const context = { client, db, auth };
  app = createApp({
    config,
    routes: [bookReads(context), bookWrites(context), borrowRoutes(context)],
  });
});
beforeEach(async () => {
  await db.collection("borrows").deleteMany({});
  await db.collection("books").deleteMany({});
});
after(async () => {
  await client?.close();
  await repl?.stop();
});
test("public catalogue works; private reads and writes require JWT", async () => {
  assert.equal((await request(app).get("/books")).status, 200);
  for (const [method, path] of [
    ["get", "/books?mine=true"],
    ["get", "/books/000000000000000000000000"],
    ["post", "/books"],
    ["get", "/borrows"],
  ])
    assert.equal((await request(app)[method](path)).status, 401);
});
test("rejects forged, expired and wrong-issuer JWTs", async () => {
  for (const jwt of [
    "invalid",
    await token("alice", { exp: "1s ago" }),
    await token("alice", { issuer: "evil" }),
  ])
    assert.equal(
      (await request(app).get("/borrows").set("Authorization", `Bearer ${jwt}`))
        .status,
      401,
    );
});
test("validates fields and derives ownership from signed identity", async () => {
  assert.equal((await add({ ...book, totalCopies: -1 })).status, 400);
  assert.equal((await add({ ...book, ownerId: "bob" })).status, 400);
  const created = await add();
  assert.equal(created.status, 201);
  assert.equal(created.body.ownerId, "alice");
  const list = await request(app).get("/books");
  assert.equal(list.body[0].ownerEmail, undefined);
});
test("new arrivals are sorted newest-first and limited to six", async () => {
  for (let i = 0; i < 8; i++)
    await db
      .collection("books")
      .insertOne({
        ...book,
        createdAt: new Date(2026, 0, i + 1),
        availableCopies: 2,
        ownerId: "alice",
      });
  const res = await request(app).get("/books?sort=newest&limit=6");
  assert.equal(res.body.length, 6);
  assert.ok(res.body[0].createdAt > res.body[5].createdAt);
  assert.equal((await request(app).get("/books?limit=-1")).status, 400);
});
test("restricts personal shelves and mutations to owner", async () => {
  const created = await add();
  const id = created.body._id;
  const bob = await token("bob");
  assert.equal(
    (
      await request(app)
        .get("/books?mine=true")
        .set("Authorization", `Bearer ${bob}`)
    ).body.length,
    0,
  );
  assert.equal(
    (
      await request(app)
        .patch(`/books/${id}`)
        .set("Authorization", `Bearer ${bob}`)
        .send(book)
    ).status,
    403,
  );
  assert.equal(
    (
      await request(app)
        .delete(`/books/${id}`)
        .set("Authorization", `Bearer ${bob}`)
    ).status,
    403,
  );
});
test("borrows only once, records a 14-day loan and restores copies exactly once", async () => {
  const id = (await add()).body._id;
  const jwt = await token();
  const borrow = await request(app)
    .post("/borrows")
    .set("Authorization", `Bearer ${jwt}`)
    .send({ bookId: id });
  assert.equal(borrow.status, 201);
  assert.equal(
    new Date(borrow.body.returnDate) - new Date(borrow.body.borrowDate),
    14 * 86400000,
  );
  assert.equal(
    (
      await request(app)
        .post("/borrows")
        .set("Authorization", `Bearer ${jwt}`)
        .send({ bookId: id })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(app)
        .get(`/books/${id}`)
        .set("Authorization", `Bearer ${jwt}`)
    ).body.availableCopies,
    1,
  );
  assert.equal(
    (
      await request(app)
        .delete(`/borrows/${borrow.body._id}`)
        .set("Authorization", `Bearer ${await token("bob")}`)
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .delete(`/borrows/${borrow.body._id}`)
        .set("Authorization", `Bearer ${jwt}`)
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app)
        .delete(`/borrows/${borrow.body._id}`)
        .set("Authorization", `Bearer ${jwt}`)
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .get(`/books/${id}`)
        .set("Authorization", `Bearer ${jwt}`)
    ).body.availableCopies,
    2,
  );
});
test("concurrent borrowers cannot oversell the last copy", async () => {
  const id = (await add({ ...book, totalCopies: 1 })).body._id;
  const tokens = await Promise.all([token("alice"), token("bob")]);
  const results = await Promise.all(
    tokens.map((t) =>
      request(app)
        .post("/borrows")
        .set("Authorization", `Bearer ${t}`)
        .send({ bookId: id }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await db.collection("books").findOne({})).availableCopies, 0);
  assert.equal(await db.collection("borrows").countDocuments(), 1);
});
test("concurrent duplicate requests cannot create two borrows", async () => {
  const id = (await add()).body._id;
  const jwt = await token();
  const results = await Promise.all(
    [0, 1].map(() =>
      request(app)
        .post("/borrows")
        .set("Authorization", `Bearer ${jwt}`)
        .send({ bookId: id }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await db.collection("books").findOne({})).availableCopies, 1);
});
test("blocks deletion and reducing total copies below active loans", async () => {
  const id = (await add()).body._id;
  const jwt = await token();
  for (const user of ["alice", "bob"])
    await request(app)
      .post("/borrows")
      .set("Authorization", `Bearer ${await token(user)}`)
      .send({ bookId: id });
  assert.equal(
    (
      await request(app)
        .delete(`/books/${id}`)
        .set("Authorization", `Bearer ${jwt}`)
    ).status,
    409,
  );
  assert.equal(
    (
      await request(app)
        .patch(`/books/${id}`)
        .set("Authorization", `Bearer ${jwt}`)
        .send({ ...book, totalCopies: 1 })
    ).status,
    409,
  );
  const result = await request(app)
    .patch(`/books/${id}`)
    .set("Authorization", `Bearer ${jwt}`)
    .send({ ...book, totalCopies: 3 });
  assert.equal(result.status, 200);
  assert.equal(result.body.availableCopies, 1);
});
test("validates IDs, malformed JSON and missing records", async () => {
  const jwt = await token();
  assert.equal(
    (
      await request(app)
        .get("/books/not-an-id")
        .set("Authorization", `Bearer ${jwt}`)
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .get("/books/000000000000000000000000")
        .set("Authorization", `Bearer ${jwt}`)
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .post("/books")
        .set("Content-Type", "application/json")
        .send("{")
    ).status,
    400,
  );
});
