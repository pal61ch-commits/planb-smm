#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const INDEXNOW_ENDPOINT = 'https://yandex.com/indexnow';
export const INDEXNOW_KEY_FILENAME =
  'edc822d7d824386d59a1151abfd25c44cd4a4998f236ee2779572cff7d8891fe.txt';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const MAX_URLS = 10_000;
const MAX_URL_LENGTH = 2_048;
const REQUEST_TIMEOUT_MS = 10_000;

const usage = `Usage:
  node scripts/yandex-indexnow.mjs [--send] <https-url> [<https-url> ...]
  node scripts/yandex-indexnow.mjs [--send] --file <newline-delimited-urls.txt>

The default is a dry run: the validated JSON payload is printed and no network
request is made. --send first verifies the deployed key file, then submits the
batch to ${INDEXNOW_ENDPOINT}.
`;

export function validateHost(rawHost) {
  if (typeof rawHost !== 'string') {
    throw new Error('CNAME must contain a hostname');
  }

  const host = rawHost.trim().toLowerCase();

  if (!host) {
    throw new Error('CNAME is empty');
  }

  let parsed;
  try {
    parsed = new URL(`https://${host}`);
  } catch {
    throw new Error(`Invalid host in CNAME: ${rawHost.trim()}`);
  }

  if (
    parsed.hostname !== host ||
    parsed.host !== host ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(`CNAME must contain one hostname only: ${rawHost.trim()}`);
  }

  return host;
}

export function validateKey(rawKey, filename = INDEXNOW_KEY_FILENAME) {
  if (typeof rawKey !== 'string') {
    throw new Error('IndexNow key must be a string');
  }

  const key = rawKey.trim();
  const basename = path.basename(filename);

  if (!/^[0-9a-f]{32,128}$/i.test(key)) {
    throw new Error('IndexNow key must contain 32-128 hexadecimal characters');
  }

  if (basename !== `${key}.txt`) {
    throw new Error('IndexNow key filename must exactly match its contents');
  }

  return key;
}

export function parseUrlFile(contents) {
  return contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function validateUrls(rawUrls, expectedHost) {
  if (!Array.isArray(rawUrls)) {
    throw new Error('IndexNow URL list must be an array');
  }

  if (rawUrls.length === 0) {
    throw new Error('Provide at least one URL');
  }

  if (rawUrls.length > MAX_URLS) {
    throw new Error(`IndexNow accepts at most ${MAX_URLS} URLs per batch`);
  }

  const urls = rawUrls.map((rawUrl) => {
    if (typeof rawUrl !== 'string') {
      throw new Error('Every IndexNow URL must be a string');
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(`Invalid absolute URL: ${rawUrl}`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error(`URL must use HTTPS: ${rawUrl}`);
    }

    if (parsed.host !== expectedHost) {
      throw new Error(`URL must use host ${expectedHost}: ${rawUrl}`);
    }

    if (parsed.username || parsed.password) {
      throw new Error(`URL must not contain credentials: ${rawUrl}`);
    }

    if (parsed.hash) {
      throw new Error(`URL must not contain a fragment: ${rawUrl}`);
    }

    if (parsed.href.length > MAX_URL_LENGTH) {
      throw new Error(`URL must not exceed ${MAX_URL_LENGTH} characters: ${rawUrl}`);
    }

    return parsed.href;
  });

  return [...new Set(urls)];
}

export function buildPayload({ host, key, urls }) {
  const checkedHost = validateHost(host);
  const checkedKey = validateKey(key);
  const urlList = validateUrls(urls, checkedHost);

  return {
    host: checkedHost,
    key: checkedKey,
    keyLocation: `https://${checkedHost}/${INDEXNOW_KEY_FILENAME}`,
    urlList,
  };
}

export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('IndexNow payload must be an object');
  }

  const checkedPayload = buildPayload({
    host: payload.host,
    key: payload.key,
    urls: payload.urlList,
  });

  if (payload.keyLocation !== checkedPayload.keyLocation) {
    throw new Error('IndexNow keyLocation must match the canonical same-host key URL');
  }

  return checkedPayload;
}

export async function loadProjectConfig(projectRoot = PROJECT_ROOT) {
  const [rawHost, rawKey] = await Promise.all([
    readFile(path.join(projectRoot, 'CNAME'), 'utf8'),
    readFile(path.join(projectRoot, INDEXNOW_KEY_FILENAME), 'utf8'),
  ]);

  return {
    host: validateHost(rawHost),
    key: validateKey(rawKey),
  };
}

export async function verifyLiveKey(
  payload,
  { fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {},
) {
  const checkedPayload = validatePayload(payload);
  const response = await fetchImpl(checkedPayload.keyLocation, {
    method: 'GET',
    headers: { accept: 'text/plain' },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status !== 200) {
    throw new Error(
      `Live key verification failed: ${checkedPayload.keyLocation} returned HTTP ${response.status}`,
    );
  }

  const liveKey = (await response.text()).trim();
  if (liveKey !== checkedPayload.key) {
    throw new Error('Live key verification failed: deployed file contents do not match');
  }
}

export async function submitBatch(
  payload,
  { fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {},
) {
  const checkedPayload = validatePayload(payload);
  const response = await fetchImpl(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(checkedPayload),
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const responseBody = await response.text();

  if (response.status !== 200 && response.status !== 202) {
    const detail = responseBody.trim().slice(0, 300);
    throw new Error(
      `IndexNow submission failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }

  return { status: response.status, body: responseBody };
}

export async function execute(
  payload,
  {
    send = false,
    fetchImpl = globalThis.fetch,
    stdout = process.stdout,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = {},
) {
  const checkedPayload = validatePayload(payload);
  stdout.write(`${JSON.stringify(checkedPayload, null, 2)}\n`);

  if (!send) {
    stdout.write('DRY RUN: no network requests were made. Add --send to submit.\n');
    return { dryRun: true };
  }

  stdout.write(`Verifying live key: ${checkedPayload.keyLocation}\n`);
  await verifyLiveKey(checkedPayload, { fetchImpl, timeoutMs });
  stdout.write('Live key verified. Submitting batch to Yandex IndexNow.\n');
  const result = await submitBatch(checkedPayload, { fetchImpl, timeoutMs });
  stdout.write(`IndexNow response: HTTP ${result.status}\n`);
  return { dryRun: false, ...result };
}

export function parseArgs(argv) {
  const options = { send: false, help: false, file: null, urls: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--send') {
      options.send = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--file') {
      const filename = argv[index + 1];
      if (!filename) {
        throw new Error('--file requires a path');
      }
      if (options.file) {
        throw new Error('--file can only be used once');
      }
      options.file = filename;
      index += 1;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      options.urls.push(argument);
    }
  }

  return options;
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  const config = await loadProjectConfig();
  const fileUrls = options.file
    ? parseUrlFile(await readFile(path.resolve(options.file), 'utf8'))
    : [];
  const payload = buildPayload({
    ...config,
    urls: [...options.urls, ...fileUrls],
  });

  await execute(payload, { send: options.send });
}

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  runCli().catch((error) => {
    process.stderr.write(`Error: ${error.message}\n\n${usage}`);
    process.exitCode = 1;
  });
}
