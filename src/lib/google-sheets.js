import { google } from "googleapis";
import connectMongo from "@/lib/mongodb";
import Participant from "@/models/Participant";
import Team from "@/models/Team";

const rooms = ["A", "B", "C"];
const roomHeaders = ["Sequence #", "Team ID", "Team name", "Name", "Email", "Phone", "Roll no.", "Hostel", "Branch", "Year", "Attendance"];
const directoryHeaders = ["Team ID", "Team name", "Name", "Email", "Phone", "Roll no.", "Hostel", "Branch", "Year"];
const branches = ["Aerospace Engineering", "BCA", "Biotech", "Chemical Engineering", "Civil Engineering", "Computer Science & Communication Engineering", "Computer Science & Engineering", "Computer Science & Systems Engineering", "Computer Science and Engineering with specialization Artificial Intelligence", "Computer Science and Engineering with specialization Artificial Intelligence and Machine Learning", "Computer Science and Engineering with specialization Cyber Security", "Computer Science and Engineering with specialization Data Science", "Computer Science and Engineering with specialization Internet of Things", "Computer Science and Engineering with specialization Internet of Things and Cyber Security Including Block Chain Technology", "Construction Technology", "Electrical and Computer Engineering", "Electrical Engineering", "Electronics & Electrical Engineering", "Electronics & Tele-Communication Engineering", "Electronics and Computer Science Engineering", "Electronics and Instrumentation", "Electronics Engineering VLSI Design and Technology", "Information Technology", "Law", "MCA", "Mechanical Engineering", "Mechanical Engineering (Automobile)", "Mechatronics Engineering", "Others"];
const years = ["1st", "2nd", "3rd", "4th", "5th"];
const colors = { forest: { red: 0.05, green: 0.31, blue: 0.25 }, mint: { red: 0.9, green: 0.97, blue: 0.92 }, gold: { red: 1, green: 0.83, blue: 0.35 }, present: { red: 0.2, green: 0.67, blue: 0.42 }, absent: { red: 0.86, green: 0.31, blue: 0.36 } };
const branchColors = [
  { red: 0.13, green: 0.45, blue: 0.65 }, { red: 0.35, green: 0.28, blue: 0.68 },
  { red: 0.61, green: 0.24, blue: 0.57 }, { red: 0.74, green: 0.32, blue: 0.2 },
  { red: 0.06, green: 0.48, blue: 0.38 }, { red: 0.14, green: 0.5, blue: 0.58 },
];

function client() {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!encoded || !spreadsheetId) throw new Error("Google Sheets is not configured.");
  const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

function membersRows(team, includeRoom, directoryRows, directoryTeamRows) {
  return (team.members.length ? team.members : [{}]).map((member, index) => {
    const year = member.year ? `${member.year}${member.year === 1 ? "st" : member.year === 2 ? "nd" : member.year === 3 ? "rd" : "th"}` : "";
    const common = [member.name || "", member.email || "", member.phone || "", member.roll_no || "", member.hostel || "", member.branch || "", year];
    if (!includeRoom) return [index === 0 ? String(team.id) : "", index === 0 ? team.name : "", ...common];

    const memberRow = directoryRows.get(String(member._id));
    const teamRow = directoryTeamRows.get(String(team._id));
    const participantReferences = memberRow
      ? ["C", "D", "E", "F", "G", "H", "I"].map((column) => `='Registered Teams'!${column}${memberRow}`)
      : common;
    return [
      index === 0 ? String(team._sheetSequence || team.room_sequence || "") : "",
      index === 0 && teamRow ? `='Registered Teams'!A${teamRow}` : "",
      index === 0 && teamRow ? `='Registered Teams'!B${teamRow}` : "",
      ...participantReferences,
      member.attendance ? "Present" : "Absent",
    ];
  });
}

