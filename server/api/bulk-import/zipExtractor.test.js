'use strict';

const AdmZip = require('adm-zip');
const { extractZip } = require('./zipExtractor');

const VALID_CSV = Buffer.from(
  'title,description,price,image_front,image_back,image_horizontal\n' +
    '"Dress","A dress","450.00","front.jpg","back.jpg","horizontal.jpg"\n'
);

/**
 * Build a ZIP Buffer from a plain object { entryName: content }.
 * Content can be a string or Buffer.
 */
function buildZip(files) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    const buf = typeof content === 'string' ? Buffer.from(content) : content;
    zip.addFile(name, buf);
  }
  return zip.toBuffer();
}

describe('extractZip — valid ZIPs (happy path)', () => {
  it('extracts csvBuffer and imageMap from a minimal valid ZIP', () => {
    const zipBuf = buildZip({
      'listings.csv': VALID_CSV,
      'front.jpg': Buffer.from('img1'),
    });

    const { csvBuffer, imageMap } = extractZip(zipBuf);

    expect(csvBuffer.toString()).toEqual(VALID_CSV.toString());
    expect(imageMap.size).toBe(1);
    expect(imageMap.has('front.jpg')).toBe(true);
  });

  it('uses basename as imageMap key for images inside subdirectories', () => {
    const zipBuf = buildZip({
      'listings.csv': VALID_CSV,
      'photos/front.jpg': Buffer.from('img1'),
      'photos/sub/back.jpg': Buffer.from('img2'),
    });

    const { imageMap } = extractZip(zipBuf);

    expect(imageMap.has('front.jpg')).toBe(true);
    expect(imageMap.has('back.jpg')).toBe(true);
    expect(imageMap.size).toBe(2);
  });

  it('handles CSV located in a subdirectory', () => {
    const zipBuf = buildZip({
      'data/listings.csv': VALID_CSV,
      'front.jpg': Buffer.from('img'),
    });

    const { csvBuffer } = extractZip(zipBuf);

    expect(csvBuffer.toString()).toEqual(VALID_CSV.toString());
  });

  it('succeeds with only a CSV and no images', () => {
    const zipBuf = buildZip({ 'listings.csv': VALID_CSV });

    const { csvBuffer, imageMap } = extractZip(zipBuf);

    expect(csvBuffer.length).toBeGreaterThan(0);
    expect(imageMap.size).toBe(0);
  });

  it('skips directory entries', () => {
    const zip = new AdmZip();
    zip.addFile('listings.csv', VALID_CSV);
    // Add a directory entry (empty buffer, name ends with /)
    zip.addFile('images/', Buffer.alloc(0));
    zip.addFile('images/front.jpg', Buffer.from('img'));
    const zipBuf = zip.toBuffer();

    const { imageMap } = extractZip(zipBuf);

    expect(imageMap.has('front.jpg')).toBe(true);
    expect(imageMap.size).toBe(1);
  });

  it('skips macOS __MACOSX metadata entries', () => {
    const zipBuf = buildZip({
      'listings.csv': VALID_CSV,
      'front.jpg': Buffer.from('img'),
      '__MACOSX/._front.jpg': Buffer.from('meta'),
      '__MACOSX/._listings.csv': Buffer.from('meta'),
    });

    const { imageMap } = extractZip(zipBuf);

    expect(imageMap.has('front.jpg')).toBe(true);
    expect(imageMap.has('._front.jpg')).toBe(false);
    expect(imageMap.size).toBe(1);
  });

  it('skips ._ resource fork files even outside __MACOSX', () => {
    const zipBuf = buildZip({
      'listings.csv': VALID_CSV,
      'front.jpg': Buffer.from('img'),
      '._front.jpg': Buffer.from('resource fork'),
    });

    const { imageMap } = extractZip(zipBuf);

    expect(imageMap.has('front.jpg')).toBe(true);
    expect(imageMap.has('._front.jpg')).toBe(false);
  });
});

describe('extractZip — Rule 1: invalid ZIP format', () => {
  it('throws on a corrupt/non-ZIP buffer', () => {
    expect(() => extractZip(Buffer.from('this is not a zip file'))).toThrow(
      /Invalid ZIP file/
    );
  });

  it('throws on an empty buffer', () => {
    expect(() => extractZip(Buffer.alloc(0))).toThrow(/Invalid ZIP file/);
  });
});

/**
 * adm-zip normalizes entry names when building ZIPs via addFile(), so we cannot
 * use buildZip() to create path-traversal entries. Instead we manually mutate the
 * entry name on the internal entry object after addFile(), before calling toBuffer().
 * This simulates a ZIP crafted by an attacker using a non-normalizing tool.
 */
