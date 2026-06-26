'use strict';

// Magic-byte ("sniffing") image validation. Confirms a buffer really is the image
// type it claims to be — defends against renamed executables/HTML/etc. uploaded as
// .jpg. Shared by the ZIP extractor (extension-coupled check) and any caller that
// just needs "is this a supported image at all".

const isJpeg = buf =>
  Buffer.isBuffer(buf) && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

const isPng = buf =>
  Buffer.isBuffer(buf) &&
  buf.length >= 8 &&
  buf[0] === 0x89 &&
  buf[1] === 0x50 &&
  buf[2] === 0x4e &&
  buf[3] === 0x47 &&
  buf[4] === 0x0d &&
  buf[5] === 0x0a &&
  buf[6] === 0x1a &&
  buf[7] === 0x0a;

const isWebp = buf =>
  Buffer.isBuffer(buf) &&
  buf.length >= 12 &&
  buf.slice(0, 4).toString('ascii') === 'RIFF' &&
  buf.slice(8, 12).toString('ascii') === 'WEBP';

// True when the buffer's magic bytes are any supported image type (JPEG/PNG/WebP).
const isSupportedImageBuffer = buf => isJpeg(buf) || isPng(buf) || isWebp(buf);

// True when the buffer's magic bytes match the given file extension. Used by the
// ZIP extractor so a file named "x.jpg" must actually be a JPEG.
const matchesExtension = (buf, ext) => {
  const e = String(ext || '').toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return isJpeg(buf);
  if (e === '.png') return isPng(buf);
  if (e === '.webp') return isWebp(buf);
  return false;
};

module.exports = { isSupportedImageBuffer, matchesExtension, isJpeg, isPng, isWebp };
