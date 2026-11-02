import { MongoClient } from "mongodb";
import { createIndexes } from "../src/db.js";

const seedSource = "booknook-initial-catalogue";
const libraryOwner = {
  ownerId: "booknook-community-library",
  ownerName: "BookNook Community Library",
  ownerEmail: "library@booknook.community",
};

const catalogue = [
  {
    key: "midnight-library",
    title: "The Midnight Library",
    author: "Matt Haig",
    category: "Fiction",
    description: "A hopeful novel about second chances, alternate lives, and finding meaning in the life already in front of you.",
    totalCopies: 4,
    image: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "brief-history-of-time",
    title: "A Brief History of Time",
    author: "Stephen Hawking",
    category: "Science",
    description: "An accessible tour of the universe, from black holes and the Big Bang to the questions that shape modern physics.",
    totalCopies: 3,
    image: "https://images.unsplash.com/photo-1453738773917-9c3eff1db985?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "sapiens",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    category: "History",
    description: "A sweeping history of humankind, tracing how shared stories, cooperation, and invention shaped our world.",
    totalCopies: 5,
    image: "https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "wild-robot",
    title: "The Wild Robot",
    author: "Peter Brown",
    category: "Kids",
    description: "A warm adventure about a robot who learns to survive and belong after waking alone on a remote island.",
    totalCopies: 3,
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "braiding-sweetgrass",
    title: "Braiding Sweetgrass",
    author: "Robin Wall Kimmerer",
    category: "Others",
    description: "Essays that braid Indigenous wisdom, scientific knowledge, and a generous relationship with the living world.",
    totalCopies: 2,
    image: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "left-hand-of-darkness",
    title: "The Left Hand of Darkness",
    author: "Ursula K. Le Guin",
    category: "Fiction",
    description: "A landmark science-fiction journey through a wintry world where politics, friendship, and identity intertwine.",
    totalCopies: 2,
    image: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "code-book",
    title: "The Code Book",
    author: "Simon Singh",
    category: "Science",
    description: "The human story of secret writing and codebreaking, from ancient ciphers to the foundations of digital security.",
    totalCopies: 4,
    image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
  },
  {
    key: "single-shard",
    title: "A Single Shard",
    author: "Linda Sue Park",
    category: "Kids",
    description: "A historical coming-of-age story following a young orphan and his determined path toward becoming a potter.",
    totalCopies: 3,
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80",
  },
];

const uri = process.env.MONGODB_URI;
const database = process.env.MONGODB_DB;
if (!uri || !database) throw new Error("MONGODB_URI and MONGODB_DB are required.");

const client = new MongoClient(uri);
await client.connect();
try {
  const db = client.db(database);
  await createIndexes(db);
  const books = db.collection("books");
  const now = Date.now();
  let inserted = 0;

  for (const [index, book] of catalogue.entries()) {
    const result = await books.updateOne(
      { seedSource, seedKey: book.key },
      {
        $setOnInsert: {
          ...book,
          ...libraryOwner,
          seedSource,
          seedKey: book.key,
          availableCopies: book.totalCopies,
          createdAt: new Date(now - index * 60_000),
          updatedAt: new Date(now - index * 60_000),
        },
      },
      { upsert: true },
    );
    inserted += result.upsertedCount;
  }

  console.log(`Initial catalogue ready: ${catalogue.length} books (${inserted} newly inserted).`);
} finally {
  await client.close();
}
