'use strict';

const express = require('express');
const proxyaddr = require('proxy-addr');

const { toTrustProxySetting } = require('./trustProxy');

// What the Heroku router sends: whatever X-Forwarded-For the client supplied,
// with the real client address appended, from the router's own address.
const herokuRequest = () => ({
  headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' },
  connection: { remoteAddress: '10.1.2.3' },
  socket: { remoteAddress: '10.1.2.3' },
});

const clientIpWith = setting => {
  const app = express();
  app.set('trust proxy', setting);
  return proxyaddr(herokuRequest(), app.get('trust proxy fn'));
};

describe('toTrustProxySetting', () => {
  it('turns a hop count into a number', () => {
    expect(toTrustProxySetting('1')).toBe(1);
    expect(toTrustProxySetting(' 2 ')).toBe(2);
  });

  it('passes address lists and named ranges through unchanged', () => {
    expect(toTrustProxySetting('loopback')).toBe('loopback');
    expect(toTrustProxySetting('10.0.0.0/8, 172.16.0.0/12')).toBe('10.0.0.0/8, 172.16.0.0/12');
  });

  it('resolves the client Heroku saw, not one the client wrote, behind one hop', () => {
    expect(clientIpWith(toTrustProxySetting('1'))).toBe('203.0.113.9');
  });

  it('documents why the raw string is not enough', () => {
    // Express reads the string "1" as an IP address, trusts nothing, and reports
    // the router itself — every client would then share one rate-limit bucket.
    expect(clientIpWith('1')).toBe('10.1.2.3');
  });
});
