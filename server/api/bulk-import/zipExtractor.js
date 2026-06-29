'use strict';

const path = require('path');
const AdmZip = require('adm-zip');
const { matchesExtension } = require('./imageValidator');

const MAX_ENTRIES = 401; // 1 CSV + 400 images
const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB per image
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB total after decompression
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const getEntrySize = entry => entry?.header?.size || 0;

// Magic-byte check that the buffer matches its declared extension. Delegates to
// the shared imageValidator (see imageValidator.js); the length guard preserves
// the original fail-fast behaviour for truncated buffers.
const isAllowedImageBuffer = (buf, ext) => {
  if (!buf || buf.length < 4) return false;
  return matchesExtension(buf, ext);
};

const formatBytes = bytes => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

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
    throw new Error(
      'Archivo ZIP inválido: no se pudo leer el archivo. Asegúrate de que sea un .zip válido.'
    );
  }

  const entries = zip.getEntries();

  // Rule 5: Entry count limit (checked before iteration to fail fast)
  if (entries.length > MAX_ENTRIES) {
    throw new Error(
      `El ZIP contiene ${entries.length} entradas. El máximo permitido es ${MAX_ENTRIES} (1 CSV + 400 imágenes).`
    );
  }

  const csvEntries = [];
  const imageEntries = [];
  let totalUncompressedBytes = 0;

  for (const entry of entries) {
    const name = entry.entryName;

    // Skip directory entries
    if (entry.isDirectory) continue;

    // Skip macOS metadata entries created by Finder's "Compress" feature
    // (__MACOSX/* and ._* resource forks) and the .DS_Store files Finder drops
    // into any folder.
    const baseName = path.basename(name);
    if (name.startsWith('__MACOSX/') || baseName.startsWith('._') || baseName === '.DS_Store')
      continue;

    // Rule 2: Path traversal — per-segment check (allows "v1..2.jpg", blocks "../etc/passwd")
    const normalized = name.replace(/\\/g, '/');
    if (normalized.split('/').some(seg => seg === '..')) {
      throw new Error(
        `La entrada del ZIP "${name}" contiene una secuencia de salto de ruta (..). Vuelve a empaquetar el ZIP sin esas entradas.`
      );
    }

    const base = path.basename(normalized);
    const ext = path.extname(base).toLowerCase();
    const entrySize = getEntrySize(entry);

    totalUncompressedBytes += entrySize;
    if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error(
        `El tamaño descomprimido del ZIP supera ${formatBytes(MAX_UNCOMPRESSED_BYTES)}. ` +
          `Reduce la cantidad o el tamaño de los archivos y vuelve a subirlo.`
      );
    }

    if (ext === '.csv') {
      if (entrySize > MAX_CSV_BYTES) {
        throw new Error(
          `El archivo CSV "${base}" pesa ${formatBytes(
            entrySize
          )}. El tamaño máximo permitido para el CSV es ${formatBytes(MAX_CSV_BYTES)}.`
        );
      }
      csvEntries.push({ entry, base });
    } else {
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        throw new Error(
          `La entrada del ZIP "${name}" tiene un tipo de archivo no admitido "${ext ||
            'ninguno'}". ` + `Las imágenes deben ser .jpg, .jpeg, .png o .webp.`
        );
      }
      if (entrySize > MAX_IMAGE_BYTES) {
        throw new Error(
          `La imagen "${base}" pesa ${formatBytes(
            entrySize
          )}. El tamaño máximo permitido por imagen es ${formatBytes(MAX_IMAGE_BYTES)}.`
        );
      }
      imageEntries.push({ entry, base, ext });
    }
  }

  // Rule 3: Exactly one CSV file
  if (csvEntries.length === 0) {
    throw new Error(
      'El ZIP no contiene ningún archivo .csv. Incluye exactamente un archivo CSV (por ejemplo, listings.csv) en cualquier nivel del archivo.'
    );
  }
  if (csvEntries.length > 1) {
    const names = csvEntries.map(e => e.entry.entryName).join(', ');
    throw new Error(
      `El ZIP contiene ${csvEntries.length} archivos .csv (${names}). Incluye exactamente un archivo CSV.`
    );
  }

  // Rule 4: Duplicate image basenames across directories
  const seenBasenames = new Map(); // basename -> first full entry name
  for (const { entry, base } of imageEntries) {
    if (seenBasenames.has(base)) {
      throw new Error(
        `El ZIP contiene un nombre de imagen duplicado "${base}" (encontrado en "${seenBasenames.get(
          base
        )}" y "${entry.entryName}"). ` +
          `Todos los nombres de imagen deben ser únicos sin importar la carpeta.`
      );
    }
    seenBasenames.set(base, entry.entryName);
  }

  // Extract CSV buffer
  let csvBuffer;
  try {
    csvBuffer = csvEntries[0].entry.getData();
  } catch (err) {
    throw new Error(`No se pudo leer el archivo CSV del ZIP: ${err.message}`);
  }
  if (!csvBuffer || csvBuffer.length === 0) {
    throw new Error('El archivo CSV dentro del ZIP está vacío.');
  }
  if (csvBuffer.length > MAX_CSV_BYTES) {
    throw new Error(
      `El archivo CSV "${csvEntries[0].base}" se expande a ${formatBytes(
        csvBuffer.length
      )}. El tamaño máximo permitido para el CSV es ${formatBytes(MAX_CSV_BYTES)}.`
    );
  }

  // Build imageMap: basename → Buffer
  // path.basename() ensures "photos/dress_front.jpg" maps to key "dress_front.jpg",
  // matching how the CSV image_* columns reference images (filename only, no path).
  const imageMap = new Map();
  for (const { entry, base, ext } of imageEntries) {
    let buf;
    try {
      buf = entry.getData();
    } catch (err) {
      throw new Error(`No se pudo leer la imagen "${base}" del ZIP: ${err.message}`);
    }
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new Error(
        `La imagen "${base}" se expande a ${formatBytes(
          buf.length
        )}. El tamaño máximo permitido por imagen es ${formatBytes(MAX_IMAGE_BYTES)}.`
      );
    }
    if (!isAllowedImageBuffer(buf, ext)) {
      throw new Error(
        `La imagen "${base}" no coincide con su extensión de archivo o no es un tipo de imagen admitido. ` +
          `Usa archivos .jpg, .jpeg, .png o .webp.`
      );
    }
    imageMap.set(base, buf);
  }

  return { csvBuffer, imageMap };
}

module.exports = {
  extractZip,
  MAX_CSV_BYTES,
  MAX_IMAGE_BYTES,
  MAX_UNCOMPRESSED_BYTES,
  ALLOWED_IMAGE_EXTENSIONS,
};
