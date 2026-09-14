import mongoose from "mongoose";

const ParticipantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    is_kiit_student: { type: Boolean, default: false },
    roll_no: { type: String, trim: true },
    hostel: { type: String, trim: true },
    phone: { type: String, trim: true },
    branch: { type: String, trim: true },
    year: { type: Number },
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    attendance: { type: Boolean, default: false },
    status: { type: String, default: "ACTIVE" },
  },
  { timestamps: true, collection: "ignithon-participants" },
);

ParticipantSchema.index({ name: 1, roll_no: 1, phone: 1 });

export default mongoose.models.Participant ||
  mongoose.model("Participant", ParticipantSchema);
