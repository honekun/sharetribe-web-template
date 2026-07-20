'use strict';

const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

const {
  localDeliveryFailure,
  rejectedProviderRequest,
  unknownProviderOutcome,
} = require('./notificationProviderError');

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function positiveTemplateId(value, name = 'templateId') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw localDeliveryFailure(`${name} must be configured as a positive Brevo template ID`);
  }
  return id;
}

function resolveProjectFile(relativePath) {
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  if (!absolutePath.startsWith(`${PROJECT_ROOT}${path.sep}`)) {
    throw localDeliveryFailure('Brevo attachment path must stay inside the project');
  }
  return absolutePath;
}

async function loadAttachments(attachments = []) {
  return Promise.all(
    attachments.map(async attachment => {
      if (!attachment?.path || !attachment?.name) {
        throw localDeliveryFailure('Brevo attachment requires path and name');
      }
      try {
        const content = await fs.readFile(resolveProjectFile(attachment.path));
        return { name: attachment.name, content: content.toString('base64') };
      } catch (err) {
        throw localDeliveryFailure(`Unable to load Brevo attachment: ${attachment.path}`, err);
      }
    })
  );
}

/**
 * Send one Brevo transactional-template email.
 *
 * @param {Object} message
 * @param {string} message.email recipient address
 * @param {string} [message.name] recipient display name
 * @param {number|string} message.templateId hosted Brevo transactional template
 * @param {Object} [message.params] template parameters
 * @param {string[]} [message.tags] Brevo tags used by webhook/reporting
 * @param {{path: string, name: string}[]} [message.attachments] project-local files
 */
async function sendBrevoEmail({
  email,
  name,
  templateId,
  params = {},
  tags = [],
  attachments = [],
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'hola@archivovintach.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Archivo Vintach';

  if (!apiKey) {
    throw localDeliveryFailure('BREVO_API_KEY is not configured');
  }
  if (!email) {
    throw localDeliveryFailure('Brevo email recipient is required');
  }

  const attachment = await loadAttachments(attachments);
  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email, ...(name ? { name } : {}) }],
    templateId: positiveTemplateId(templateId),
    params,
    ...(tags.length > 0 ? { tags } : {}),
    ...(attachment.length > 0 ? { attachment } : {}),
  };

  let response;
  try {
    response = await fetch(BREVO_EMAIL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw unknownProviderOutcome('Brevo request ended without a provider response', err);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    console.error('[brevoEmailService] Brevo API error:', response.status, body);
    throw rejectedProviderRequest(
      `Brevo transactional email failed: ${response.status}`,
      response.status
    );
  }

  const body = await response.json().catch(() => ({}));
  return { providerMessageId: body.messageId || null };
}

module.exports = {
  BREVO_EMAIL_URL,
  loadAttachments,
  positiveTemplateId,
  sendBrevoEmail,
};
