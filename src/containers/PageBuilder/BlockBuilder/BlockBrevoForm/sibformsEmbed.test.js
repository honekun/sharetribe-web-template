import { getSibformsFormUrl } from './sibformsEmbed';

// The shape of the embed code in the live `contacto` page (token shortened).
const FORM_URL = 'https://0aed740b.sibforms.com/serve/MUIFAPHTGoxblxygKiPZd==';
const EMBED = `<iframe src="${FORM_URL}" frameborder="0" scrolling="auto" allowfullscreen style="display: block;margin-left: auto;margin-right: auto;max-width: 100%;"></iframe>`;

describe('getSibformsFormUrl', () => {
  it('extracts the form URL from Brevo iframe embed code', () => {
    expect(getSibformsFormUrl(EMBED)).toBe(FORM_URL);
  });

  it('accepts a bare form URL', () => {
    expect(getSibformsFormUrl(`  ${FORM_URL}\n`)).toBe(FORM_URL);
  });

  it('accepts embed code wrapped in a markdown code fence', () => {
    expect(getSibformsFormUrl('```html\n' + EMBED + '\n```')).toBe(FORM_URL);
  });

  it('accepts single-quoted src and HTML-escaped ampersands', () => {
    const url = 'https://abc.sibforms.com/serve/TOKEN?a=1&b=2';
    expect(getSibformsFormUrl(`<iframe width='540' src='${url.replace('&', '&amp;')}'>`)).toBe(url);
  });

  it('accepts the apex sibforms.com host', () => {
    expect(getSibformsFormUrl('https://sibforms.com/serve/TOKEN')).toBe(
      'https://sibforms.com/serve/TOKEN'
    );
  });

  it('uses the first iframe only', () => {
    const second = '<iframe src="https://evil.example/serve/x"></iframe>';
    expect(getSibformsFormUrl(EMBED + second)).toBe(FORM_URL);
  });

  it.each([
    ['plain http', 'http://abc.sibforms.com/serve/TOKEN'],
    ['another host', 'https://evil.example/serve/TOKEN'],
    ['a look-alike suffix', 'https://abc.sibforms.com.evil.example/serve/TOKEN'],
    ['a look-alike prefix', 'https://evilsibforms.com/serve/TOKEN'],
    ['credentials', 'https://user:pass@abc.sibforms.com/serve/TOKEN'],
    ['a port', 'https://abc.sibforms.com:8443/serve/TOKEN'],
    ['a non-form path', 'https://abc.sibforms.com/other/TOKEN'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
  ])('rejects %s', (_, url) => {
    expect(getSibformsFormUrl(`<iframe src="${url}"></iframe>`)).toBeNull();
    expect(getSibformsFormUrl(url)).toBeNull();
  });

  it('rejects inline Brevo embeds (scripts + markup)', () => {
    const inline =
      '<div id="sib-form-container"><form action="https://abc.sibforms.com/serve/TOKEN"></form></div>' +
      '<script src="https://sibforms.com/forms/end-form/build/main.js"></script>';
    expect(getSibformsFormUrl(inline)).toBeNull();
  });

  it.each([undefined, null, '', '   ', 42])('returns null for %p', value => {
    expect(getSibformsFormUrl(value)).toBeNull();
  });
});
