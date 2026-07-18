'use strict';

const ALERT_THRESHOLD = 3;

const state = {
  startedAt: new Date().toISOString(),
  channels: {
    brevo: { sent: 0, failed: 0, unknown: 0, deduplicated: 0, consecutiveErrors: 0 },
    whatsapp: { sent: 0, failed: 0, unknown: 0, deduplicated: 0, consecutiveErrors: 0 },
  },
  poller: {
    lastPollStartedAt: null,
    lastPollCompletedAt: null,
    lastError: null,
    lastSequenceId: null,
    pagesProcessed: 0,
    eventsProcessed: 0,
    remainingEventCount: null,
    sequenceLagEvents: null,
    oldestObservedEventAgeMs: 0,
    backlogBoundHit: false,
    errorCount: 0,
    consecutiveErrors: 0,
  },
};

function recordDelivery(channel, outcome) {
  const metrics = state.channels[channel];
  if (!metrics || metrics[outcome] == null) return;

  metrics[outcome] += 1;
  if (outcome === 'failed' || outcome === 'unknown') {
    metrics.consecutiveErrors += 1;
    if (metrics.consecutiveErrors === ALERT_THRESHOLD || metrics.consecutiveErrors % 10 === 0) {
      console.error(
        `[notificationAlert] channel=${channel} consecutiveErrors=${metrics.consecutiveErrors} outcome=${outcome}`
      );
    }
  } else if (outcome === 'sent') {
    metrics.consecutiveErrors = 0;
  }
}

function recordPollStarted() {
  state.poller.lastPollStartedAt = new Date().toISOString();
  state.poller.lastError = null;
}

function recordPollCompleted(metrics) {
  Object.assign(state.poller, metrics, {
    lastPollCompletedAt: new Date().toISOString(),
    lastError: null,
    consecutiveErrors: 0,
  });
}

function recordPollError(err) {
  state.poller.lastError = err?.message || String(err);
  state.poller.errorCount += 1;
  state.poller.consecutiveErrors += 1;
  if (
    state.poller.consecutiveErrors === ALERT_THRESHOLD ||
    state.poller.consecutiveErrors % 10 === 0
  ) {
    console.error(`[notificationAlert] poller consecutiveErrors=${state.poller.consecutiveErrors}`);
  }
}

function getNotificationMetrics() {
  return JSON.parse(JSON.stringify(state));
}

module.exports = {
  ALERT_THRESHOLD,
  getNotificationMetrics,
  recordDelivery,
  recordPollCompleted,
  recordPollError,
  recordPollStarted,
};
