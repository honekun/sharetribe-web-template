'use strict';

const { NewsletterConsentStore, normalizeEmail, normalizeSource } = require('./newsletterConsent');

function mockPool(row = { id: '1', consent_at: '2026-07-17T00:00:00.000Z' }) {
  return { query: jest.fn().mockResolvedValue({ rows: [row] }) };
}

describe('newsletterConsent', () => {
  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  User@Example.CO ')).toBe('user@example.co');
      expect(normalizeEmail(undefined)).toBe('');
    });
  });

  describe('normalizeSource', () => {
    it('keeps known sources and defaults unknown/missing to the footer source', () => {
      expect(normalizeSource('footer_newsletter')).toBe('footer_newsletter');
      expect(normalizeSource('spoofed')).toBe('footer_newsletter');
      expect(normalizeSource(undefined)).toBe('footer_newsletter');
    });
  });

  describe('record', () => {
    it('inserts normalized evidence and returns { id, consentAt }', async () => {
      const pool = mockPool();
      const store = new NewsletterConsentStore(pool);

      const result = await store.record({
        email: '  User@Example.com ',
        source: 'footer_newsletter',
        locale: 'es',
        policyVersion: '2026-07-17',
        sharetribeUserId: 'user-1',
        ip: '203.0.113.5',
        consentAt: '2026-07-17T10:00:00.000Z',
      });

      expect(pool.query).toHaveBeenCalledTimes(1);
      const params = pool.query.mock.calls[0][1];
      expect(params[0]).toBe('user@example.com'); // normalized email
      expect(params[1]).toBe('2026-07-17T10:00:00.000Z');
      expect(params[2]).toBe('footer_newsletter');
      expect(params[3]).toBe('es');
      expect(params[4]).toBe('2026-07-17');
      expect(params[5]).toBe('user-1');
      expect(params[6]).toBe('203.0.113.5');
      expect(result).toEqual({ id: '1', consentAt: '2026-07-17T00:00:00.000Z' });
    });

    it('coerces an unknown source and nulls optional fields', async () => {
      const pool = mockPool();
      const store = new NewsletterConsentStore(pool);

      await store.record({ email: 'a@b.co', source: 'spoofed', policyVersion: '1' });

      const params = pool.query.mock.calls[0][1];
      expect(params[2]).toBe('footer_newsletter'); // source coerced to whitelist
      expect(params[3]).toBeNull(); // locale
      expect(params[5]).toBeNull(); // sharetribeUserId
      expect(params[6]).toBeNull(); // ip
    });

    it('requires an email and a policy version', async () => {
      const store = new NewsletterConsentStore(mockPool());
      await expect(store.record({ policyVersion: '1' })).rejects.toThrow(/email/);
      await expect(store.record({ email: 'a@b.co' })).rejects.toThrow(/policyVersion/);
    });
  });
});
