# Backend Example

This backend is now a real LLM-powered service built with Node.js + Express.

It supports OpenAI-compatible APIs, which means it can usually work with:

- OpenAI official API
- relay/gateway services
- OpenAI-compatible middle platforms
- some model routers that expose `/chat/completions`

## Added Modules

- [promptBuilder.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/promptBuilder.js)
- [llmClient.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/llmClient.js)
- [responseValidator.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/responseValidator.js)

## What the backend does

1. Accepts `POST /api/analyze-page`
2. Reads `pageContext`
3. Builds a strict JSON prompt
4. Calls your LLM endpoint
5. Parses and validates JSON
6. Retries once if JSON is invalid
7. Returns normalized cards JSON to the extension

## Environment Variables

Copy [\.env.example](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/.env.example) to `.env` and fill it in.

### Required

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL`

### Optional

- `PORT`
- `LLM_TIMEOUT_MS`
- `LLM_CONNECT_TIMEOUT_MS`
- `LLM_TEMPERATURE`
- `LLM_PROXY_URL`
- `LLM_EXTRA_HEADERS_JSON`

## Example `.env`

```env
PORT=3000
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-xxxx
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=45000
LLM_CONNECT_TIMEOUT_MS=15000
LLM_TEMPERATURE=0.1
```

### Relay / gateway example

```env
PORT=3000
LLM_BASE_URL=https://your-relay.example.com/v1
LLM_API_KEY=relay_token_here
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=45000
LLM_TEMPERATURE=0.1
```

If your provider requires extra headers, use:

```env
LLM_EXTRA_HEADERS_JSON={"HTTP-Referer":"https://your-site.example","X-Title":"LLaMb Analyzer"}
```

### Proxy support

The backend now supports outbound proxying explicitly.

- It will use `LLM_PROXY_URL` first when set
- Otherwise it will fall back to `HTTPS_PROXY`, `HTTP_PROXY`, or `ALL_PROXY`
- `NO_PROXY` is respected for proxy bypass

Example:

```env
LLM_PROXY_URL=http://127.0.0.1:7890
```

## Local Run

```bash
cd backend-example
npm install
copy .env.example .env
```

Then edit `.env`, and start:

```bash
npm start
```

## Extension Configuration

In the extension settings:

- `Backend Analysis Endpoint`: `http://localhost:3000/api/analyze-page`
- `Backend Auth Token`: leave empty unless your backend adds its own auth layer
- `Use Mock Analysis`: off

## Full Integration Steps

1. Start the backend:

```bash
cd backend-example
npm install
npm start
```

2. Refresh the Chrome extension in `chrome://extensions/`

3. Open the extension settings and confirm:

- backend endpoint is `http://localhost:3000/api/analyze-page`
- mock analysis is disabled

4. Open any webpage

5. Click the extension popup button `Analyze Current Page`

6. The extension will:

- collect page context in [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)
- send it through [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)
- call this backend
- render validated analysis cards back into the page

## Validation Behavior

The backend requires the LLM to return JSON matching the expected card schema.

If the model returns invalid JSON:

1. the backend parses and validates it
2. if invalid, it retries one more time
3. if it still fails, the backend returns `502`

## Notes

- The backend currently uses the OpenAI-compatible `chat/completions` route
- This is the safest default if you want compatibility with middle-layer providers
- If your relay is OpenAI-compatible, this should usually work without major changes
