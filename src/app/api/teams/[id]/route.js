import connectMongo from "@/lib/mongodb";
import { serializeTeam } from "@/lib/attendance";
import mongoose from "mongoose";
import Participant from "@/models/Participant";
import Team from "@/models/Team";
import { syncGoogleSheetSafely } from "@/lib/google-sheets";

const cleanText = (value) =>
  value === undefined || value === null ? undefined : String(value).trim();

export async function PATCH(request, { params }) {
  try {
    await connectMongo();
    const { id } = await params;
    const team = await Team.findOne({ id: Number(id) });
    if (!team) return Response.json({ error: "Team not found." }, { status: 404 });
    const body = await request.json();
    const room = cleanText(body.room)?.toUpperCase() || null;
    if (room && !["A", "B", "C"].includes(room)) {
      return Response.json({ error: "Room must be A, B, or C." }, { status: 400 });
    }
    const incoming = Array.isArray(body.members) ? body.members : [];
    if (incoming.length < 1 || incoming.length > 4) {
      return Response.json({ error: "A team must contain between 1 and 4 participants." }, { status: 400 });
    }
    const leaders = incoming.filter((member) => member.role === "leader");
    if (leaders.length !== 1) return Response.json({ error: "Select exactly one team leader." }, { status: 400 });

    const updatedIds = [];
    const memberOperations = [];
    for (const member of incoming) {
      const details = {
        name: cleanText(member.name),
        email: cleanText(member.email)?.toLowerCase(),
        phone: cleanText(member.phone),
        roll_no: cleanText(member.roll_no),
        hostel: cleanText(member.hostel),
        branch: cleanText(member.branch),
        year: member.year ? Number(member.year) : undefined,
        is_kiit_student: Boolean(member.is_kiit_student), team_id: team._id,
      };
      if (!details.name || !details.email) return Response.json({ error: "Each participant needs a name and email." }, { status: 400 });
      if (member._id) {
        if (!mongoose.isValidObjectId(member._id)) {
          return Response.json({ error: "A participant id is invalid." }, { status: 400 });
        }
        updatedIds.push(new mongoose.Types.ObjectId(member._id));
        memberOperations.push({
          updateOne: { filter: { _id: member._id }, update: { $set: details } },
        });
      } else {
        const participant = new Participant(details);
        const validationError = participant.validateSync();
        if (validationError) {
          return Response.json({ error: validationError.message }, { status: 400 });
        }
        updatedIds.push(participant._id);
        memberOperations.push({ insertOne: { document: participant.toObject() } });
      }
    }
    const leader = incoming.find((member) => member.role === "leader");
    const orderedIds = [
      updatedIds[incoming.indexOf(leader)],
      ...updatedIds.filter((participantId) => String(participantId) !== String(updatedIds[incoming.indexOf(leader)])),
    ];
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // One batched participant write, one removal write, and one team write.
        await Participant.bulkWrite(memberOperations, { session, ordered: true });
        await Participant.deleteMany(
          { team_id: team._id, _id: { $nin: updatedIds } },
          { session },
        );
        team.name = cleanText(body.name) || team.name;
        if (room !== team.room) {
          team.room = room;
          team.room_sequence = room
            ? (await Team.countDocuments({ room, _id: { $ne: team._id } }).session(session)) + 1
            : null;
        }
        team.members = orderedIds;
        await team.save({ session });
      });
    } finally {
      await session.endSession();
    }
    const populated = await Team.findById(team._id).populate("members");
    void syncGoogleSheetSafely();
    return Response.json({ team: serializeTeam(populated) });
  } catch (error) {
    const message = error.code === 11000 ? "That email is already registered to another participant." : error.message;
    return Response.json({ error: message || "Could not update the team." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    await connectMongo();
    const { id } = await params;
    const team = await Team.findOne({ id: Number(id) });
    if (!team) return Response.json({ error: "Team not found." }, { status: 404 });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Participant.deleteMany({ team_id: team._id }, { session });
        await Team.deleteOne({ _id: team._id }, { session });
      });
    } finally {
      await session.endSession();
    }
    void syncGoogleSheetSafely();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || "Could not delete the team." }, { status: 500 });
  }
}
