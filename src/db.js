import { MongoClient } from "mongodb";
export async function connectDatabase(config) {
  const client = new MongoClient(config.uri);
  try {
    await client.connect();
    const db = client.db(config.database);
    await createIndexes(db);
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}
export async function createIndexes(db) {
  await Promise.all([
    db.collection("books").createIndex({ createdAt: -1 }),
    db.collection("books").createIndex({ ownerId: 1, createdAt: -1 }),
    db
      .collection("borrows")
      .createIndex({ userId: 1, bookId: 1 }, { unique: true }),
    db.collection("borrows").createIndex({ bookId: 1 }),
  ]);
}
