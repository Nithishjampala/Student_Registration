
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

const otherFields = [
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

function getSelectedValue(field) {
  const select = selects[field];

  if (select.value === OTHER) {
    return normalize(
      document.getElementById(field + "Other").value
    );
  }

  return normalize(select.value);
}

function getMatchingRows(fieldIndex) {
  return optionRows.filter(row => {
    for (let i = 0; i < fieldIndex; i++) {
      const field = fields[i];
      const selected = getSelectedValue(field);

      if (!selected) return false;

      // A custom value does not match the source list.
      // Keep subsequent dropdowns available rather than blocking the form.
      if (selects[field].value === OTHER) continue;

      if (normalize(row[i]).toLowerCase() !== selected.toLowerCase()) {
        return false;
      }
    }

    return true;
  });
}

function resetSelect(field, placeholder) {
  const select = selects[field];

  select.innerHTML = "";

  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;

  select.appendChild(option);
  select.disabled = true;

  const otherInput = document.getElementById(field + "Other");

  if (otherInput) {
    otherInput.value = "";
    otherInput.classList.remove("visible");
    otherInput.required = false;
  }
}

function populateSelect(field, values, placeholder, allowNA = false) {
  const select = selects[field];

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (allowNA && !values.includes(NOT_APPLICABLE)) {
    const option = document.createElement("option");
    option.value = NOT_APPLICABLE;
    option.textContent = NOT_APPLICABLE;
    select.appendChild(option);
  }

  if (field !== "college") {
    const otherOption = document.createElement("option");
    otherOption.value = OTHER;
    otherOption.textContent = "Other";
    select.appendChild(otherOption);
  }

  select.disabled = false;
}

function updateField(index) {
  const field = fields[index];

  // Reset all dependent fields.
  for (let i = index + 1; i < fields.length; i++) {
    resetSelect(fields[i], "Select " + fields[i]);
  }

  if (index >= fields.length - 1) return;

  const nextField = fields[index + 1];
  const matchingRows = getMatchingRows(index + 1);

  const values = unique(
    matchingRows
      .map(row => normalize(row[index + 1]))
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base"
  }));

  populateSelect(
    nextField,
    values,
    "Select " + nextField,
    index + 1 >= 3
  );
}

function handleOther(field) {
  const select = selects[field];
  const input = document.getElementById(field + "Other");

  const isOther = select.value === OTHER;

  input.classList.toggle("visible", isOther);
  input.required = isOther;
  input.value = "";

  const index = fields.indexOf(field);

  if (index >= 0 && index < fields.length - 1) {
    updateField(index);
  }
}

fields.forEach((field, index) => {
  selects[field].addEventListener("change", () => {
    if (field !== "college") {
      handleOther(field);
    }

    updateField(index);
  });

  const otherInput = document.getElementById(field + "Other");

  if (otherInput) {
    otherInput.addEventListener("input", () => {
      // Refresh subsequent dropdowns when a custom value is entered.
      updateField(index);
    });
  }
});

async function loadOptions() {
  try {
    const response = await fetch("/options.json");

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

    if (!optionRows.length) {
      throw new Error("No academic options found.");
    }

    const colleges = unique(
      optionRows.map(row => normalize(row[0])).filter(Boolean)
    ).sort();

    populateSelect("college", colleges, "Select College");

  } catch (error) {
    console.error(error);
    message.textContent = error.message;
    message.className = "error";
  }
}

function getFinalValue(field) {
  const select = selects[field];

  if (select.value === OTHER) {
    return normalize(
      document.getElementById(field + "Other").value
    );
  }

  return normalize(select.value);
}

function validateForm() {
  const mobile = document.getElementById("mobile").value.trim();

  if (!/^[6-9][0-9]{9}$/.test(mobile)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }

  for (const field of fields) {
    const value = getFinalValue(field);

    if (!value) {
      throw new Error("Please complete the " + field + " field.");
    }
  }
}

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
      throw new Error(result.message || "Registration failed.");
    }

    message.textContent = "Registration submitted successfully!";
    message.className = "success";

    form.reset();

    fields.forEach((field, index) => {
      if (index > 0) {
        resetSelect(field, "Select " + field);
      }
    });

    // Reset custom input visibility.
    otherFields.forEach(field => {
      const input = document.getElementById(field + "Other");
      input.classList.remove("visible");
      input.required = false;
      input.value = "";
    });

  } catch (error) {
    message.textContent = error.message;
    message.className = "error";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Registration";
  }
});

loadOptions();
