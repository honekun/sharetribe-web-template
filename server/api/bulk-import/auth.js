'use strict';

const crypto = require('crypto');
const { getSdk } = require('../../api-util/sdk');
const { createTTLCache } = require('../../api-util/cache');

const TOKEN_TTL_MS = 30 * 60 * 1000;
const TOKEN_BYTES = 32;
const TOKEN_CACHE_MAX_ENTRIES = 1000;
// userId -> token. Keying by user guarantees that issuing a replacement
// invalidates the previous token instead of growing the store on every request.
const tokenStore = createTTLCache(TOKEN_TTL_MS / 1000, {
  maxEntries: TOKEN_CACHE_MAX_ENTRIES,
});

const parseList = value =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

// Emails in BULK_IMPORT_OPERATOR_EMAILS identify "admin" users. Admins may set a
// `user_id` column in the CSV to create listings on behalf of other users. This
// is no longer an access gate — any signed-in user can bulk-import for themselves.
const getAdminEmails = () =>
  new Set(parseList(process.env.BULK_IMPORT_OPERATOR_EMAILS).map(email => email.toLowerCase()));

const getCurrentUser = async (req, res) => {
  const sdk = getSdk(req, res);
  const response = await sdk.currentUser.show();
  const user = response?.data?.data;
  const userId = user?.id?.uuid;
  const email = user?.attributes?.email;

  if (!userId) {
    const error = new Error('unauthorized');
    error.status = 401;
    throw error;
  }

  return { userId, email };
};

const isAdminUser = ({ email }) => {
  const admins = getAdminEmails();
  if (admins.size === 0) {
    return false;
  }
  const normalizedEmail = typeof email === 'string' ? email.toLowerCase() : null;
  return !!(normalizedEmail && admins.has(normalizedEmail));
};

const issueActionToken = userId => {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  tokenStore[userId] = token;
  const { expiresAt } = tokenStore[userId];
  return { token, expiresAt: new Date(expiresAt).toISOString() };
};

const validateActionToken = (token, userId) => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const { data: expectedToken } = tokenStore[userId];
  return expectedToken === token;
};

const resetTokenStore = () => {
  Object.keys(tokenStore).forEach(userId => delete tokenStore[userId]);
};

// Any signed-in Sharetribe user may run bulk imports for themselves. Admins
// (emails in BULK_IMPORT_OPERATOR_EMAILS) may additionally set a CSV `user_id`
// column to author listings on behalf of other users.
const requireUserSession = async (req, res, next) => {
  let currentUser;
  try {
    currentUser = await getCurrentUser(req, res);
  } catch (err) {
    return res.status(401).json({ error: 'La importación masiva requiere una sesión iniciada.' });
  }

  req.bulkImportUser = { ...currentUser, isAdmin: isAdminUser(currentUser) };
  return next();
};

const requireActionToken = (req, res, next) => {
  const token = req.get('X-Bulk-Import-Token');
  const userId = req.bulkImportUser?.userId;

  if (!validateActionToken(token, userId)) {
    return res
      .status(401)
      .json({ error: 'Token de acción de importación masiva inválido o expirado.' });
  }

  return next();
};

const authorizeAction = (req, res) => {
  const { token, expiresAt } = issueActionToken(req.bulkImportUser.userId);
  return res.json({ ok: true, token, expiresAt, isAdmin: req.bulkImportUser.isAdmin });
};

module.exports = {
  authorizeAction,
  requireActionToken,
  requireUserSession,
  _test: {
    TOKEN_TTL_MS,
    TOKEN_CACHE_MAX_ENTRIES,
    issueActionToken,
    validateActionToken,
    tokenStore,
    resetTokenStore,
  },
};
