const request = require('supertest');
const mongoose = require('mongoose');
const db = require('./helpers/db');
const createApp = require('../src/app');
const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const { createShutdown } = require('../src/server');

describe('health check', () => {
  beforeAll(db.connect);
  afterAll(db.close);

  test('returns 200 with the database connected', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'healthy', mongodb: 'connected' });
    expect(typeof res.body.uptime).toBe('number');
  });
});

describe('graceful shutdown', () => {
  test('stops cleanup, waits for open requests, closes the server and the database, then exits 0', async () => {
    // A server like createServer() builds, with one request that stays open until the test finishes it.
    let finishSlow;
    const app = express();
    app.get('/test-slow', (req, res) => { finishSlow = () => res.json({ done: true }); });
    const server = http.createServer(app);
    const io = socketIo(server);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    const slow = fetch(`http://127.0.0.1:${port}/test-slow`).then((r) => r.json());
    await new Promise((resolve) => { const t = setInterval(() => { if (finishSlow) { clearInterval(t); resolve(); } }, 10); });

    const exit = jest.fn();
    const stopCleanup = jest.fn();
    const disconnect = jest.spyOn(mongoose, 'disconnect').mockResolvedValue();
    const shutdown = createShutdown({ io, stopCleanup, exit, timeoutMs: 5000 });
    const done = shutdown('SIGTERM');
    expect(shutdown('SIGTERM')).toBe(done); // a second signal does not start over

    expect(stopCleanup).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled(); // still serving the open request
    finishSlow();
    expect(await slow).toEqual({ done: true });
    await done;

    expect(server.listening).toBe(false);
    expect(disconnect).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
    disconnect.mockRestore();
  });

  test('exits 1 when connections do not finish in time', async () => {
    const exit = jest.fn();
    const io = { close: () => {} }; // never calls back
    createShutdown({ io, exit, timeoutMs: 50 })('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
