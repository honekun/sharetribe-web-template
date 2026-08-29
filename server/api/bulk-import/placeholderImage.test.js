'use strict';

const fs = require('fs');
const path = require('path');

const { matchesExtension } = require('./imageValidator');
const { getPlaceholderImage, _test } = require('./placeholderImage');

describe('getPlaceholderImage', () => {
  afterEach(() => {
    _test.resetCache();
    jest.restoreAllMocks();
  });

  it('returns the bundled placeholder asset shipped in the repo', () => {
    const { buffer, filename } = getPlaceholderImage();

    expect(buffer.length).toBeGreaterThan(0);
    expect(filename).toMatch(/^bulk-import-placeholder\.(jpg|jpeg|png|webp)$/);
    // The asset's bytes must really be the image type its extension claims, since
    // the Integration SDK infers the upload's MIME type from the file extension.
    expect(matchesExtension(buffer, path.extname(filename))).toBe(true);
  });

  it('reads the asset from disk only once and serves the cache afterwards', () => {
    getPlaceholderImage();
    const readSpy = jest.spyOn(fs, 'readFileSync');

    const second = getPlaceholderImage();

    expect(readSpy).not.toHaveBeenCalled();
    expect(second.buffer.length).toBeGreaterThan(0);
  });

  it('throws a placeholder-missing error when no asset file exists', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() => getPlaceholderImage()).toThrow(
      expect.objectContaining({ avCode: 'placeholder-missing' })
    );
  });

  it('throws a placeholder-invalid error when the asset bytes do not match its extension', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('not an image at all'));

    expect(() => getPlaceholderImage()).toThrow(
      expect.objectContaining({ avCode: 'placeholder-invalid' })
    );
  });
});
