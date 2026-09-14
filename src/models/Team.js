import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, min: 1000, max: 9999 },
    name: { type: String, required: true, trim: true },
    // Order is intentional: members[0] is always the team leader.
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Participant" }],
    points: { type: Number, default: 0 },
    room: { type: String, enum: ["A", "B", "C"], default: null },
    room_sequence: { type: Number, default: null, min: 1 },
  },
  { timestamps: true, collection: "ignithon-teams" },
);

export default mongoose.models.Team || mongoose.model("Team", TeamSchema);
