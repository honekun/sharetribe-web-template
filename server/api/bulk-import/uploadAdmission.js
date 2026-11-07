'use strict';

// Admission control for POST /api/bulk-import/start, run after the session and
// action token are checked but BEFORE Multer reads the body (audit A05).
//
// Buffering (up to the tier's ZIP size), extraction (up to 100 MB, synchronous)
// and CSV parsing all happen in the web process that serves the marketplace,
// so the job limits must apply before that work, not after it:
//
//  - every attempt counts toward a per-user hourly attempt cap, valid or not;
//  - a user over the completed-import cap is refused without uploading;
//  - a user gets one in-flight upload *or* one active job at a time (409);
//  - in-flight uploads plus active jobs never exceed the global cap (503).
//
// An admitted request holds a reservation that is released exactly once: when
// its job is created (the job then counts instead), or when the response
// finishes or the connection closes for any other reason (rejection, parser or
// config error, client disconnect).
//
// In-process memory, like the job store: correct on the documented single web
// dyno (docs/operations/scaling.md).

const { countActiveJobs, hasActiveJobForUser } = require('./jobStore');
const { getLimits } = require('./limits');
const { checkAndRecordAttempt, wouldAllow } = require('./rateLimiter');

// Caps imports running or uploading concurrently across all users (memory protection).
const MAX_GLOBAL_CONCURRENT_JOBS = 3;

const reservations = new Map(); // userId -> reservation

const createReservation = userId => {
  let released = false;
  const reservation = {
    userId,
    release() {
      if (released) return;
      released = true;
      if (reservations.get(userId) === reservation) reservations.delete(userId);
    },
  };
  reservations.set(userId, reservation);
  return reservation;
};

const hasReservation = userId => reservations.has(userId);

// Imports that currently hold capacity: running jobs plus admitted uploads.
const usedCapacity = () => countActiveJobs() + reservations.size;

function admitUpload(req, res, next) {
  const { userId, isAdmin } = req.bulkImportUser;
  const limits = getLimits(isAdmin);

  if (!checkAndRecordAttempt(userId, limits.maxUploadAttemptsPerHour)) {
    res.setHeader('Retry-After', '3600');
    return res.status(429).json({
      error: 'Demasiados intentos de importación. Inténtalo de nuevo en una hora.',
    });
  }

  if (!wouldAllow(userId, limits.maxImportsPerHour)) {
    return res.status(429).json({
      error: `Demasiadas importaciones. Puedes iniciar ${limits.maxImportsPerHour} por hora. Inténtalo más tarde.`,
    });
  }

  if (hasActiveJobForUser(userId) || hasReservation(userId)) {
    return res.status(409).json({
      error: 'Ya tienes una importación en curso. Espera a que termine antes de iniciar una nueva.',
    });
  }

  if (usedCapacity() >= MAX_GLOBAL_CONCURRENT_JOBS) {
    return res.status(503).json({
      error:
        'La capacidad de importación está llena en este momento. Inténtalo de nuevo en unos minutos.',
    });
  }

  const reservation = createReservation(userId);
  req.bulkImportReservation = reservation;
  res.once('finish', reservation.release);
  res.once('close', reservation.release);
  return next();
}

module.exports = {
  admitUpload,
  MAX_GLOBAL_CONCURRENT_JOBS,
  _test: {
    reservations,
    reset: () => reservations.clear(),
  },
};
