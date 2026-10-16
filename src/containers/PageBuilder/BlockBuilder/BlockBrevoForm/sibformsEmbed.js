// Turns the CMS content of a Brevo form block into a form URL the block may frame.
//
// Operators paste Brevo's iframe embed code (or just its URL) into the block's
// text. Only the `src` of the first <iframe> is kept: nothing else in the
// content is ever rendered, so a hosted asset cannot inject script or markup
// into the page. The URL must be an https Sibforms form (`*.sibforms.com/serve/…`),
// the same host family server/csp.js allows in `frame-src`.

const SIBFORMS_DOMAIN = 'sibforms.com';
const SIBFORMS_FORM_PATH = '/serve/';

const stripCodeFences = raw => {
  const fenceMatch = raw.match(/^```[\w]*\n?([\s\S]*?)```$/m);
  return fenceMatch ? fenceMatch[1].trim() : raw.trim();
};

const decodeAmpersands = value => value.replace(/&amp;/gi, '&');

const isSibformsHost = hostname => {
  const host = hostname.toLowerCase();
  return host === SIBFORMS_DOMAIN || host.endsWith(`.${SIBFORMS_DOMAIN}`);
};

/**
 * The Sibforms form URL in `raw` (iframe embed code or a bare URL), or null
 * when there is none or it is not an allowed Sibforms form URL.
 *
 * @param {string} raw block text content
 * @returns {string|null} normalized https URL
 */
export const getSibformsFormUrl = raw => {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const text = stripCodeFences(raw);

  const iframeSrc = text.match(/<iframe\b[^>]*?\ssrc\s*=\s*(["'])(.*?)\1/i);
  const candidate = decodeAmpersands(iframeSrc ? iframeSrc[2] : text).trim();

  let url;
  try {
    url = new URL(candidate);
  } catch (e) {
    return null;
  }

  const isAllowed =
    url.protocol === 'https:' &&
    isSibformsHost(url.hostname) &&
    !url.username &&
    !url.password &&
    !url.port &&
    url.pathname.startsWith(SIBFORMS_FORM_PATH);

  return isAllowed ? url.href : null;
};
