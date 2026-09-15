import connectMongo from "@/lib/mongodb";
import { findTeamForQr, searchTeams } from "@/lib/attendance";
import Participant from "@/models/Participant";
import Team from "@/models/Team";
import mongoose from "mongoose";
import { syncGoogleSheetSafely } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
const rooms = ["A", "B", "C"];

async function assignRoom(teamId, session) {
  const team = await Team.findById(teamId).session(session);
  if (!team) return null;
  if (team.room) {
    if (!team.room_sequence) {
      const roomSequence = (await Team.countDocuments({ room: team.room, room_sequence: { $ne: null } }).session(session)) + 1;
      team.room_sequence = roomSequence;
      await team.save({ session });
    }
    return { room: team.room, roomSequence: team.room_sequence };
  }
  const counts = await Team.aggregate([
    { $match: { room: { $in: rooms } } },
    { $group: { _id: "$room", count: { $sum: 1 } } },
  ]).session(session);
  const countByRoom = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]));
  const room = rooms.reduce((best, candidate) =>
    (countByRoom[candidate] || 0) < (countByRoom[best] || 0) ? candidate : best,
  rooms[0]);
  const roomSequence = (countByRoom[room] || 0) + 1;
  const assigned = await Team.findOneAndUpdate(
    { _id: team._id, room: null },
    { $set: { room, room_sequence: roomSequence } },
    { returnDocument: "after", session },
  );
  return { room: assigned?.room || team.room, roomSequence: assigned?.room_sequence || team.room_sequence };
}

export async function GET(request) {
  try {
    await connectMongo();
    const { searchParams } = new URL(request.url);
    const qr = searchParams.get("qr");
    if (qr) {
      const result = await findTeamForQr(qr);
      return Response.json(result, { status: result.error ? 404 : 200 });
    }
    return Response.json({ teams: await searchTeams(searchParams.get("q")) });
  } catch (error) {
    return Response.json({ error: error.message || "Could not load attendance data." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    await connectMongo();
    const { participantId, attendance } = await request.json();
    if (!participantId || typeof attendance !== "boolean") {
      return Response.json({ error: "participantId and attendance are required." }, { status: 400 });
    }
    const session = await mongoose.startSession();
    let participant;
    let assignment = null;
    try {
      await session.withTransaction(async () => {
        participant = await Participant.findByIdAndUpdate(participantId, { attendance }, { returnDocument: "after", runValidators: true, session }).lean();
        if (!participant) return;
        if (attendance && participant.team_id) assignment = await assignRoom(participant.team_id, session);
      });
    } finally {
      await session.endSession();
    }
    if (!participant) return Response.json({ error: "Participant not found." }, { status: 404 });
    void syncGoogleSheetSafely();
    return Response.json({ participant: { ...participant, _id: String(participant._id) }, room: assignment?.room || null, roomSequence: assignment?.roomSequence || null });
  } catch (error) {
    return Response.json({ error: error.message || "Could not update attendance." }, { status: 500 });
  }
}
