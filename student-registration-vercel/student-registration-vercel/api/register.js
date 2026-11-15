
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

    // STEP 1: Read environment variables.

    const spreadsheetId =
      process.env.SPREADSHEET_ID?.trim();

    const worksheet =
      process.env.GOOGLE_WORKSHEET?.trim();

    const serviceAccountJson =
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

    // STEP 2: Diagnose environment variables.

    const configurationStatus = {
      SPREADSHEET_ID: Boolean(spreadsheetId),
      GOOGLE_WORKSHEET: Boolean(worksheet),
      GOOGLE_SERVICE_ACCOUNT_JSON: Boolean(serviceAccountJson),
      VERCEL_ENV: process.env.VERCEL_ENV || "unknown"
    };

    console.log(
      "Google Sheets configuration status:",
      configurationStatus
    );

    const missingVariables = [];

    if (!spreadsheetId) {
      missingVariables.push("SPREADSHEET_ID");
    }

    if (!worksheet) {
      missingVariables.push("GOOGLE_WORKSHEET");
    }

    if (!serviceAccountJson) {
      missingVariables.push("GOOGLE_SERVICE_ACCOUNT_JSON");
    }

    if (missingVariables.length > 0) {

      console.error(
        "Missing environment variables:",
        missingVariables
      );

      return sendJson(res, 500, {
        success: false,
        message:
          "Server configuration error. Missing: " +
          missingVariables.join(", ")
      });
    }

    // STEP 3: Read registration data.

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

    // STEP 4: Validate required fields.

    for (let i = 0; i < values.length; i++) {

      if (!values[i]) {
        return sendJson(res, 400, {
          success: false,
          message: "Please provide " + fieldNames[i] + "."
        });
      }

    }

    // STEP 5: Validate mobile number.

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

    // STEP 7: Parse Google service account JSON.

    let credentials;

    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (error) {

      console.error("Google credentials JSON is invalid.");

      return sendJson(res, 500, {
        success: false,
        message: "Google service account JSON is invalid."
      });

    }

    if (
      credentials.type !== "service_account" ||
      !credentials.client_email ||
      !credentials.private_key
    ) {

      return sendJson(res, 500, {
        success: false,
        message: "Google service account credentials are incomplete."
      });

    }

    // STEP 8: Authenticate with Google.

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

    // STEP 9: Check spreadsheet access.

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId
    });

    // STEP 10: Check worksheet.

    const worksheetExists =
      spreadsheet.data.sheets?.some(
        sheet =>
          sheet.properties?.title === worksheet
      );

    if (!worksheetExists) {

      return sendJson(res, 400, {
        success: false,
        message:
          "Worksheet '" + worksheet +
          "' was not found. Check GOOGLE_WORKSHEET."
      });

    }

    const safeWorksheet =
      "'" + worksheet.replace(/'/g, "''") + "'";

    // STEP 11: Check Google Sheet headers.

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
          message:
            "Google Sheet headers do not match the required column order."
        });

      }

    }

    // STEP 12: Prepare registration data.

    const timestamp = new Date().toISOString();

    const row = [
      timestamp,
      ...values
    ];

    // STEP 13: Append data to Google Sheets.

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

    // Log detailed error only in Vercel.
    console.error("Registration error:", {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      details: error.response?.data?.error?.message
    });

    return sendJson(res, 500, {
      success: false,
      message:
        "Unable to submit registration. Please try again later."
    });

  }

};
