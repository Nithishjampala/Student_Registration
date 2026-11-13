const fields = ['college','course','year','semester','branch','section'];
const labels = ['College','Course','Year','Semester','Branch','Section'];
const NOT_APPLICABLE = 'Not applicable';
let optionRows = [];

const $ = id => document.getElementById(id);
const form = $('registrationForm');
const message = $('message');
const submitButton = $('submitButton');

function unique(values) {
  return [...new Set(values.filter(v => v !== ''))].sort((a,b) =>
    a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'})
  );
}

function resetFrom(index) {
  for (let i=index; i<fields.length; i++) {
    const el = $(fields[i]);
    el.innerHTML = `<option value="">Select ${labels[i].toLowerCase()}${i ? ' first' : ''}</option>`;
    el.disabled = true;
  }
}

function fillSelect(index, parentRows) {
  const el = $(fields[index]);
  const values = unique(parentRows.map(row => row[index]));
  const choices = values.length ? values : [NOT_APPLICABLE];
  el.innerHTML = `<option value="">Select ${labels[index].toLowerCase()}</option>`;
  choices.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    el.appendChild(option);
  });
  el.disabled = false;
}

function rowsMatchingThrough(index) {
  return optionRows.filter(row => fields.slice(0,index).every((field,i) =>
    row[i] === $(field).value
  ));
}

async function initialize() {
  try {
    const response = await fetch('/options.json');
    if (!response.ok) throw new Error('Could not load the college/course options.');
    optionRows = await response.json();
    fillSelect(0, optionRows);
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

fields.forEach((field,index) => {
  $(field).addEventListener('change', () => {
    resetFrom(index+1);
    if (!$(field).value) return;
    if (index < fields.length-1) {
      const matching = rowsMatchingThrough(index+1);
      fillSelect(index+1, matching.map(row => row.slice(index+1)).map((tail) => {
        const full = Array(fields.length).fill('');
        full.splice(index+1, tail.length, ...tail);
        return full;
      }));
    }
    // For a field whose next level has no values in the source, offer
    // "Not applicable" and continue the same cascade safely.
    if (index < fields.length-1 && $(fields[index+1]).options.length <= 1) {
      fillSelect(index+1, []);
    }
  });
});

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.className = 'message';
  if (!form.reportValidity()) return;

  const payload = Object.fromEntries(new FormData(form).entries());
  // Ensure the academic combination exists in the source data. Empty source
  // cells are represented by "Not applicable" in the visible form.
  const academic = fields.map(f => payload[f] === NOT_APPLICABLE ? '' : payload[f]);
  const valid = optionRows.some(row => row.every((v,i) => v === academic[i]));
  if (!valid) {
    showMessage('The selected academic combination is not present in the approved options. Please reselect your academic details.', 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Submitting…';
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || 'Submission failed.');
    form.reset();
    resetFrom(1);
    fillSelect(0, optionRows);
    showMessage(result.message || 'Registration submitted successfully.', 'success');
    window.scrollTo({top:0, behavior:'smooth'});
  } catch (err) {
    showMessage(err.message || 'Unable to submit. Please try again.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span').textContent = 'Submit Registration';
  }
});

resetFrom(1);
initialize();
