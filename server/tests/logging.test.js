const express = require('express');
const request = require('supertest');
const { createLogger, redact } = require('../src/utils/logger');
const requestLog = require('../src/middleware/requestLog');

function capture(env) {
  const out = [];
  const err = [];
  const stream = (list) => ({ write: (line) => list.push(line) });
  return { log: createLogger({ env, stdout: stream(out), stderr: stream(err) }), out, err };
}

describe('logger', () => {
  test('production writes one JSON line per event, errors to stderr', () => {
    const { log, out, err } = capture('production');
    log.info('Server is running', { port: 5000 });
    log.error('Upload cleanup failed', { err: new Error('disk full') });

    const info = JSON.parse(out[0]);
    expect(info).toMatchObject({ level: 'info', msg: 'Server is running', port: 5000 });
    expect(new Date(info.time).toString()).not.toBe('Invalid Date');
    const error = JSON.parse(err[0]);
    expect(error).toMatchObject({ level: 'error', msg: 'Upload cleanup failed', err: { name: 'Error', message: 'disk full' } });
    expect(error.err.stack).toMatch(/disk full/);
  });

  test('secrets are removed from messages, fields and error stacks', () => {
    const { log, out, err } = capture('production');
    log.info('Connecting to mongodb+srv://admin:hunter2@cluster0.example.net/qr', { header: 'Bearer abc.def.ghi' });
    log.error('Failed', { err: new Error('bad token eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIn0.c2ln for cloudinary://12:s3cr3t@cloud') });
    const all = out.join('') + err.join('');
    expect(all).not.toMatch(/hunter2|s3cr3t|eyJhbGci|abc\.def\.ghi/);
    expect(all).toMatch(/mongodb\+srv:\/\/\*\*\*@cluster0/);
  });

  test('development is readable text and tests are silent', () => {
    const dev = capture('development');
    dev.log.warn('MongoDB disconnected');
    expect(dev.out[0]).toBe('WARN MongoDB disconnected\n');
    const quiet = capture('test');
    quiet.log.error('nothing to see');
    expect(quiet.out.length + quiet.err.length).toBe(0);
  });

  test('redact leaves ordinary text alone', () => {
    expect(redact('Order 2026-27/000001 for table 4 at https://example.com/menu')).toBe('Order 2026-27/000001 for table 4 at https://example.com/menu');
  });
});

describe('request log', () => {
  function app(lines) {
    const fake = { info: (m, f) => lines.push(['info', m, f]), warn: (m, f) => lines.push(['warn', m, f]), error: (m, f) => lines.push(['error', m, f]) };
    const a = express();
    a.use(requestLog(fake));
    a.get('/api/orders/status/:id', (req, res) => res.json({ ok: true }));
    a.get('/health', (req, res) => res.status(Number(req.query.status) || 200).end());
    a.get('/boom', (req, res) => res.status(500).end());
    return a;
  }

  test('logs method, path without the query string, status and time, and returns a request id', async () => {
    const lines = [];
    const res = await request(app(lines)).get('/api/orders/status/abc?token=secret-tracking-token');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(lines).toHaveLength(1);
    const [level, msg, fields] = lines[0];
    expect([level, msg]).toEqual(['info', 'request']);
    expect(fields).toMatchObject({ id: res.headers['x-request-id'], method: 'GET', path: '/api/orders/status/abc', status: 200 });
    expect(typeof fields.ms).toBe('number');
    expect(JSON.stringify(lines)).not.toMatch(/secret-tracking-token/);
  });

  test('keeps Render\'s request id, skips healthy health checks and flags errors', async () => {
    const lines = [];
    const a = app(lines);
    const res = await request(a).get('/health').set('rndr-id', 'render-123');
    expect(res.headers['x-request-id']).toBe('render-123');
    expect(lines).toHaveLength(0);

    await request(a).get('/health?status=503');
    await request(a).get('/boom');
    expect(lines.map(([level, , f]) => [level, f.path, f.status])).toEqual([['error', '/health', 503], ['error', '/boom', 500]]);
  });
});

describe('error handler logging', () => {
  test('logs the error and the path, but never the query string', async () => {
    const logged = [];
    jest.resetModules();
    jest.doMock('../src/utils/logger', () => ({ info: () => {}, warn: () => {}, error: (m, f) => logged.push([m, f]) }));
    const { errorHandler } = require('../src/middleware/error');
    const probe = express();
    probe.get('/api/orders/status/:id', () => { throw new Error('kaboom'); });
    probe.use(errorHandler);

    const res = await request(probe).get('/api/orders/status/abc?token=secret-tracking-token');
    expect(res.status).toBe(500);
    expect(logged).toHaveLength(1);
    expect(logged[0][1]).toMatchObject({ method: 'GET', path: '/api/orders/status/abc' });
    expect(logged[0][1].err.message).toBe('kaboom');
    expect(JSON.stringify(logged[0][1])).not.toMatch(/secret-tracking-token/);
    jest.dontMock('../src/utils/logger');
  });
});
