'use strict';

class NotificationProviderError extends Error {
  constructor(message, { outcome, retryable = false, status = null, cause = null } = {}) {
    super(message);
    this.name = 'NotificationProviderError';
    this.notificationOutcome = outcome;
    this.retryable = retryable;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

function rejectedProviderRequest(message, status) {
  return new NotificationProviderError(message, {
    outcome: 'failed',
    retryable: status === 429 || status >= 500,
    status,
  });
}

function unknownProviderOutcome(message, cause) {
  return new NotificationProviderError(message, {
    outcome: 'unknown',
    cause,
  });
}

function localDeliveryFailure(message, cause) {
  return new NotificationProviderError(message, {
    outcome: 'failed',
    cause,
  });
}

module.exports = {
  NotificationProviderError,
  localDeliveryFailure,
  rejectedProviderRequest,
  unknownProviderOutcome,
};
