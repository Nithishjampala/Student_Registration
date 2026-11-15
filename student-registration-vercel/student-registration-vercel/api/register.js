
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
  res.status(status).json(data);
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

    if (values.some(value => !value)) {
      return sendJson(res, 400, {
        success: false,
        message: "Please complete all required fields."
      });
    }

    if (!/^[6-9][0-9]{9}$/.test(clean(mobile))) {
      return sendJson(res, 400, {
        success: false,
        message: "Invalid mobile number."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(email))) {
      return sendJson(res, 400, {
        success: false,
        message: "Invalid email address."
      });
    }

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const worksheet = process.env.GOOGLE_WORKSHEET;
    const serviceAccountJson =
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!spreadsheetId || !worksheet || !serviceAccountJson) {
      throw new Error("Google Sheets environment variables are missing.");
    }

    const credentials = JSON.parse(serviceAccountJson);

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

    // Check whether the first row contains the expected headers.
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${worksheet}!A1:L1`
    });

    const existingHeaders = headerResponse.data.values?.[0] || [];

    if (existingHeaders.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${worksheet}!A1:L1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [HEADERS]
        }
      });
    } else if (
      HEADERS.some((header, index) =>
        existingHeaders[index] !== header
      )
    ) {
      throw new Error(
        "Google Sheet headers do not match the expected column order."
      );
    }

    const timestamp = new Date().toISOString();

    const row = [
      timestamp,
      ...values
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${worksheet}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row]
      }
    });

    return sendJson(res, 200, {
      success: true,
      message: "Registration completed successfully."
    });

  } catch (error) {
    console.error("Registration error:", error);

    return sendJson(res, 500, {
      success: false,
      message: "Unable to submit registration. Please try again later."
    });
  }
};
