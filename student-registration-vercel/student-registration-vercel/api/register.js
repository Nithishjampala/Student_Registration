
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

  // Only POST requests are accepted.
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      success: false,
      message: "Method not allowed."
    });
  }

  try {

    // 1. Read environment variables.
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const worksheet = process.env.GOOGLE_WORKSHEET;
    const serviceAccountJson =
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    // 2. Identify missing environment variables.
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

    // 3. Read registration data.
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

    // 4. Validate required fields.
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

    for (let i = 0; i < values.length; i++) {

      if (!values[i]) {
        return sendJson(res, 400, {
          success: false,
          message: "Please provide " + fieldNames[i] + "."
        });
      }

    }

    // 5. Validate Indian mobile number.
    if (!/^[6-9][0-9]{9}$/.test(clean(mobile))) {
      return sendJson(res, 400, {
        success: false,
        message: "Invalid 10-digit Indian mobile number."
      });
    }

    // 6. Validate email.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(email))) {
      return sendJson(res, 400, {
        success: false,
        message: "Please enter a valid email address."
      });
    }

    // 7. Parse service account credentials.
    let credentials;

    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (error) {
      console.error("Service account JSON parsing failed.");

      return sendJson(res, 500, {
        success: false,
        message: "Invalid Google service account JSON configuration."
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

    // 8. Authenticate with Google Sheets.
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

    // 9. Check the spreadsheet and worksheet.
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId
    });

    const worksheetExists =
      spreadsheet.data.sheets?.some(
        sheet =>
          sheet.properties?.title === worksheet
      );

    if (!worksheetExists) {
      return sendJson(res, 400, {
        success: false,
        message:
          "Worksheet '" + worksheet + "' was not found. " +
          "Check GOOGLE_WORKSHEET."
      });
    }

    // 10. Check existing headers.
    const headerResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${worksheet.replace(/'/g, "''")}'!A1:L1`
      });

    const existingHeaders =
      headerResponse.data.values?.[0] || [];

    if (existingHeaders.length === 0) {

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${worksheet.replace(/'/g, "''")}'!A1:L1`,
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

    // 11. Prepare the registration row.
    const timestamp = new Date().toISOString();

    const row = [
      timestamp,
      ...values
    ];

    // 12. Save registration in Google Sheets.
    await sheets.spreadsheets.values.append({

      spreadsheetId,

      range: `'${worksheet.replace(/'/g, "''")}'!A:L`,

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

    // Log actual backend error in Vercel.
    console.error(
      "Registration error:",
      error.message,
      error.code || ""
    );

    // Keep internal details out of the public response.
    return sendJson(res, 500, {
      success: false,
      message:
        "Unable to submit registration. Please try again later."
    });

  }

};
