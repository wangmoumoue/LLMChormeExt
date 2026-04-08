const { fetch, Agent, ProxyAgent } = require('undici');
const { buildMessages, ANALYSIS_RESPONSE_SCHEMA } = require('./promptBuilder');
const { parseJsonResponse, validateAnalysisResponse } = require('./responseValidator');

const dispatcherCache = new Map();

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function buildEndpoint(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function splitNoProxyList(value) {
  return String(value || '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);
}

function shouldBypassProxy(targetUrl) {
  const hostname = new URL(targetUrl).hostname.toLowerCase();
  const noProxyList = splitNoProxyList(process.env.NO_PROXY || process.env.no_proxy);

  return noProxyList.some(pattern => {
    if (pattern === '*') {
      return true;
    }

    const normalized = pattern.startsWith('.') ? pattern.slice(1) : pattern;
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

function getProxyUrl(targetUrl) {
  if (shouldBypassProxy(targetUrl)) {
    return null;
  }

  const { protocol } = new URL(targetUrl);
  const candidates = protocol === 'http:'
    ? [
        process.env.LLM_PROXY_URL,
        process.env.HTTP_PROXY,
        process.env.http_proxy,
        process.env.ALL_PROXY,
        process.env.all_proxy
      ]
    : [
        process.env.LLM_PROXY_URL,
        process.env.HTTPS_PROXY,
        process.env.https_proxy,
        process.env.HTTP_PROXY,
        process.env.http_proxy,
        process.env.ALL_PROXY,
        process.env.all_proxy
      ];

  return candidates.find(value => value && value.trim())?.trim() || null;
}

function getDispatcher(targetUrl) {
  const proxyUrl = getProxyUrl(targetUrl);
  const cacheKey = proxyUrl || 'direct';

  if (!dispatcherCache.has(cacheKey)) {
    dispatcherCache.set(
      cacheKey,
      proxyUrl
        ? new ProxyAgent(proxyUrl)
        : new Agent({
            connect: {
              timeout: parseInt(process.env.LLM_CONNECT_TIMEOUT_MS || '15000', 10)
            }
          })
    );
  }

  return dispatcherCache.get(cacheKey);
}

async function callChatCompletions(messages, attempt) {
  const baseUrl = getRequiredEnv('LLM_BASE_URL');
  const apiKey = getRequiredEnv('LLM_API_KEY');
  const model = getRequiredEnv('LLM_MODEL');
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '45000', 10);
  const endpoint = buildEndpoint(baseUrl);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (process.env.LLM_EXTRA_HEADERS_JSON) {
    const extraHeaders = JSON.parse(process.env.LLM_EXTRA_HEADERS_JSON);
    Object.assign(headers, extraHeaders);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = {
      model,
      messages,
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'page_analysis_cards',
          strict: true,
          schema: ANALYSIS_RESPONSE_SCHEMA
        }
      }
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      dispatcher: getDispatcher(endpoint)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM request failed on attempt ${attempt}: ${response.status} ${errorText}`.trim());
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new Error(`LLM response did not include string content on attempt ${attempt}`);
    }

    return {
      rawText: content,
      usage: payload.usage || null,
      model: payload.model || model
    };
  } finally {
    clearTimeout(timer);
  }
}

async function analyzePageContext(analysisInput) {
  const messages = buildMessages(analysisInput);
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await callChatCompletions(messages, attempt);
      const parsed = parseJsonResponse(result.rawText);
      const validated = validateAnalysisResponse(parsed);

      return {
        ...validated,
        meta: {
          ...validated.meta,
          model: result.model,
          retryCount: attempt - 1
        }
      };
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        break;
      }
    }
  }

  throw lastError || new Error('LLM analysis failed');
}

module.exports = {
  analyzePageContext
};
