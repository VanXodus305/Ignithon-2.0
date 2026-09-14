import connectMongo from "@/lib/mongodb";
import { findTeamForQr, searchTeams } from "@/lib/attendance";
import Participant from "@/models/Participant";

export const dynamic = "force-dynamic";

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
    const participant = await Participant.findByIdAndUpdate(
      participantId,
      { attendance },
      { new: true, runValidators: true }
    ).lean();
    if (!participant) return Response.json({ error: "Participant not found." }, { status: 404 });
    return Response.json({ participant: { ...participant, _id: String(participant._id) } });
  } catch (error) {
    return Response.json({ error: error.message || "Could not update attendance." }, { status: 500 });
  }
}
