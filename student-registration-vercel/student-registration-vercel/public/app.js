
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

function unique(values) {
  return [...new Set(
    values
      .map(v => String(v ?? '').trim())
      .filter(v => v !== '')
  )].sort((a, b) =>
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

// Find rows matching previous selections
function rowsMatchingThrough(index) {
  return optionRows.filter(row =>
    fields.slice(0, index).every((field, i) => {
      const selected = $(field).value;

      const sourceValue = String(row[i] ?? '').trim();

      return selected === NOT_APPLICABLE
        ? sourceValue === ''
        : sourceValue === selected;
    })
  );
}

// Fill dropdown and automatically select N/A when needed
function fillSelect(index, matchingRows) {
  const el = $(fields[index]);

  const values = unique(
    matchingRows.map(row =>
      String(row[index] ?? '').trim()
    )
  );

  el.innerHTML = '';

  // No applicable options: automatically select N/A
  if (values.length === 0) {
    const option = document.createElement('option');

    option.value = NOT_APPLICABLE;
    option.textContent = NOT_APPLICABLE;

    el.appendChild(option);

    el.value = NOT_APPLICABLE;
    el.disabled = true;

    return true;
  }

  // Add normal selection option
  const placeholder = document.createElement('option');

  placeholder.value = '';
  placeholder.textContent =
    `Select ${labels[index].toLowerCase()}`;

  el.appendChild(placeholder);

  // Add available choices
  values.forEach(value => {
    const option = document.createElement('option');

    option.value = value;
    option.textContent = value;

    el.appendChild(option);
  });

  el.disabled = false;

  return false;
}

// Automatically process N/A fields
function processNext(index) {
  if (index >= fields.length) return;

  const matchingRows = rowsMatchingThrough(index);

  const isNA = fillSelect(index, matchingRows);

  if (isNA) {
    processNext(index + 1);
  }
}

// Load options
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

    fillSelect(0, optionRows);

  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// Dropdown change events
fields.forEach((field, index) => {

  $(field).addEventListener('change', () => {

    // Reset all following fields
    resetFrom(index + 1);

    if (!$(field).value) return;

    // Continue the dependent dropdown sequence
    processNext(index + 1);

  });

});

// Display messages
function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
}

// Form submission
form.addEventListener('submit', async event => {

  event.preventDefault();

  message.className = 'message';

  if (!form.reportValidity()) return;

  const payload = Object.fromEntries(
    new FormData(form).entries()
  );

  // Convert visible N/A values back to empty source values
  const academic = fields.map(field =>
    payload[field] === NOT_APPLICABLE
      ? ''
      : payload[field]
  );

  // Validate the complete academic combination
  const valid = optionRows.some(row =>
    row.every((value, index) =>
      String(value ?? '').trim() === academic[index]
    )
  );

  if (!valid) {
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

    form.reset();

    resetFrom(1);

    fillSelect(0, optionRows);

    showMessage(
      result.message || 'Registration submitted successfully.',
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
