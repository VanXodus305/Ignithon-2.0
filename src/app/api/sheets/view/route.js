export async function GET() {
  const url = process.env.GOOGLE_SHEETS_URL;
  if (!url) return Response.json({ error: "Google Sheets URL is not configured." }, { status: 500 });
  return Response.redirect(url);
}
