/**
 * Compare the hosted (Console) configuration of two Sharetribe environments.
 *
 * Usage:
 *   node scripts/compare-hosted-config.js <baseClientId> <targetClientId>
 *   yarn run config:compare <baseClientId> <targetClientId>
 *
 * Reads the same public assets the app loads (Asset Delivery API, public client
 * IDs only — no secrets) from both environments and prints every difference, so
 * a Live marketplace can be checked against Test after it is configured by hand.
 * Read-only. Exits 1 when anything differs or an asset cannot be read.
 */
const sharetribeSdk = require('sharetribe-flex-sdk');

// Assets the app reads (configDefault.js `appCdnAssets`) plus the content pages the
// footer and top bar link to. Add a page here when Console gains a new linked one.
const ASSET_PATHS = [
  '/transactions/commission.json',
  '/transactions/minimum-transaction-size.json',
  '/general/localization.json',
  '/users/user-types.json',
  '/users/user-fields.json',
  '/listings/listing-types.json',
  '/listings/listing-fields.json',
  '/listings/listing-categories.json',
  '/listings/listing-search.json',
  '/design/layout.json',
  '/design/branding.json',
  '/content/top-bar.json',
  '/content/footer.json',
  '/content/translations.json',
  '/content/email-texts.json',
  '/content/pages/landing-page.json',
  '/content/pages/terms-of-service.json',
  '/content/pages/privacy-policy.json',
  '/content/pages/acerca-archivo-vintach.json',
  '/content/pages/como-funciona.json',
  '/content/pages/como-vender-persona.json',
  '/content/pages/contacto.json',
  '/content/pages/faqs.json',
];

const MAX_DIFFS_PER_ASSET = 15;

const fetchAsset = (sdk, path) =>
  sdk
    .assetByAlias({ path, alias: 'latest' })
    .then(res => ({ data: res.data.data }))
    .catch(e => ({ error: e.status === 404 ? 'missing' : `error ${e.status || e.message}` }));

// Flatten to { 'a.b[0].c': value } so two documents can be compared key by key.
const flatten = (value, prefix = '', out = {}) => {
  if (Array.isArray(value)) {
    if (value.length === 0) out[prefix] = '[]';
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) out[prefix] = '{}';
    keys.forEach(k => flatten(value[k], prefix ? `${prefix}.${k}` : k, out));
  } else {
    out[prefix] = value;
  }
  return out;
};

const diffAssets = (base, target) => {
  const a = flatten(base);
  const b = flatten(target);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys
    .filter(k => a[k] !== b[k])
    .map(k => {
      if (!(k in b)) return `only in base:   ${k} = ${JSON.stringify(a[k])}`;
      if (!(k in a)) return `only in target: ${k} = ${JSON.stringify(b[k])}`;
      return `differs:        ${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`;
    });
};

const run = async (baseClientId, targetClientId) => {
  const base = sharetribeSdk.createInstance({ clientId: baseClientId });
  const target = sharetribeSdk.createInstance({ clientId: targetClientId });
  let problems = 0;

  for (const path of ASSET_PATHS) {
    const [a, b] = await Promise.all([fetchAsset(base, path), fetchAsset(target, path)]);
    if (a.error || b.error) {
      if (a.error === 'missing' && b.error === 'missing') {
        console.log(`  same     ${path} (absent in both)`);
        continue;
      }
      problems += 1;
      console.log(`✗ ${path}: base ${a.error || 'ok'}, target ${b.error || 'ok'}`);
      continue;
    }
    const diffs = diffAssets(a.data, b.data);
    if (diffs.length === 0) {
      console.log(`  same     ${path}`);
      continue;
    }
    problems += 1;
    console.log(`✗ ${path}: ${diffs.length} difference(s)`);
    diffs.slice(0, MAX_DIFFS_PER_ASSET).forEach(d => console.log(`    ${d}`));
    if (diffs.length > MAX_DIFFS_PER_ASSET) {
      console.log(`    … ${diffs.length - MAX_DIFFS_PER_ASSET} more`);
    }
  }

  console.log(
    problems === 0
      ? '\nAll compared assets match.'
      : `\n${problems} asset(s) differ. Branding image URLs and page listing/user IDs are expected to differ between environments.`
  );
  return problems;
};

if (require.main === module) {
  const [baseClientId, targetClientId] = process.argv.slice(2);
  if (!baseClientId || !targetClientId) {
    console.error('Usage: node scripts/compare-hosted-config.js <baseClientId> <targetClientId>');
    process.exit(2);
  }
  run(baseClientId, targetClientId)
    .then(problems => process.exit(problems === 0 ? 0 : 1))
    .catch(e => {
      console.error(e);
      process.exit(2);
    });
}

module.exports = { ASSET_PATHS, diffAssets, flatten };
