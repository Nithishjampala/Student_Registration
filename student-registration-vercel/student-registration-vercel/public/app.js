
const form = document.getElementById("registrationForm");
const message = document.getElementById("message");
const submitButton = document.getElementById("submitButton");

const fields = [
  "college",
  "course",
  "year",
  "semester",
  "branch",
  "section"
];

const OTHER = "__OTHER__";
const NOT_APPLICABLE = "Not applicable";

let optionRows = [];

const selects = {};

fields.forEach(field => {
  selects[field] = document.getElementById(field);
});

// Normalize source values.
function normalize(value) {
  const text = String(value ?? "").trim();

  if (
    !text ||
    text.toLowerCase() === "n/a" ||
    text.toLowerCase() === "not applicable"
  ) {
    return "";
  }

  return text;
}

function unique(values) {
  return [...new Set(values)];
}

// Get the actual value selected by the student.
function getFinalValue(field) {
  const select = selects[field];

  if (!select || !select.value) return "";

  if (select.value === OTHER) {
    const input = document.getElementById(field + "Other");
    return input ? input.value.trim() : "";
  }

  if (select.value === NOT_APPLICABLE) {
    return NOT_APPLICABLE;
  }

  return select.value.trim();
}

// Filter rows using previous dropdown selections.
function getMatchingRows(fieldIndex) {
  return optionRows.filter(row => {

    for (let i = 0; i < fieldIndex; i++) {

      const field = fields[i];
      const selected = selects[field].value;

      if (!selected) return false;

      // Custom values do not restrict source rows.
      if (selected === OTHER) continue;

      // Not applicable matches blank source values.
      if (selected === NOT_APPLICABLE) {
        if (normalize(row[i]) !== "") return false;
        continue;
      }

      if (
        normalize(row[i]).toLowerCase() !==
        normalize(selected).toLowerCase()
      ) {
        return false;
      }
    }

    return true;
  });
}

// Reset a dropdown and its custom input.
function resetSelect(field, placeholder) {
  const select = selects[field];

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;

  select.appendChild(first);
  select.disabled = true;

  const input = document.getElementById(field + "Other");

  if (input) {
    input.value = "";
    input.required = false;
    input.classList.remove("visible");
  }
}

// Populate dropdown options.
function populateSelect(
  field,
  values,
  placeholder,
  allowNA = false
) {
  const select = selects[field];

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;

  select.appendChild(first);

  // Normal options.
  values.forEach(value => {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = value;

    select.appendChild(option);
  });

  // Not applicable for Course, Year, Semester, Branch and Section.
  if (allowNA) {
    const naOption = document.createElement("option");

    naOption.value = NOT_APPLICABLE;
    naOption.textContent = NOT_APPLICABLE;

    select.appendChild(naOption);
  }

  // Other for ALL six fields.
  const otherOption = document.createElement("option");

  otherOption.value = OTHER;
  otherOption.textContent = "Other";

  select.appendChild(otherOption);

  select.disabled = false;
}

// Update the next dropdown and reset dependent fields.
function updateField(index) {

  for (let i = index + 1; i < fields.length; i++) {
    resetSelect(fields[i], "Select " + fields[i]);
  }

  if (index >= fields.length - 1) return;

  const nextIndex = index + 1;
  const nextField = fields[nextIndex];

  const matchingRows = getMatchingRows(nextIndex);

  const values = unique(
    matchingRows
      .map(row => normalize(row[nextIndex]))
      .filter(Boolean)
  ).sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );

  populateSelect(
    nextField,
    values,
    "Select " + nextField,
    nextIndex >= 2
  );
}

// Show or hide the relevant Other input.
function handleOther(field) {

  const select = selects[field];
  const input = document.getElementById(field + "Other");

  const isOther = select.value === OTHER;

  input.classList.toggle("visible", isOther);
  input.required = isOther;

  if (!isOther) {
    input.value = "";
  }

  const index = fields.indexOf(field);

  // Refresh subsequent dropdowns.
  updateField(index);
}

// Attach events to all six dropdowns and Other inputs.
fields.forEach((field, index) => {

  const select = selects[field];
  const input = document.getElementById(field + "Other");

  select.addEventListener("change", () => {

    handleOther(field);

  });

  input.addEventListener("input", () => {

    // Keep subsequent dropdowns available for custom values.
    if (index < fields.length - 1) {
      updateField(index);
    }

  });

});

// Load academic options from options.json.
async function loadOptions() {

  try {

    const response = await fetch("/options.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Unable to load academic options.");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid options.json format.");
    }

    optionRows = data.filter(row =>
      Array.isArray(row) && row.length >= 6
    );

    if (optionRows.length === 0) {
      throw new Error("No academic options found.");
    }

    const colleges = unique(
      optionRows
        .map(row => normalize(row[0]))
        .filter(Boolean)
    ).sort();

    populateSelect(
      "college",
      colleges,
      "Select College",
      false
    );

  } catch (error) {

    console.error("Options loading error:", error);

    message.textContent = error.message;
    message.className = "error";

  }
}

// Validate the registration form.
function validateForm() {

  const mobile = document.getElementById("mobile").value.trim();

  if (!/^[6-9][0-9]{9}$/.test(mobile)) {
    throw new Error(
      "Enter a valid 10-digit Indian mobile number."
    );
  }

  for (const field of fields) {

    const select = selects[field];

    if (!select || !select.value) {
      throw new Error(
        "Please select the " + field + " field."
      );
    }

    // Other requires a custom value.
    if (select.value === OTHER) {

      const input = document.getElementById(field + "Other");

      if (!input || !input.value.trim()) {
        throw new Error(
          "Please enter your " + field + "."
        );
      }
    }

    // Not applicable is accepted.
  }

}

// Reset the form after successful submission.
function resetRegistrationForm() {

  form.reset();

  // Restore College options.
  const colleges = unique(
    optionRows
      .map(row => normalize(row[0]))
      .filter(Boolean)
  ).sort();

  populateSelect(
    "college",
    colleges,
    "Select College",
    false
  );

  // Reset remaining academic fields.
  for (let i = 1; i < fields.length; i++) {
    resetSelect(fields[i], "Select " + fields[i]);
  }

  // Hide and clear all Other inputs.
  fields.forEach(field => {

    const input = document.getElementById(field + "Other");

    input.value = "";
    input.required = false;
    input.classList.remove("visible");

  });

}

// Submit registration.
form.addEventListener("submit", async event => {

  event.preventDefault();

  message.textContent = "";
  message.className = "";

  try {

    validateForm();

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    const payload = {

      name: document.getElementById("name").value.trim(),

      rollNo: document.getElementById("rollNo").value.trim(),

      mobile: document.getElementById("mobile").value.trim(),

      email: document.getElementById("email").value.trim(),

      gender: document.getElementById("gender").value,

      college: getFinalValue("college"),

      course: getFinalValue("course"),

      year: getFinalValue("year"),

      semester: getFinalValue("semester"),

      branch: getFinalValue("branch"),

      section: getFinalValue("section")

    };

    const response = await fetch("/api/register", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)

    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Registration failed."
      );
    }

    message.textContent =
      "Registration submitted successfully!";

    message.className = "success";

    resetRegistrationForm();

  } catch (error) {

    console.error("Registration error:", error);

    message.textContent = error.message;
    message.className = "error";

  } finally {

    submitButton.disabled = false;
    submitButton.textContent = "Submit Registration";

  }

});

// Start application.
loadOptions();
