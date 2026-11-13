# Student Registration Website — Vercel + Google Sheets

This project creates a simple, mobile-friendly student registration website.

## Included form fields

**Personal details:** Name, Roll No, Mobile Number, Email ID, Gender.

**Dependent academic selections:** College → Course → Year → Semester → Branch → Section.

The academic options are taken from the uploaded `Google_Form_Options_Template.xlsx` workbook (the `Options` tab, 94 data rows). The form filters each next list using the exact preceding selections. Empty Semester/Branch/Section cells are shown as **Not applicable** where the source row has no value.

## 1. Create the Google response spreadsheet

1. Open Google Drive and create a new Google Sheet, for example `Student Registration Responses`.
2. Copy the spreadsheet ID from its URL. It is the text between `/d/` and `/edit`.
3. The website automatically creates the `Responses` tab and header row on the first successful submission.

## 2. Create a Google service account

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Google Cloud project.
3. Enable **Google Sheets API**.
4. Open **IAM & Admin → Service Accounts** and create a service account.
5. Create a JSON key and download it.
6. From the downloaded JSON file, copy `client_email` and `private_key`.
7. Share your response spreadsheet with the service account's `client_email` and give it **Editor** access.

Keep the JSON key private. Do not upload it to GitHub.

## 3. Upload the project to GitHub

1. Extract this ZIP file.
2. Create a new GitHub repository.
3. Upload all project files and folders (keep `api/` and `public/` in the root).
4. Commit the files.

## 4. Deploy to Vercel

1. Sign in at [Vercel](https://vercel.com/).
2. Select **Add New → Project** and import your GitHub repository.
3. Use the default project settings. No build command is needed.
4. Before deploying (or in Project → Settings → Environment Variables), add:

| Variable | Value |
|---|---|
| `GOOGLE_SHEET_ID` | ID of your response Google Sheet |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from service-account JSON |
| `GOOGLE_PRIVATE_KEY` | Full `private_key` value from service-account JSON |

For `GOOGLE_PRIVATE_KEY`, paste the complete key including
`-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. Vercel accepts
multiline values; if you store literal `\n` sequences, the API also converts
them to newline characters.

5. Select Production (and Preview/Development if needed), save, then deploy.
6. Open the generated `https://your-project.vercel.app` URL.

If you add or change environment variables after deployment, redeploy the project.

## 5. Test

1. Open the deployed URL.
2. Fill the personal details.
3. Select College and confirm Course options change.
4. Continue through Year, Semester, Branch and Section.
5. Submit a test registration.
6. Check the `Responses` tab in your Google Sheet.

## Project structure

```text
student-registration-vercel/
├── api/
│   └── register.js
├── public/
│   ├── app.js
│   ├── index.html
│   ├── options.json
│   └── styles.css
├── package.json
└── vercel.json
```

## Security notes

- Never put service-account credentials in `public/`, frontend JavaScript, or GitHub.
- Keep the Google Sheet shared only with people who need access.
- The API validates required fields, Indian mobile number format, email format,
  and the exact academic combination against the included options data.
- Add CAPTCHA/rate limiting before using the form for a large public audience.

## Updating academic options

Update the `Options` tab in the source workbook, export it again as JSON with
the same six columns (`College`, `Course`, `Year`, `Semester`, `Branch`,
`Section`), replace `public/options.json`, and redeploy.
