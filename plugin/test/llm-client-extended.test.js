/**
 * LLM Client Extended Test Suite
 * Coverage target: utils/llm-client.js (uncovered paths)
 */

import { LLMClient, createLLMClientFromEnv } from '../utils/llm-client.js';

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    failCount++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function deepEqual(a, b, message) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(message || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}

let _originalFetch;
function mockFetch(response) {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => response,
  });
}
function mockFetchFail(status, statusText) {
  global.fetch = async () => {
    const err = new Error(`API error: ${status} ${statusText}`);
    err.status = status;
    const resp = { ok: false, status, statusText, json: async () => ({}) };
    // Some code reads response.ok then throws; some reads error.status
    return resp;
  };
}
function restoreFetch() {
  global.fetch = _originalFetch;
}

console.log('=== LLM Client Extended Tests ===\n');

// --- _extractJSON ---
console.log('--- _extractJSON ---');

const client = new LLMClient({
  provider: 'openai',
  apiKey: 'test',
  baseUrl: 'http://127.0.0.1:59999est',
});

test('_extractJSON parses direct JSON', () => {
  const result = client._extractJSON('{"action":"attack"}');
  deepEqual(result, { action: 'attack' });
});

test('_extractJSON extracts from markdown code block', () => {
  const result = client._extractJSON('```json\n{"action":"flee"}\n```');
  deepEqual(result, { action: 'flee' });
});

test('_extractJSON extracts from plain code block', () => {
  const result = client._extractJSON('```\n{"action":"spell"}\n```');
  deepEqual(result, { action: 'spell' });
});

test('_extractJSON finds JSON object in text', () => {
  const result = client._extractJSON('Here is the result: {"action":"item"} Done.');
  deepEqual(result, { action: 'item' });
});

test('_extractJSON finds JSON array in text', () => {
  const result = client._extractJSON('Results: [{"id":1},{"id":2}]');
  deepEqual(result, [{ id: 1 }, { id: 2 }]);
});

test('_extractJSON returns error object for invalid JSON', () => {
  const result = client._extractJSON('not json at all');
  assert(result.error === 'JSON parse failed', 'Expected error field');
  assert(result.raw === 'not json at all', 'Expected raw field');
});

// --- chatJSON ---
console.log('\n--- chatJSON ---');

_originalFetch = global.fetch;

