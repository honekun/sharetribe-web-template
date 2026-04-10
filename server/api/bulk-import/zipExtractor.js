'use strict';

const path = require('path');
const AdmZip = require('adm-zip');

const MAX_ENTRIES = 401; // 1 CSV + 400 images

/**
 * Validate and extract a ZIP buffer containing one CSV file and image files.
 *
 * @param {Buffer} buffer - Raw ZIP file bytes from multer memoryStorage
 * @returns {{ csvBuffer: Buffer, imageMap: Map<string, Buffer> }}
 * @throws {Error} with a descriptive message on any validation failure
 */
function extractZip(buffer) {
  // Rule 1: Valid ZIP format
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    throw new Error('Invalid ZIP file: could not parse archive. Ensure the file is a valid .zip.');
  }

  const entries = zip.getEntries();

  // Rule 5: Entry count limit (checked before iteration to fail fast)
  if (entries.length > MAX_ENTRIES) {
    throw new Error(
      `ZIP contains ${entries.length} entries. Maximum allowed is ${MAX_ENTRIES} (1 CSV + 400 images).`
    );
  }

  const csvEntries = [];
  const imageEntries = [];

  for (const entry of entries) {
    const name = entry.entryName;

    // Skip directory entries
    if (entry.isDirectory) continue;

    // Skip macOS metadata entries created by Finder's "Compress" feature
    if (name.startsWith('__MACOSX/') || path.basename(name).startsWith('._')) continue;

    // Rule 2: Path traversal — per-segment check (allows "v1..2.jpg", blocks "../etc/passwd")
    const normalized = name.replace(/\\/g, '/');
    if (normalized.split('/').some(seg => seg === '..')) {
      throw new Error(
        `ZIP entry "${name}" contains a path traversal sequence (..). Repackage the ZIP without such entries.`
      );
    }

    const base = path.basename(normalized);
    const ext = path.extname(base).toLowerCase();

    if (ext === '.csv') {
      csvEntries.push({ entry, base });
    } else {
      imageEntries.push({ entry, base });
    }
  }

  // Rule 3: Exactly one CSV file
  if (csvEntries.length === 0) {
    throw new Error(
      'ZIP contains no .csv file. Include exactly one CSV file (e.g. listings.csv) at any level inside the archive.'
    );
  }
  if (csvEntries.length > 1) {
    const names = csvEntries.map(e => e.entry.entryName).join(', ');
    throw new Error(
      `ZIP contains ${csvEntries.length} .csv files (${names}). Include exactly one CSV file.`
    );
  }

  // Rule 4: Duplicate image basenames across directories
  const seenBasenames = new Map(); // basename -> first full entry name
  for (const { entry, base } of imageEntries) {
    if (seenBasenames.has(base)) {
      throw new Error(
        `ZIP contains duplicate image filename "${base}" (found at "${seenBasenames.get(base)}" and "${entry.entryName}"). ` +
          `All image filenames must be unique regardless of directory.`
      );
    }
    seenBasenames.set(base, entry.entryName);
  }

  // Extract CSV buffer
  let csvBuffer;
  try {
    csvBuffer = csvEntries[0].entry.getData();
  } catch (err) {
    throw new Error(`Failed to read CSV file from ZIP: ${err.message}`);
  }
  if (!csvBuffer || csvBuffer.length === 0) {
    throw new Error('The CSV file inside the ZIP is empty.');
  }

  // Build imageMap: basename → Buffer
  // path.basename() ensures "photos/dress_front.jpg" maps to key "dress_front.jpg",
  // matching how the CSV image_* columns reference images (filename only, no path).
  const imageMap = new Map();
  for (const { entry, base } of imageEntries) {
    let buf;
    try {
      buf = entry.getData();
    } catch (err) {
      throw new Error(`Failed to read image "${base}" from ZIP: ${err.message}`);
    }
    imageMap.set(base, buf);
  }

  return { csvBuffer, imageMap };
}

module.exports = { extractZip };
