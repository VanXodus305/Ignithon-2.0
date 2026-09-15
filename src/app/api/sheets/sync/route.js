import { syncGoogleSheet } from "@/lib/google-sheets";

export async function POST() {
  try {
    return Response.json({ success: true, ...(await syncGoogleSheet()) });
  } catch (error) {
    return Response.json({ error: error.message || "Could not sync Google Sheets." }, { status: 500 });
  }
}
