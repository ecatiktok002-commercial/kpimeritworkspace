const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'page.tsx');
const newViewPath = path.join(__dirname, 'new_manager_view.txt');

console.log('Reading files...');
let pageContent = fs.readFileSync(pagePath, 'utf8');
const newViewContent = fs.readFileSync(newViewPath, 'utf8');

// Find start anchor
const startStr = '      {authProfile?.is_manager && (';
const startIndex = pageContent.indexOf(startStr);
if (startIndex === -1) {
  console.error('Error: Could not find start anchor in page.tsx');
  process.exit(1);
}

console.log('Found start anchor at index:', startIndex);

// Find end anchor
// We want to find the next "      )}" that is followed by the staff view comment
const endMarker = '      {/* ──────────────────────────────────────────────────────────────────────────────────────────────────────────\r\n          MAIN WORKSPACE CANVAS (STAFF VIEW)';
const endMarkerUnix = '      {/* ──────────────────────────────────────────────────────────────────────────────────────────────────────────\n          MAIN WORKSPACE CANVAS (STAFF VIEW)';

let endMarkerIndex = pageContent.indexOf(endMarker);
if (endMarkerIndex === -1) {
  endMarkerIndex = pageContent.indexOf(endMarkerUnix);
}

if (endMarkerIndex === -1) {
  console.error('Error: Could not find staff view comment anchor in page.tsx');
  process.exit(1);
}

console.log('Found staff view comment at index:', endMarkerIndex);

// Let's find the closing "      )}" right before that comment
const searchSubstring = pageContent.substring(startIndex, endMarkerIndex);
const lastClosingBraceOffset = searchSubstring.lastIndexOf('      )}');

if (lastClosingBraceOffset === -1) {
  console.error('Error: Could not find matching closing brace within range');
  process.exit(1);
}

const endIndex = startIndex + lastClosingBraceOffset + '      )}'.length;
console.log('Found closing brace at index:', endIndex);

// Perform replacement
const updatedPageContent = pageContent.substring(0, startIndex) + newViewContent + pageContent.substring(endIndex);

console.log('Writing updated page.tsx...');
fs.writeFileSync(pagePath, updatedPageContent, 'utf8');
console.log('Replacement completed successfully!');