async function ensureTabs(sheets, spreadsheetId) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const existing = new Map((spreadsheet.data.sheets || []).map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));
  const titles = [...rooms.map((room) => "Room " + room), "Registered Teams"];
  const missing = titles.filter((title) => !existing.has(title));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) } });
    const refreshed = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    for (const sheet of refreshed.data.sheets || []) existing.set(sheet.properties.title, sheet.properties.sheetId);
  }
  return existing;
}

function validation(sheetId, startColumnIndex, endRowIndex, values) {
  return { setDataValidation: { range: { sheetId, startRowIndex: 1, endRowIndex: Math.max(endRowIndex, 2), startColumnIndex, endColumnIndex: startColumnIndex + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: values.map((value) => ({ userEnteredValue: value })) }, showCustomUi: true, strict: true } } };
}

function conditional(sheetId, column, text, color) {
  return {
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: column, endColumnIndex: column + 1 }],
        booleanRule: {
          condition: { type: "TEXT_EQ", values: [{ userEnteredValue: text }] },
          format: { backgroundColor: color, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } },
        },
      },
      index: 0,
    },
  };
}

function branchConditionals(sheetId, column) {
  return branches.map((branch, index) => conditional(sheetId, column, branch, branchColors[index % branchColors.length]));
}

function peopleChip(sheetId, rowIndex, columnIndex, email) {
  const normalizedEmail = String(email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return null;
  return {
    updateCells: {
      start: { sheetId, rowIndex, columnIndex },
      rows: [{ values: [{ userEnteredValue: { stringValue: "@" }, chipRuns: [{ startIndex: 0, chip: { personProperties: { email: normalizedEmail } } }] }] }],
      fields: "userEnteredValue,chipRuns",
    },
  };
}

function verticalColumnBorders(sheetId, columnCount, rowCount) {
  const color = { red: 0.28, green: 0.5, blue: 0.42 };
  return Array.from({ length: columnCount }, (_, column) => ({
    updateBorders: {
      range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: column, endColumnIndex: column + 1 },
      left: { style: "SOLID_MEDIUM", color },
      right: { style: "SOLID_MEDIUM", color },
    },
  }));
}

function clearVerticalColumnBorders(sheetId, columnCount, startRowIndex) {
  if (startRowIndex >= 1000) return [];
  return Array.from({ length: columnCount }, (_, column) => ({
    updateBorders: {
      range: { sheetId, startRowIndex, endRowIndex: 1000, startColumnIndex: column, endColumnIndex: column + 1 },
      left: { style: "NONE" },
      right: { style: "NONE" },
    },
  }));
}

function teamBoundary(sheetId, rowIndex, columnCount) {
  const border = { style: "SOLID_MEDIUM", color: { red: 0.16, green: 0.46, blue: 0.35 } };
  return [
    { updateBorders: { range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: columnCount }, bottom: border } },
    { updateBorders: { range: { sheetId, startRowIndex: rowIndex + 1, endRowIndex: rowIndex + 2, startColumnIndex: 0, endColumnIndex: columnCount }, top: border } },
  ];
}

function formatSheet(sheetId, columnCount, rowCount, frozenColumnCount, headerColor = colors.forest) {
  const formattedRowCount = Math.max(rowCount, 2);
  return [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount } }, fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: formattedRowCount, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { verticalAlignment: "MIDDLE", horizontalAlignment: "CENTER", textFormat: { fontFamily: "Lexend", fontSize: 10 }, wrapStrategy: "CLIP", borders: { top: { style: "SOLID", color: { red: 0.78, green: 0.86, blue: 0.81 } }, bottom: { style: "SOLID", color: { red: 0.78, green: 0.86, blue: 0.81 } }, left: { style: "SOLID_MEDIUM", color: { red: 0.28, green: 0.5, blue: 0.42 } }, right: { style: "SOLID_MEDIUM", color: { red: 0.28, green: 0.5, blue: 0.42 } } } } }, fields: "userEnteredFormat(verticalAlignment,horizontalAlignment,textFormat.fontFamily,textFormat.fontSize,wrapStrategy,borders)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: headerColor, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontFamily: "Lexend" }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" } },
    ...verticalColumnBorders(sheetId, columnCount, formattedRowCount),
    ...clearVerticalColumnBorders(sheetId, columnCount, formattedRowCount),
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: formattedRowCount, startColumnIndex: 0, endColumnIndex: columnCount } } } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columnCount } } },
  ];
}

