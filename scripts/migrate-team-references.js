import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Set MONGODB_URI before running this migration.");

await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "k1000" });
const db = mongoose.connection.db;
const teamsCollection = db.collection("ignithon-teams");
const participantsCollection = db.collection("ignithon-participants");
const teams = await teamsCollection.find({}).toArray();
let migrated = 0;

for (const team of teams) {
  const existingMembers = Array.isArray(team.members) ? team.members : [];
  const resolved = [];
  for (const entry of existingMembers) {
    const participant = entry?.email
      ? await participantsCollection.findOne({ email: String(entry.email).toLowerCase() })
      : await participantsCollection.findOne({ _id: entry });
    if (participant) resolved.push({ id: participant._id, role: entry?.role });
  }
  // Direct references replace the legacy { email, role } objects. Leader is first.
  resolved.sort((a, b) => (a.role === "leader" ? -1 : 0) - (b.role === "leader" ? -1 : 0));
  const members = resolved.map((entry) => entry.id);
  await teamsCollection.updateOne({ _id: team._id }, { $set: { members } });
  if (members.length) await participantsCollection.updateMany({ _id: { $in: members } }, { $set: { team_id: team._id } });
  migrated += 1;
}

const attendanceResult = await participantsCollection.updateMany(
  { attendance: { $exists: false } },
  { $set: { attendance: false } },
);

console.log("Migrated " + migrated + " teams to direct participant references.");
console.log("Added attendance defaults to " + attendanceResult.modifiedCount + " participants.");
await mongoose.disconnect();
