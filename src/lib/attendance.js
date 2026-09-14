import Team from "@/models/Team";
import mongoose from "mongoose";

export function serializeTeam(team) {
  const source = team.toObject ? team.toObject() : team;
  return {
    ...source,
    _id: String(source._id),
    members: (source.members || []).filter(Boolean).map((member, index) => ({
      ...member,
      _id: String(member._id),
      team_id: member.team_id ? String(member.team_id) : null,
      role: index === 0 ? "leader" : "member",
    })),
  };
}

export async function findTeamForQr(rawCode) {
  const [participantId, rawTeamId, ...extra] = String(rawCode || "").trim().split("|");
  if (!participantId || !/^\d{4}$/.test(rawTeamId || "") || extra.length) {
    return { error: "This QR code is not in the expected participant_id|team_id format." };
  }
  if (!mongoose.isValidObjectId(participantId)) {
    return { error: "The participant id in this QR code is invalid." };
  }

  // Verify the QR participant and load the roster in one aggregation query.
  const teams = await Team.aggregate([
    { $match: { id: Number(rawTeamId) } },
    {
      $lookup: {
        from: "ignithon-participants",
        localField: "members",
        foreignField: "_id",
        as: "members",
      },
    },
    {
      $addFields: {
        scannedMembers: {
          $filter: {
            input: "$members",
            as: "member",
            cond: {
              $and: [
                { $eq: ["$$member._id", new mongoose.Types.ObjectId(participantId)] },
                { $eq: ["$$member.team_id", "$_id"] },
              ],
            },
          },
        },
      },
    },
    { $match: { "scannedMembers.0": { $exists: true } } },
    { $project: { scannedMembers: 0 } },
  ]);
  if (!teams.length) return { error: "QR participant or team was not found." };
  const team = teams[0];
  const scanned = team.members.find((member) => String(member._id) === participantId);
  return { team: serializeTeam(team), scannedParticipantId: String(scanned._id) };
}

export async function searchTeams(term) {
  const safe = String(term || "").trim();
  if (!safe) return [];
  const escaped = safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escaped, "i");
  const idIsNumeric = /^\d{1,4}$/.test(safe) ? Number(safe) : -1;
  const memberTextMatch = {
    $anyElementTrue: {
      $map: {
        input: "$resolvedMembers",
        as: "member",
        in: {
          $or: ["name", "email", "roll_no", "phone"].map((field) => ({
            $regexMatch: {
              input: {
                $convert: {
                  input: { $ifNull: ["$$member." + field, ""] },
                  to: "string",
                  onError: "",
                  onNull: "",
                },
              },
              regex: escaped,
              options: "i",
            },
          })),
        },
      },
    },
  };
  const teams = await Team.aggregate([
    {
      $lookup: {
        from: "ignithon-participants",
        let: { roster: { $ifNull: ["$members", []] } },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $in: ["$_id", "$$roster"] },
                  {
                    $in: [
                      "$email",
                      {
                        $map: {
                          input: "$$roster",
                          as: "legacyMember",
                          in: "$$legacyMember.email",
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: "resolvedMembers",
      },
    },
    { $match: { $or: [{ name: match }, { id: idIsNumeric }, { $expr: memberTextMatch }] } },
    { $sort: { id: 1 } },
    { $limit: 12 },
  ]);
  return teams.map(({ resolvedMembers, ...team }) =>
    serializeTeam({ ...team, members: resolvedMembers }),
  );
}