function buildZipWithRawEntryName(entryName, data, extraFiles = {}) {
  const zip = new AdmZip();
  // Add a placeholder so we can get a real entry object to mutate
  zip.addFile('placeholder', data);
  const entry = zip.getEntries().find(e => e.entryName === 'placeholder');
  entry.entryName = entryName;

  for (const [name, content] of Object.entries(extraFiles)) {
    const buf = typeof content === 'string' ? Buffer.from(content) : content;
    zip.addFile(name, buf);
  }

  return zip.toBuffer();
}

describe('extractZip — Rule 2: path traversal', () => {
  it('throws when an entry name starts with ../', () => {
    const zipBuf = buildZipWithRawEntryName('../../../etc/passwd', Buffer.from('evil'), {
      'listings.csv': VALID_CSV,
    });

    expect(() => extractZip(zipBuf)).toThrow(/path traversal/);
  });

  it('throws when .. appears as a mid-path segment', () => {
    const zipBuf = buildZipWithRawEntryName(
      'images/../../../etc/passwd',
      Buffer.from('evil'),
      { 'listings.csv': VALID_CSV }
    );

    expect(() => extractZip(zipBuf)).toThrow(/path traversal/);
  });

  it('does NOT throw for filenames that contain two consecutive dots but are not a traversal segment (e.g. "v1..2.jpg")', () => {
    const zipBuf = buildZip({
      'listings.csv': VALID_CSV,
      'v1..2.jpg': Buffer.from('img'),
    });

    expect(() => extractZip(zipBuf)).not.toThrow();
  });
});

describe('extractZip — Rule 3: CSV count', () => {
  it('throws when ZIP contains no .csv file', () => {
    const zipBuf = buildZip({ 'front.jpg': Buffer.from('img') });

    expect(() => extractZip(zipBuf)).toThrow(/no .csv file/);
  });

  it('throws when ZIP contains two .csv files', () => {
    const zipBuf = buildZip({
      'a.csv': VALID_CSV,
      'b.csv': VALID_CSV,
      'front.jpg': Buffer.from('img'),
    });

    expect(() => extractZip(zipBuf)).toThrow(/2 .csv files/);
  });

  it('accepts a CSV with uppercase .CSV extension', () => {
    const zipBuf = buildZip({
      'LISTINGS.CSV': VALID_CSV,
      'front.jpg': Buffer.from('img'),
    });

    expect(() => extractZip(zipBuf)).not.toThrow();
  });
});

describe('extractZip — Rule 4: duplicate image basenames', () => {
  it('throws when two images share the same basename across different directories', () => {
    const zipBuf = buildZip({
      'listings.csv': VALID_CSV,
      'photos/front.jpg': Buffer.from('img1'),
      'other/front.jpg': Buffer.from('img2'),
    });

    expect(() => extractZip(zipBuf)).toThrow(/duplicate image filename "front.jpg"/);
  });

  it('does not throw when all image basenames are unique', () => {
    const zipBuf = buildZip({
      'listings.csv': VALID_CSV,
      'a/front.jpg': Buffer.from('img1'),
      'b/back.jpg': Buffer.from('img2'),
    });

    expect(() => extractZip(zipBuf)).not.toThrow();
  });
});

describe('extractZip — Rule 5: entry count limit', () => {
  it('throws when ZIP has more than 401 entries', () => {
    const files = { 'listings.csv': VALID_CSV };
    for (let i = 0; i < 401; i++) {
      files[`img${i}.jpg`] = Buffer.from(`img${i}`);
    }
    const zipBuf = buildZip(files); // 1 CSV + 401 images = 402

    expect(() => extractZip(zipBuf)).toThrow(/402 entries. Maximum allowed is 401/);
  });

  it('accepts exactly 401 entries (boundary)', () => {
    const files = { 'listings.csv': VALID_CSV };
    for (let i = 0; i < 400; i++) {
      files[`img${i}.jpg`] = Buffer.from(`img${i}`);
    }
    const zipBuf = buildZip(files); // 1 CSV + 400 images = 401

    const { imageMap } = extractZip(zipBuf);
    expect(imageMap.size).toBe(400);
  });
});

describe('extractZip — edge cases', () => {
  it('throws when the CSV entry inside the ZIP is empty (zero bytes)', () => {
    const zipBuf = buildZip({
      'listings.csv': Buffer.alloc(0),
      'front.jpg': Buffer.from('img'),
    });

    expect(() => extractZip(zipBuf)).toThrow(/CSV file inside the ZIP is empty/);
  });
});
