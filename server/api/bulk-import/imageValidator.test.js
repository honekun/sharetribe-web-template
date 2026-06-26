'use strict';

const { isSupportedImageBuffer, matchesExtension } = require('./imageValidator');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WEBP'),
  Buffer.alloc(4),
]);

describe('isSupportedImageBuffer', () => {
  it('accepts JPEG, PNG, and WebP magic bytes', () => {
    expect(isSupportedImageBuffer(JPEG)).toBe(true);
    expect(isSupportedImageBuffer(PNG)).toBe(true);
    expect(isSupportedImageBuffer(WEBP)).toBe(true);
  });

  it('rejects executables, HTML, and empty buffers', () => {
    expect(isSupportedImageBuffer(Buffer.from('MZ\x90\x00'))).toBe(false);
    expect(isSupportedImageBuffer(Buffer.from('<html><script>'))).toBe(false);
    expect(isSupportedImageBuffer(Buffer.alloc(0))).toBe(false);
  });

  it('rejects non-buffers', () => {
    expect(isSupportedImageBuffer(null)).toBe(false);
    expect(isSupportedImageBuffer('RIFF....WEBP')).toBe(false);
  });
});

describe('matchesExtension', () => {
  it('matches a buffer to its declared extension', () => {
    expect(matchesExtension(JPEG, '.jpg')).toBe(true);
    expect(matchesExtension(JPEG, '.JPEG')).toBe(true);
    expect(matchesExtension(PNG, '.png')).toBe(true);
    expect(matchesExtension(WEBP, '.webp')).toBe(true);
  });

  it('rejects a buffer whose magic bytes do not match the extension', () => {
    expect(matchesExtension(JPEG, '.png')).toBe(false);
    expect(matchesExtension(PNG, '.webp')).toBe(false);
  });

  it('rejects unknown extensions', () => {
    expect(matchesExtension(JPEG, '.gif')).toBe(false);
    expect(matchesExtension(JPEG, '')).toBe(false);
  });
});
