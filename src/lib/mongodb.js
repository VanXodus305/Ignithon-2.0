import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "k1000";

if (!uri) {
  throw new Error("MONGODB_URI is not configured. Add it to .env before using the portal.");
}

let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

export default async function connectMongo() {
  // During Next.js hot reloads, global cache may still point to the previous
  // database. Reconnect instead of silently serving data from the wrong one.
  if (cached.conn?.connection?.name === dbName) return cached.conn;
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      dbName,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
