
const fields = [
  'college',
  'course',
  'year',
  'semester',
  'branch',
  'section'
];

const labels = [
  'College',
  'Course',
  'Year',
  'Semester',
  'Branch',
  'Section'
];

const NOT_APPLICABLE = 'Not applicable';

let optionRows = [];

const $ = id => document.getElementById(id);

const form = $('registrationForm');
const message = $('message');
const submitButton = $('submitButton');

// Remove duplicate values
function unique(values) {
  return [
    ...new Set(
      values
        .map(value => String(value ?? '').trim())
        .filter(value => value !== '')
    )
  ].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );
}

// Reset dependent dropdowns
function resetFrom(index) {
  for (let i = index; i < fields.length; i++) {
    const el = $(fields[i]);

    el.innerHTML =
      `<option value="">Select ${labels[i].toLowerCase()}</option>`;

    el.disabled = true;
  }
}

// Match rows based on previous selections
function rowsMatchingThrough(index) {
  return optionRows.filter(row => {
    return fields.slice(0, index).every((field, i) => {

      const selected = $(field).value;
      const sourceValue = String(row[i] ?? '').trim();

      if (selected === NOT_APPLICABLE) {
        return sourceValue === '';
      }

      return sourceValue === selected;
    });
  });
}

// Fill dropdown
function fillSelect(index, matchingRows) {
  const el = $(fields[index]);

  const values = unique(
    matchingRows.map(row =>
      String(row[index] ?? '').trim()
    )
  );

  el.innerHTML = '';

  // No available options: automatically select N/A
  if (values.length === 0) {

    const option = document.createElement('option');

    option.value = NOT_APPLICABLE;
    option.textContent = NOT_APPLICABLE;

    el.appendChild(option);

    el.value = NOT_APPLICABLE;
    el.disabled = true;

    return true;
  }

  // Normal dropdown options
  const placeholder = document.createElement('option');

  placeholder.value = '';
  placeholder.textContent =
    `Select ${labels[index].toLowerCase()}`;

  el.appendChild(placeholder);

  values.forEach(value => {

    const option = document.createElement('option');

    option.value = value;
    option.textContent = value;

    el.appendChild(option);

  });

  el.disabled = false;

  return false;
}

// Automatically process the next dropdown
function processNext(index) {

  if (index >= fields.length) {
    return;
  }

  const matchingRows = rowsMatchingThrough(index);

  const isNotApplicable = fillSelect(
    index,
    matchingRows
  );

  // Continue automatically if N/A
  if (isNotApplicable) {
    processNext(index + 1);
  }
}

// Load academic options
async function initialize() {

  try {

    const response = await fetch('/options.json');

    if (!response.ok) {
      throw new Error(
        'Could not load the college/course options.'
      );
    }

    optionRows = await response.json();

    if (!Array.isArray(optionRows) || optionRows.length === 0) {
      throw new Error('No academic options found.');
    }

    // Validate spreadsheet structure
    if (!optionRows.every(row =>
      Array.isArray(row) && row.length === fields.length
    )) {
      throw new Error(
        'Invalid options.json format. Each row must contain six academic fields.'
      );
    }

    fillSelect(0, optionRows);

  } catch (err) {

    showMessage(err.message, 'error');

  }
}

// Dropdown change events
fields.forEach((field, index) => {

  $(field).addEventListener('change', () => {

    // Clear all following dropdowns
    resetFrom(index + 1);

    if (!$(field).value) {
      return;
    }

    // Populate next field and continue N/A cascade
    processNext(index + 1);

  });

});

// Display status messages
function showMessage(text, type) {

  message.textContent = text;

  message.className = `message ${type}`;

}

// Validate academic selection
function validateAcademic(payload) {

  const academic = fields.map(field => {

    const value = String(payload[field] ?? '').trim();

    return value === NOT_APPLICABLE ? '' : value;

  });

  return optionRows.some(row => {

    return row.every((value, index) => {

      return String(value ?? '').trim() === academic[index];

    });

  });

}

// Form submission
form.addEventListener('submit', async event => {

  event.preventDefault();

  message.className = 'message';

  // Check required personal fields and visible academic fields
  if (!form.reportValidity()) {
    return;
  }

  // Collect normal form values
  const payload = Object.fromEntries(
    new FormData(form).entries()
  );

  // IMPORTANT:
  // FormData excludes disabled dropdowns.
  // Read every academic dropdown directly.
  fields.forEach(field => {

    payload[field] = $(field).value;

  });

  // Check academic combination
  if (!validateAcademic(payload)) {

    showMessage(
      'The selected academic combination is not present in the approved options. Please reselect your academic details.',
      'error'
    );

    return;
  }

  submitButton.disabled = true;

  submitButton.querySelector('span').textContent =
    'Submitting…';

  try {

    const response = await fetch('/api/register', {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify(payload)

    });

    const result = await response.json();

    if (!response.ok || !result.ok) {

      throw new Error(
        result.message || 'Submission failed.'
      );

    }

    // Reset form after successful submission
    form.reset();

    resetFrom(1);

    fillSelect(0, optionRows);

    showMessage(
      result.message ||
      'Registration submitted successfully.',
      'success'
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (err) {

    showMessage(
      err.message || 'Unable to submit. Please try again.',
      'error'
    );

  } finally {

    submitButton.disabled = false;

    submitButton.querySelector('span').textContent =
      'Submit Registration';

  }

});

// Initial setup
resetFrom(1);

initialize();