export async function syncGoogleSheet() {
  const { sheets, spreadsheetId } = client();
  await connectMongo();
  const teams = await Team.find({}).populate("members").lean();
  const sequenceFixes = [];
  for (const room of rooms) {
    const inRoom = teams.filter((team) => team.room === room).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const used = new Set(inRoom.map((team) => team.room_sequence).filter(Boolean));
    let next = 1;
    for (const team of inRoom) {
      if (!team.room_sequence) {
        while (used.has(next)) next += 1;
        team.room_sequence = next;
        sequenceFixes.push({ updateOne: { filter: { _id: team._id }, update: { $set: { room_sequence: next } } } });
        used.add(next);
      }
      team._sheetSequence = team.room_sequence;
    }
  }
  if (sequenceFixes.length) await Team.bulkWrite(sequenceFixes);
  const tabs = await ensureTabs(sheets, spreadsheetId);
  const tabNames = [...rooms.map((room) => "Room " + room), "Registered Teams"];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: tabNames.map((title) => ({ unmergeCells: { range: { sheetId: tabs.get(title) } } })) } });
  await Promise.all(tabNames.map((title) => sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${title}'` })));

  const data = [];
  const requests = [];
  const peopleChips = [];
  const directoryTeams = [...teams].sort((a, b) => a.id - b.id);
  const directoryRows = new Map();
  const directoryTeamRows = new Map();
  let directoryCursor = 1;
  for (const team of directoryTeams) {
    const memberCount = Math.max(team.members.length, 1);
    directoryTeamRows.set(String(team._id), directoryCursor + 1);
    team.members.forEach((member, index) => directoryRows.set(String(member._id), directoryCursor + index + 1));
    directoryCursor += memberCount;
  }
  for (const room of rooms) {
    const title = "Room " + room;
    const sheetId = tabs.get(title);
    const roomTeams = teams.filter((team) => team.room === room).sort((a, b) => (a.room_sequence || 0) - (b.room_sequence || 0));
    const rows = [roomHeaders];
    const decorations = [];
    let cursor = 1;
    for (const team of roomTeams) {
      const block = membersRows(team, true, directoryRows, directoryTeamRows);
      rows.push(...block);
      if (block.length > 1) for (let column = 0; column < 3; column += 1) requests.push({ mergeCells: { range: { sheetId, startRowIndex: cursor, endRowIndex: cursor + block.length, startColumnIndex: column, endColumnIndex: column + 1 }, mergeType: "MERGE_ALL" } });
      decorations.push({ repeatCell: { range: { sheetId, startRowIndex: cursor, endRowIndex: cursor + 1, startColumnIndex: 0, endColumnIndex: roomHeaders.length }, cell: { userEnteredFormat: { backgroundColor: colors.mint, textFormat: { bold: true }, verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat.bold,verticalAlignment)" } });
      decorations.push({ repeatCell: { range: { sheetId, startRowIndex: cursor, endRowIndex: cursor + block.length, startColumnIndex: 1, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.05, green: 0.32, blue: 0.22 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, verticalAlignment: "MIDDLE", horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat(backgroundColor,textFormat.foregroundColor,textFormat.bold,verticalAlignment,horizontalAlignment)" } });
      decorations.push({ repeatCell: { range: { sheetId, startRowIndex: cursor, endRowIndex: cursor + block.length, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.72, green: 0.9, blue: 0.78 }, textFormat: { bold: true }, verticalAlignment: "MIDDLE", horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat(backgroundColor,textFormat.bold,verticalAlignment,horizontalAlignment)" } }, ...teamBoundary(sheetId, cursor + block.length - 1, roomHeaders.length));
      cursor += block.length;
    }
    data.push({ range: `'${title}'!A1`, values: rows });
    requests.push(...formatSheet(sheetId, roomHeaders.length, cursor, 3), validation(sheetId, 8, cursor, branches), validation(sheetId, 9, cursor, years), validation(sheetId, 10, cursor, ["Present", "Absent"]), ...branchConditionals(sheetId, 8), conditional(sheetId, 9, "1st", { red: 0.23, green: 0.58, blue: 0.82 }), conditional(sheetId, 9, "2nd", { red: 0.39, green: 0.36, blue: 0.78 }), conditional(sheetId, 9, "3rd", { red: 0.69, green: 0.29, blue: 0.66 }), conditional(sheetId, 9, "4th", { red: 0.9, green: 0.45, blue: 0.2 }), conditional(sheetId, 9, "5th", { red: 0.09, green: 0.48, blue: 0.38 }), conditional(sheetId, 10, "Present", colors.present), conditional(sheetId, 10, "Absent", colors.absent), ...decorations);
  }

  const directoryId = tabs.get("Registered Teams");
  const rows = [directoryHeaders];
  let cursor = 1;
  const directoryDecorations = [];
  for (const team of directoryTeams) {
    const block = membersRows(team, false);
    rows.push(...block);
    if (block.length > 1) for (let column = 0; column < 2; column += 1) requests.push({ mergeCells: { range: { sheetId: directoryId, startRowIndex: cursor, endRowIndex: cursor + block.length, startColumnIndex: column, endColumnIndex: column + 1 }, mergeType: "MERGE_ALL" } });
    directoryDecorations.push({ repeatCell: { range: { sheetId: directoryId, startRowIndex: cursor, endRowIndex: cursor + 1, startColumnIndex: 0, endColumnIndex: directoryHeaders.length }, cell: { userEnteredFormat: { backgroundColor: colors.mint, textFormat: { bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat.bold)" } });
    directoryDecorations.push({ repeatCell: { range: { sheetId: directoryId, startRowIndex: cursor, endRowIndex: cursor + block.length, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.05, green: 0.32, blue: 0.22 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, verticalAlignment: "MIDDLE", horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat(backgroundColor,textFormat.foregroundColor,textFormat.bold,verticalAlignment,horizontalAlignment)" } });
    directoryDecorations.push({ repeatCell: { range: { sheetId: directoryId, startRowIndex: cursor, endRowIndex: cursor + block.length, startColumnIndex: 1, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.72, green: 0.9, blue: 0.78 }, textFormat: { bold: true } } }, fields: "userEnteredFormat(backgroundColor,textFormat.bold)" } }, ...teamBoundary(directoryId, cursor + block.length - 1, directoryHeaders.length));
    block.forEach((_, index) => peopleChips.push(peopleChip(directoryId, cursor + index, 3, team.members[index]?.email)));
    cursor += block.length;
  }
  data.push({ range: "'Registered Teams'!A1", values: rows });
  requests.push(...formatSheet(directoryId, directoryHeaders.length, cursor, 2, { red: 0.1, green: 0.29, blue: 0.42 }), validation(directoryId, 7, cursor, branches), validation(directoryId, 8, cursor, years), ...branchConditionals(directoryId, 7), conditional(directoryId, 8, "1st", { red: 0.23, green: 0.58, blue: 0.82 }), conditional(directoryId, 8, "2nd", { red: 0.39, green: 0.36, blue: 0.78 }), conditional(directoryId, 8, "3rd", { red: 0.69, green: 0.29, blue: 0.66 }), conditional(directoryId, 8, "4th", { red: 0.9, green: 0.45, blue: 0.2 }), conditional(directoryId, 8, "5th", { red: 0.09, green: 0.48, blue: 0.38 }), ...directoryDecorations);
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data } });
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [...requests, ...peopleChips.filter(Boolean)] } });
  return { rooms: rooms.length, teams: teams.length };
}

export async function syncGoogleSheetSafely() {
  try { await syncGoogleSheet(); } catch (error) { console.error("Google Sheets sync failed:", error.message); }
}
