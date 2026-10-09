'use strict';

// Bundled fallback image for bulk-imported rows that reference no photo at all.
// Images are optional in the CSV (see csvParser); a row with every image column
// blank is imported with this asset as its single image.
//
// To change the artwork, replace the file in ./assets keeping the basename
// `bulk-import-placeholder` — any of the supported extensions is accepted, and the
// bytes are checked against the extension because the Integration SDK infers the
// upload's MIME type from the filename.

const fs = require('fs');
const path = require('path');

const { matchesExtension } = require('./imageValidator');

const ASSETS_DIR = path.join(__dirname, 'assets');
const PLACEHOLDER_BASENAME = 'bulk-import-placeholder';
const CANDIDATE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Read once per process: the asset never changes at runtime and every image-less
// row of every job uploads the same bytes.
let cached = null;

function placeholderError(message, avCode) {
  const err = new Error(message);
  err.avCode = avCode; // stable code the client maps to a translated message
  return err;
}

/**
 * Load the bundled placeholder image.
 *
 * @returns {{ buffer: Buffer, filename: string }} the asset bytes and its filename
 *   (the extension drives the MIME type of the Integration SDK upload).
 * @throws {Error} with `avCode: 'placeholder-missing'` when no asset file is
 *   bundled, or `avCode: 'placeholder-invalid'` when its bytes do not match its
 *   extension. Both fail the individual row rather than the whole job.
 */
function getPlaceholderImage() {
  if (cached) return cached;

  const filename = CANDIDATE_EXTENSIONS.map(ext => `${PLACEHOLDER_BASENAME}${ext}`).find(name =>
    fs.existsSync(path.join(ASSETS_DIR, name))
  );
  if (!filename) {
    throw placeholderError(
      `No se encontró la imagen de reemplazo en ${ASSETS_DIR} (${PLACEHOLDER_BASENAME}${CANDIDATE_EXTENSIONS.join(
        '/'
      )}).`,
      'placeholder-missing'
    );
  }

  const buffer = fs.readFileSync(path.join(ASSETS_DIR, filename));
  if (!matchesExtension(buffer, path.extname(filename))) {
    throw placeholderError(
      `La imagen de reemplazo "${filename}" no coincide con su extensión de archivo.`,
      'placeholder-invalid'
    );
  }

  cached = { buffer, filename };
  return cached;
}

module.exports = { getPlaceholderImage };
module.exports._test = {
  resetCache: () => {
    cached = null;
  },
  ASSETS_DIR,
  PLACEHOLDER_BASENAME,
};