test('chatJSON appends JSON instruction to last user message', async () => {
  mockFetch({
    choices: [{ message: { content: '{"result":"ok"}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    model: 'gpt-4',
  });
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const result = await c.chatJSON([{ role: 'user', content: 'hello' }]);
  assert(result.result === 'ok', 'Expected parsed JSON result');
  restoreFetch();
});

test('chatJSON adds new user message if last is not user', async () => {
  mockFetch({
    choices: [{ message: { content: '{"result":"yes"}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    model: 'gpt-4',
  });
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const result = await c.chatJSON([{ role: 'system', content: 'sys' }]);
  assert(result.result === 'yes', 'Expected parsed JSON result');
  restoreFetch();
});

test('chatJSON with jsonSchema includes schema in instruction', async () => {
  mockFetch({
    choices: [{ message: { content: '{"name":"test"}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    model: 'gpt-4',
  });
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const result = await c.chatJSON([{ role: 'user', content: 'hello' }], {
    jsonSchema: { type: 'object', properties: { name: { type: 'string' } } },
  });
  assert(result.name === 'test', 'Expected parsed name');
  restoreFetch();
});

// --- complete ---
console.log('\n--- complete ---');

test('complete sends single prompt and returns text', async () => {
  mockFetch({
    choices: [{ message: { content: '  Generated text  ' } }],
    usage: { prompt_tokens: 5, completion_tokens: 3 },
    model: 'gpt-4',
  });
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const text = await c.complete('prompt here');
  assert(text === 'Generated text', 'Expected trimmed content');
  restoreFetch();
});

test('complete with system prompt includes system message', async () => {
  mockFetch({
    choices: [{ message: { content: 'reply' } }],
    usage: { prompt_tokens: 5, completion_tokens: 1 },
    model: 'gpt-4',
  });
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const text = await c.complete('prompt', 'system');
  assert(text === 'reply', 'Expected reply');
  restoreFetch();
});

// --- _sendRequest providers ---
console.log('\n--- _sendRequest providers ---');

test('_sendOpenAIRequest returns parsed response', async () => {
  mockFetch({
    choices: [{ message: { content: 'OpenAI says hi' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    model: 'gpt-4o',
  });
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const resp = await c._sendOpenAIRequest([{ role: 'user', content: 'hi' }], c.config);
  assert(resp.content === 'OpenAI says hi', 'Expected content');
  assert(resp.model === 'gpt-4o', 'Expected model');
  assert(resp.promptTokens === 10, 'Expected prompt tokens');
  assert(resp.cached === false, 'Expected not cached');
  restoreFetch();
});

test('_sendOpenAIRequest throws on non-ok response', async () => {
  mockFetchFail(500, 'Internal Server Error');
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  let threw = false;
  try {
    await c._sendOpenAIRequest([{ role: 'user', content: 'hi' }], c.config);
  } catch (e) {
    threw = true;
    assert(e.message.includes('500'), 'Expected 500 in error');
  }
  assert(threw, 'Expected throw');
  restoreFetch();
});

test('_sendClaudeRequest returns parsed response', async () => {
  mockFetch({
    content: [{ text: 'Claude says hi' }],
    usage: { input_tokens: 10, output_tokens: 5 },
    model: 'claude-3',
  });
  const c = new LLMClient({ provider: 'claude', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const resp = await c._sendClaudeRequest([{ role: 'user', content: 'hi' }], {
    ...c.config,
    model: 'claude-3',
    maxTokens: 1024,
  });
  assert(resp.content === 'Claude says hi', 'Expected content');
  assert(resp.model === 'claude-3', 'Expected model');
  restoreFetch();
});

test('_sendClaudeRequest handles system messages', async () => {
  mockFetch({
    content: [{ text: 'ok' }],
    usage: { input_tokens: 5, output_tokens: 1 },
  });
  const c = new LLMClient({ provider: 'claude', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const resp = await c._sendClaudeRequest(
    [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ],
    c.config,
  );
  assert(resp.content === 'ok', 'Expected content');
  restoreFetch();
});

test('_sendOllamaRequest returns parsed response', async () => {
  mockFetch({
    message: { content: 'Ollama says hi' },
    prompt_eval_count: 10,
    eval_count: 5,
    model: 'llama3',
  });
  const c = new LLMClient({ provider: 'ollama', apiKey: '', baseUrl: 'http://127.0.0.1:59999' });
  const resp = await c._sendOllamaRequest([{ role: 'user', content: 'hi' }], c.config);
  assert(resp.content === 'Ollama says hi', 'Expected content');
  assert(resp.promptTokens === 10, 'Expected prompt tokens');
  restoreFetch();
});

test('_sendSillyTavernRequest returns parsed response', async () => {
  mockFetch({
    choices: [{ message: { content: 'ST says hi' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
  const c = new LLMClient({ provider: 'sillytavern', apiKey: '', baseUrl: 'http://st' });
  const resp = await c._sendSillyTavernRequest([{ role: 'user', content: 'hi' }], c.config);
  assert(resp.content === 'ST says hi', 'Expected content');
  restoreFetch();
});

test('_sendSillyTavernRequest uses apiKey when provided', async () => {
  let headersUsed = null;
  global.fetch = async (_url, opts) => {
    headersUsed = opts.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }),
    };
  };
  const c = new LLMClient({ provider: 'sillytavern', apiKey: 'secret', baseUrl: 'http://st' });
  await c._sendSillyTavernRequest([{ role: 'user', content: 'hi' }], c.config);
  assert(headersUsed.Authorization === 'Bearer secret', 'Expected auth header');
  restoreFetch();
});

// --- chat retry and cache ---
console.log('\n--- chat retry and cache ---');

test('chat retries on server error then succeeds', async () => {
  let callCount = 0;
  global.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      const err = new Error('API error: 503 Service Unavailable');
      err.status = 503;
      return { ok: false, status: 503, statusText: 'Unavailable', json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }),
    };
  };
  const c = new LLMClient({
    provider: 'openai',
    apiKey: 'k',
    baseUrl: 'http://127.0.0.1:59999',
    retries: 1,
  });
  const resp = await c.chat([{ role: 'user', content: 'hi' }]);
  assert(resp.content === 'ok', 'Expected success after retry');
  assert(callCount === 2, 'Expected 2 calls');
  restoreFetch();
});

test('chat does not retry on 4xx client error', async () => {
  let callCount = 0;
  global.fetch = async () => {
    callCount++;
    return { ok: false, status: 400, statusText: 'Bad Request', json: async () => ({}) };
  };
  const c = new LLMClient({
    provider: 'openai',
    apiKey: 'k',
    baseUrl: 'http://127.0.0.1:59999',
    retries: 2,
  });
  let threw = false;
  try {
    await c.chat([{ role: 'user', content: 'hi' }]);
  } catch (_e) {
    threw = true;
  }
  assert(threw, 'Expected throw');
  assert(callCount === 1, 'Expected no retry on 4xx');
  restoreFetch();
});

test('chat uses cache on identical request', async () => {
  let callCount = 0;
  global.fetch = async () => {
    callCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'cached' } }], usage: {} }),
    };
  };
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const msg = [{ role: 'user', content: 'hi' }];
  const r1 = await c.chat(msg);
  const r2 = await c.chat(msg);
  assert(r1.content === 'cached', 'Expected first response');
  assert(r2.content === 'cached', 'Expected second response');
  assert(r2.cached === true, 'Expected cached flag');
  assert(callCount === 1, 'Expected only 1 fetch call');
  restoreFetch();
});

test('chat skips cache when stream option is true', async () => {
  let callCount = 0;
  global.fetch = async () => {
    callCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'stream' } }], usage: {} }),
    };
  };
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const msg = [{ role: 'user', content: 'stream test' }];
  await c.chat(msg, { stream: true });
  await c.chat(msg, { stream: true });
  assert(callCount === 2, 'Expected no cache for stream');
  restoreFetch();
});

test('chat throws when not available', async () => {
  const c = new LLMClient({ provider: 'openai', apiKey: '', baseUrl: '' });
  let threw = false;
  try {
    await c.chat([{ role: 'user', content: 'hi' }]);
  } catch (e) {
    threw = true;
    assert(e.message.includes('not configured'), 'Expected not configured error');
  }
  assert(threw, 'Expected throw');
});

// --- _sendRequest routing ---
console.log('\n--- _sendRequest routing ---');

test('_sendRequest routes to openai by default', async () => {
  mockFetch({ choices: [{ message: { content: 'routed' } }], usage: {} });
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const resp = await c._sendRequest([], { provider: 'openai' });
  assert(resp.content === 'routed', 'Expected routed response');
  restoreFetch();
});

test('_sendRequest routes to claude', async () => {
  mockFetch({ content: [{ text: 'claude' }], usage: {} });
  const c = new LLMClient({ provider: 'claude', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  const resp = await c._sendRequest([], { provider: 'claude' });
  assert(resp.content === 'claude', 'Expected claude response');
  restoreFetch();
});

test('_sendRequest routes to ollama', async () => {
  mockFetch({ message: { content: 'ollama' }, prompt_eval_count: 1, eval_count: 1 });
  const c = new LLMClient({ provider: 'ollama', apiKey: '', baseUrl: 'http://127.0.0.1:59999' });
  const resp = await c._sendRequest([], { provider: 'ollama' });
  assert(resp.content === 'ollama', 'Expected ollama response');
  restoreFetch();
});

test('_sendRequest routes to sillytavern', async () => {
  mockFetch({ choices: [{ message: { content: 'st' } }], usage: {} });
  const c = new LLMClient({
    provider: 'sillytavern',
    apiKey: '',
    baseUrl: 'http://127.0.0.1:59999',
  });
  const resp = await c._sendRequest([], { provider: 'sillytavern' });
  assert(resp.content === 'st', 'Expected sillytavern response');
  restoreFetch();
});

// --- createLLMClientFromEnv ---
console.log('\n--- createLLMClientFromEnv ---');

test('createLLMClientFromEnv uses defaults when no env vars', () => {
  delete process.env.AI_GM_LLM_PROVIDER;
  delete process.env.AI_GM_LLM_BASE_URL;
  delete process.env.AI_GM_LLM_API_KEY;
  delete process.env.AI_GM_LLM_MODEL;
  const c = createLLMClientFromEnv();
  assert(c.config.provider === 'openai', 'Expected default provider');
  assert(c.config.baseUrl === 'https://api.openai.com/v1', 'Expected default baseUrl');
  assert(c.config.model === 'gpt-4o-mini', 'Expected default model');
  assert(c.config.maxTokens === 512, 'Expected default maxTokens');
  assert(c.config.temperature === 0.7, 'Expected default temperature');
  assert(c.config.timeout === 30000, 'Expected default timeout');
});

test('createLLMClientFromEnv reads env vars', () => {
  process.env.AI_GM_LLM_PROVIDER = 'claude';
  process.env.AI_GM_LLM_BASE_URL = 'http://claude.local';
  process.env.AI_GM_LLM_API_KEY = 'secret-key';
  process.env.AI_GM_LLM_MODEL = 'claude-3-opus';
  process.env.AI_GM_LLM_MAX_TOKENS = '1024';
  process.env.AI_GM_LLM_TEMPERATURE = '0.5';
  process.env.AI_GM_LLM_TIMEOUT = '60000';
  const c = createLLMClientFromEnv();
  assert(c.config.provider === 'claude', 'Expected provider');
  assert(c.config.baseUrl === 'http://claude.local', 'Expected baseUrl');
  assert(c.config.apiKey === 'secret-key', 'Expected apiKey');
  assert(c.config.model === 'claude-3-opus', 'Expected model');
  assert(c.config.maxTokens === 1024, 'Expected maxTokens');
  assert(c.config.temperature === 0.5, 'Expected temperature');
  assert(c.config.timeout === 60000, 'Expected timeout');
  // cleanup
  delete process.env.AI_GM_LLM_PROVIDER;
  delete process.env.AI_GM_LLM_BASE_URL;
  delete process.env.AI_GM_LLM_API_KEY;
  delete process.env.AI_GM_LLM_MODEL;
  delete process.env.AI_GM_LLM_MAX_TOKENS;
  delete process.env.AI_GM_LLM_TEMPERATURE;
  delete process.env.AI_GM_LLM_TIMEOUT;
});

// --- response_format option ---
console.log('\n--- response_format option ---');

test('_sendOpenAIRequest includes response_format when provided', async () => {
  let bodyUsed = null;
  global.fetch = async (_url, opts) => {
    bodyUsed = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }),
    };
  };
  const c = new LLMClient({ provider: 'openai', apiKey: 'k', baseUrl: 'http://127.0.0.1:59999' });
  await c._sendOpenAIRequest([], { ...c.config, responseFormat: { type: 'json_object' } });
  assert(bodyUsed.response_format.type === 'json_object', 'Expected response_format in body');
  restoreFetch();
});

// Wait for any pending abort timers to fire before restoring fetch
await new Promise((r) => setTimeout(r, 50));
restoreFetch();

// Summary
console.log('\n=== LLM Client Extended Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Status: ${failCount === 0 ? '✅ All tests passed' : '❌ Some tests failed'}`);

process.exit(failCount > 0 ? 1 : 0);
