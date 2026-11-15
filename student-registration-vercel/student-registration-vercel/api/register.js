
const { google } = require("googleapis");

const HEADERS = [
  "Timestamp",
  "Name",
  "Roll No",
  "Mobile Number",
  "Email ID",
  "Gender",
  "College",
  "Course",
  "Year",
  "Semester",
  "Branch",
  "Section"
];

// Your existing Google Sheet tab name
const WORKSHEET = process.env.GOOGLE_WORKSHEET || "Responses";

function sendJson(res, status, data) {
  return res.status(status).json(data);
}

function clean(value) {
  return String(value ?? "").trim();
}

module.exports = async (req, res) => {

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      success: false,
      message: "Method not allowed."
    });
  }

  try {

    // STEP 1: Read your EXISTING Vercel variables.

    const spreadsheetId =
      process.env.GOOGLE_SHEET_ID?.trim();

    const clientEmail =
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();

    const privateKey =
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

    // STEP 2: Check configuration.

    console.log("Google Sheets configuration:", {
      GOOGLE_SHEET_ID: Boolean(spreadsheetId),
      GOOGLE_SERVICE_ACCOUNT_EMAIL: Boolean(clientEmail),
      GOOGLE_PRIVATE_KEY: Boolean(privateKey),
      WORKSHEET: WORKSHEET,
      VERCEL_ENV: process.env.VERCEL_ENV || "unknown"
    });

    const missing = [];

    if (!spreadsheetId) {
      missing.push("GOOGLE_SHEET_ID");
    }

    if (!clientEmail) {
      missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    }

    if (!privateKey) {
      missing.push("GOOGLE_PRIVATE_KEY");
    }

    if (missing.length > 0) {
      console.error("Missing variables:", missing);

      return sendJson(res, 500, {
        success: false,
        message: "Missing Vercel variables: " + missing.join(", ")
      });
    }

    // STEP 3: Read registration details.

    const {
      name,
      rollNo,
      mobile,
      email,
      gender,
      college,
      course,
      year,
      semester,
      branch,
      section
    } = req.body || {};

    const values = [
      clean(name),
      clean(rollNo),
      clean(mobile),
      clean(email),
      clean(gender),
      clean(college),
      clean(course),
      clean(year),
      clean(semester),
      clean(branch),
      clean(section)
    ];

    const fieldNames = [
      "Name",
      "Roll Number",
      "Mobile Number",
      "Email ID",
      "Gender",
      "College",
      "Course",
      "Year",
      "Semester",
      "Branch",
      "Section"
    ];

    // STEP 4: Validate fields.

    for (let i = 0; i < values.length; i++) {
      if (!values[i]) {
        return sendJson(res, 400, {
          success: false,
          message: "Please provide " + fieldNames[i] + "."
        });
      }
    }

    // STEP 5: Validate Indian mobile number.

    if (!/^[6-9][0-9]{9}$/.test(clean(mobile))) {
      return sendJson(res, 400, {
        success: false,
        message: "Invalid 10-digit Indian mobile number."
      });
    }

    // STEP 6: Validate email.

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(email))) {
      return sendJson(res, 400, {
        success: false,
        message: "Please enter a valid email address."
      });
    }

    // STEP 7: Build Google service account credentials
    // using your existing three environment variables.

    const credentials = {
      type: "service_account",
      client_email: clientEmail,
      private_key: privateKey,
      token_uri: "https://oauth2.googleapis.com/token"
    };

    // STEP 8: Authenticate with Google Sheets.

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets"
      ]
    });

    const client = await auth.getClient();

    const sheets = google.sheets({
      version: "v4",
      auth: client
    });

    // STEP 9: Verify spreadsheet access.

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId
    });

    const worksheetExists =
      spreadsheet.data.sheets?.some(
        sheet => sheet.properties?.title === WORKSHEET
      );

    if (!worksheetExists) {
      return sendJson(res, 400, {
        success: false,
        message: "Worksheet '" + WORKSHEET + "' not found."
      });
    }

    const safeWorksheet =
      "'" + WORKSHEET.replace(/'/g, "''") + "'";

    // STEP 10: Verify headers.

    const headerResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${safeWorksheet}!A1:L1`
      });

    const existingHeaders =
      headerResponse.data.values?.[0] || [];

    if (existingHeaders.length === 0) {

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${safeWorksheet}!A1:L1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [HEADERS]
        }
      });

    } else {

      const headersMatch = HEADERS.every(
        (header, index) =>
          existingHeaders[index] === header
      );

      if (!headersMatch) {
        return sendJson(res, 500, {
          success: false,
          message: "Google Sheet headers do not match."
        });
      }
    }

    // STEP 11: Prepare the row.

    const row = [
      new Date().toISOString(),
      ...values
    ];

    // STEP 12: Save registration.

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${safeWorksheet}!A:L`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row]
      }
    });

    console.log("Registration saved successfully.");

    return sendJson(res, 200, {
      success: true,
      message: "Registration completed successfully."
    });

  } catch (error) {

    console.error("Registration error:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      details: error.response?.data?.error?.message
    });

    return sendJson(res, 500, {
      success: false,
      message: "Unable to submit registration. Please try again later."
    });
  }
};
