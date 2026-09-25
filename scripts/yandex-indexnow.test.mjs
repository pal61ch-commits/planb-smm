import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY_FILENAME,
  buildPayload,
  execute,
  loadProjectConfig,
  parseArgs,
  parseUrlFile,
  submitBatch,
  validateKey,
  validatePayload,
  validateUrls,
  verifyLiveKey,
} from './yandex-indexnow.mjs';

const key = INDEXNOW_KEY_FILENAME.replace(/\.txt$/u, '');
const host = 'planb-prodvizhenie.ru';

test('repository key filename and contents match', async () => {
  assert.deepEqual(await loadProjectConfig(), { host, key });
});

test('buildPayload accepts only same-host HTTPS URLs and removes duplicates', () => {
  assert.deepEqual(
    buildPayload({
      host,
      key,
      urls: [
        `https://${host}/new-page`,
        `https://${host}/new-page`,
        `https://${host}/updated-page?version=2`,
      ],
    }),
    {
      host,
      key,
      keyLocation: `https://${host}/${INDEXNOW_KEY_FILENAME}`,
      urlList: [
        `https://${host}/new-page`,
        `https://${host}/updated-page?version=2`,
      ],
    },
  );
});

test('URL validation rejects HTTP, another host, ports, credentials, and fragments', () => {
  const invalidUrls = [
    `http://${host}/page`,
    'https://example.com/page',
    `https://${host}:444/page`,
    `https://user:pass@${host}/page`,
    `https://${host}/page#section`,
  ];

  for (const invalidUrl of invalidUrls) {
    assert.throws(() => validateUrls([invalidUrl], host));
  }
});

test('URL validation enforces the 2,048 character IndexNow limit', () => {
  const prefix = `https://${host}/`;
  const atLimit = `${prefix}${'a'.repeat(2_048 - prefix.length)}`;
  const overLimit = `${atLimit}a`;

  assert.equal(validateUrls([atLimit], host)[0].length, 2_048);
  assert.throws(() => validateUrls([overLimit], host), /must not exceed 2048/u);
});

test('key validation requires 32+ hex characters and a matching filename', () => {
  assert.equal(validateKey(key), key);
  assert.throws(() => validateKey('abc123'));
  assert.throws(() => validateKey(`${key.slice(0, -1)}z`));
  assert.throws(() => validateKey(key, 'different.txt'));
});

test('URL files support blank lines and comments', () => {
  assert.deepEqual(
    parseUrlFile(`# changed pages\nhttps://${host}/one\n\n https://${host}/two \n`),
    [`https://${host}/one`, `https://${host}/two`],
  );
});

test('CLI arguments are dry-run by default and require explicit --send', () => {
  assert.deepEqual(parseArgs([`https://${host}/one`]), {
    send: false,
    help: false,
    file: null,
    urls: [`https://${host}/one`],
  });
  assert.equal(parseArgs(['--send', `https://${host}/one`]).send, true);
});

test('dry run never calls fetch', async () => {
  let fetchCalls = 0;
  const stdout = { write() {} };
  const payload = buildPayload({ host, key, urls: [`https://${host}/one`] });

  const result = await execute(payload, {
    stdout,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch must not be called during a dry run');
    },
  });

  assert.deepEqual(result, { dryRun: true });
  assert.equal(fetchCalls, 0);
});

test('live key verification requires HTTP 200 and exact key contents', async () => {
  const payload = buildPayload({ host, key, urls: [`https://${host}/one`] });
  let requestedUrl;

  await verifyLiveKey(payload, {
    fetchImpl: async (url, init) => {
      requestedUrl = url;
      assert.equal(init.method, 'GET');
      assert.equal(init.redirect, 'error');
      return new Response(`${key}\n`, { status: 200 });
    },
  });
  assert.equal(requestedUrl, payload.keyLocation);

  await assert.rejects(
    verifyLiveKey(payload, {
      fetchImpl: async () => new Response('wrong-key', { status: 200 }),
    }),
    /do not match/u,
  );

  await assert.rejects(
    verifyLiveKey(payload, {
      fetchImpl: async () => new Response('forbidden', { status: 403 }),
    }),
    /HTTP 403/u,
  );
});

test('batch submission uses the Yandex endpoint and JSON body', async () => {
  const payload = buildPayload({ host, key, urls: [`https://${host}/one`] });
  let request;

  const result = await submitBatch(payload, {
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response('', { status: 202 });
    },
  });

  assert.equal(request.url, INDEXNOW_ENDPOINT);
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(request.init.body), payload);
  assert.deepEqual(result, { status: 202, body: '' });
});

test('send mode verifies the live key before submitting', async () => {
  const payload = buildPayload({ host, key, urls: [`https://${host}/one`] });
  const calls = [];
  const stdout = { write() {} };

  const result = await execute(payload, {
    send: true,
    stdout,
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method });
      if (init.method === 'GET') {
        return new Response(key, { status: 200 });
      }
      return new Response('', { status: 200 });
    },
  });

  assert.deepEqual(calls, [
    { url: payload.keyLocation, method: 'GET' },
    { url: INDEXNOW_ENDPOINT, method: 'POST' },
  ]);
  assert.equal(result.dryRun, false);
  assert.equal(result.status, 200);
});

test('send mode does not submit when live key verification fails', async () => {
  const payload = buildPayload({ host, key, urls: [`https://${host}/one`] });
  const methods = [];
  const stdout = { write() {} };

  await assert.rejects(
    execute(payload, {
      send: true,
      stdout,
      fetchImpl: async (_url, init) => {
        methods.push(init.method);
        return new Response('stale-key', { status: 200 });
      },
    }),
    /do not match/u,
  );

  assert.deepEqual(methods, ['GET']);
});

test('network helpers revalidate payloads before making any request', async () => {
  const payload = buildPayload({ host, key, urls: [`https://${host}/one`] });
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    throw new Error('invalid payload must fail before fetch');
  };

  assert.throws(
    () => validatePayload({ ...payload, keyLocation: 'https://example.com/key.txt' }),
    /canonical same-host key URL/u,
  );
  await assert.rejects(
    verifyLiveKey(
      { ...payload, keyLocation: 'https://example.com/key.txt' },
      { fetchImpl },
    ),
    /canonical same-host key URL/u,
  );
  await assert.rejects(
    submitBatch(
      { ...payload, urlList: ['https://example.com/off-host'] },
      { fetchImpl },
    ),
    /must use host/u,
  );
  assert.equal(fetchCalls, 0);
});
