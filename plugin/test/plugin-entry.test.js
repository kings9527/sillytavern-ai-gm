/**
 * Test: ST Plugin System Entry Point
 * Verifies server.js exports correct info + init for SillyTavern plugin loader
 */

import { info, init, router, errorHandler } from '../server.js';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`);
}

function testInfoExport() {
  assert(typeof info === 'object', 'info must be an object');
  assert(info.id === 'ai-gm', `info.id must be 'ai-gm', got ${info.id}`);
  assert(typeof info.name === 'string' && info.name.length > 0, 'info.name must be non-empty string');
  assert(typeof info.description === 'string' && info.description.length > 0, 'info.description must be non-empty string');
  assert(/^[a-z0-9_-]+$/.test(info.id), 'info.id must be valid plugin ID (lowercase alphanumeric, hyphens, underscores)');
  console.log('✅ testInfoExport passed');
}

function testInitExport() {
  assert(typeof init === 'function', 'init must be a function');
  assert(init.length >= 1, 'init must accept at least 1 argument (router)');
  console.log('✅ testInitExport passed');
}

function testRouterExport() {
  assert(typeof router === 'object', 'router must be an object');
  assert(typeof router.get === 'function', 'router.get must be a function');
  assert(typeof router.post === 'function', 'router.post must be a function');
  console.log('✅ testRouterExport passed');
}

function testErrorHandlerExport() {
  assert(typeof errorHandler === 'function', 'errorHandler must be a function');
  assert(errorHandler.length === 4, 'errorHandler must be 4-arity Express error handler');
  console.log('✅ testErrorHandlerExport passed');
}

function testInitMountsRoutes() {
  // Simulate a mock router
  const calls = [];
  const mockRouter = {
    use: (...args) => { calls.push({ method: 'use', args }); },
  };
  init(mockRouter);
  assert(calls.length >= 2, 'init must register at least 2 middlewares (router + errorHandler)');
  assert(calls[0].method === 'use', 'first call must be use()');
  assert(calls[1].method === 'use', 'second call must be use()');
  console.log('✅ testInitMountsRoutes passed');
}

function runAll() {
  console.log('--- ST Plugin Entry Test ---');
  testInfoExport();
  testInitExport();
  testRouterExport();
  testErrorHandlerExport();
  testInitMountsRoutes();
  console.log('All tests passed ✅');
}

runAll();
