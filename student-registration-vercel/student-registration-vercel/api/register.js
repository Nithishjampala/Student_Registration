const { google } = require('googleapis');
const optionRows = require('../public/options.json');

const HEADERS = [
  'Timestamp', 'Name', 'Roll No', 'Mobile Number', 'Email ID', 'Gender',
  'College', 'Course', 'Year', 'Semester', 'Branch', 'Section'
];

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return res.status(status).json(body);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return json(res, 405, {
      ok: false,
      message: 'Method not allowed'
    });
  }

  try {
    const {
      name, rollNo, mobile, email, gender,
      college, course, year, semester, branch, section
    } = req.body || {};

    const fields = [
      name, rollNo, mobile, email, gender,
      college, course, year, semester, branch, section
    ];

    if (fields.some(v => typeof v !== 'string' || !v.trim())) {
      return json(res, 400, {
        ok: false,
        message: 'Please complete all fields.'
      });
    }

    if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
      return json(res, 400, {
        ok: false,
        message: 'Enter a valid 10-digit Indian mobile number.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return json(res, 400, {
        ok: false,
        message: 'Enter a valid email address.'
      });
    }

    const submittedAcademic = [
      college, course, year, semester, branch, section
    ].map(value =>
      value === 'Not applicable' ? '' : value
    );

    const isApprovedCombination = optionRows.some(row =>
      row.every((value, index) =>
        value === submittedAcademic[index]
      )
    );

    if (!isApprovedCombination) {
      return json(res, 400, {
        ok: false,
        message: 'The selected academic combination is not valid.'
      });
    }

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

    if (!sheetId || !clientEmail || !privateKey) {
      return json(res, 500, {
        ok: false,
        message: 'Google Sheets integration is not configured. Check Vercel environment variables.'
      });
    }

    // Normalize the Google service-account private key.
    privateKey = privateKey
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets'
      ]
    });

    const sheets = google.sheets({
      version: 'v4',
      auth
    });

    // Check whether the Responses header row exists.
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "'Responses'!A1:L1"
    });

    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "'Responses'!A1:L1",
        valueInputOption: 'RAW',
        requestBody: {
          values: [HEADERS]
        }
      });
    }

    // Append the student registration.
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "'Responses'!A:L",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          new Date().toISOString(),
          name.trim(),
          rollNo.trim(),
          mobile.trim(),
          email.trim(),
          gender,
          college,
          course,
          year,
          semester,
          branch,
          section
        ]]
      }
    });

    return json(res, 200, {
      ok: true,
      message: 'Registration submitted successfully.'
    });

  } catch (error) {
    console.error('Registration error:', error);

    return json(res, 500, {
      ok: false,
      message: 'Could not save your registration. Please check the server logs.',
      error: error.message
    });
  }
};
