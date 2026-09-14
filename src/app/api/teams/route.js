import connectMongo from "@/lib/mongodb";
import { serializeTeam } from "@/lib/attendance";
import mongoose from "mongoose";
import Participant from "@/models/Participant";
import Team from "@/models/Team";

const rooms = ["A", "B", "C"];
const cleanText = (value) => value === undefined || value === null ? undefined : String(value).trim();

async function createTeamId() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const id = Math.floor(1000 + Math.random() * 9000);
    if (!(await Team.exists({ id }))) return id;
  }
  throw new Error("Could not allocate a unique team ID. Please try again.");
}

export async function POST(request) {
  try {
    await connectMongo();
    const body = await request.json();
    const members = Array.isArray(body.members) ? body.members : [];
    if (members.length < 1 || members.length > 4) return Response.json({ error: "A team must contain between 1 and 4 participants." }, { status: 400 });
    if (members.filter((member) => member.role === "leader").length !== 1) return Response.json({ error: "Select exactly one team leader." }, { status: 400 });
    const id = await createTeamId();
    const team = new Team({ id, name: cleanText(body.name) });
    if (!team.name) return Response.json({ error: "A team name is required." }, { status: 400 });
    const participantDocs = members.map((member) => new Participant({
      name: cleanText(member.name), email: cleanText(member.email)?.toLowerCase(), phone: cleanText(member.phone), roll_no: cleanText(member.roll_no), hostel: cleanText(member.hostel), branch: cleanText(member.branch), year: member.year ? Number(member.year) : undefined, is_kiit_student: Boolean(member.is_kiit_student), team_id: team._id,
    }));
    if (participantDocs.some((participant) => !participant.name || !participant.email)) return Response.json({ error: "Each participant needs a name and email." }, { status: 400 });
    const leaderIndex = members.findIndex((member) => member.role === "leader");
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const counts = await Team.aggregate([{ $match: { room: { $in: rooms } } }, { $group: { _id: "$room", count: { $sum: 1 } } }]).session(session);
        const countByRoom = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]));
        const room = rooms.reduce((best, candidate) => (countByRoom[candidate] || 0) < (countByRoom[best] || 0) ? candidate : best, rooms[0]);
        team.room = room;
        team.room_sequence = (countByRoom[room] || 0) + 1;
        await Participant.insertMany(participantDocs, { session });
        team.members = [participantDocs[leaderIndex]._id, ...participantDocs.filter((_, index) => index !== leaderIndex).map((participant) => participant._id)];
        await team.save({ session });
      });
    } finally { await session.endSession(); }
    const populated = await Team.findById(team._id).populate("members");
    return Response.json({ team: serializeTeam(populated) }, { status: 201 });
  } catch (error) {
    const message = error.code === 11000 ? "That email is already registered to another participant." : error.message;
    return Response.json({ error: message || "Could not create the team." }, { status: 500 });
  }
}
