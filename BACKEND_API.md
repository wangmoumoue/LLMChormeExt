# Backend API Contract

This document describes the backend endpoint used by the extension's new page-analysis flow.

## Overview

The extension now supports this pipeline:

1. `content.js` collects page context
2. `background.js` sends that context to your backend
3. Your backend calls an LLM
4. Your backend returns JSON cards
5. The extension renders those cards inside the page

## Endpoint

- Method: `POST`
- Content-Type: `application/json`
- Configured in extension settings as `Backend Analysis Endpoint`

Example:

```text
http://localhost:3000/api/analyze-page
```

## Request Body

The extension sends this payload:

```json
{
  "source": "llamb-extension",
  "pageContext": {
    "url": "https://example.com/article",
    "title": "Example Article",
    "selectedText": "Optional selected text",
    "markdownContent": "# Page content in markdown-like form",
    "pageSignals": {
      "hostStyle": {
        "fontFamily": "\"Helvetica Neue\", Arial, sans-serif",
        "textColor": "rgb(34, 34, 34)"
      },
      "structure": {
        "primaryTag": "article",
        "anchorCount": 4,
        "anchors": [
          {
            "anchorId": "anchor-1",
            "role": "title",
            "tagName": "h1",
            "label": "Example Article"
          }
        ]
      }
    },
    "pluginContent": "Optional plugin extracted content",
    "timestamp": "2026-04-07T09:00:00.000Z"
  }
}
```

## Request Field Notes

- `source`: constant string from the extension, useful for backend logging
- `pageContext.url`: current page URL
- `pageContext.title`: current page title
- `pageContext.selectedText`: current selected text if any
- `pageContext.markdownContent`: extracted page content from the extension
- `pageContext.pluginContent`: optional extra content from enabled plugins
- `pageContext.timestamp`: collection time

## Successful Response

Recommended shape:

```json
{
  "placement": {
    "mode": "anchor",
    "position": "after",
    "anchorId": "anchor-2",
    "label": "after the opening paragraph"
  },
  "renderHints": {
    "layout": "inline",
    "chrome": "blend",
    "emphasis": "medium",
    "tone": "Article notes"
  },
  "cards": [
    {
      "type": "summary",
      "title": "Page Summary",
      "content": "This page explains the project architecture and runtime flow."
    },
    {
      "type": "next-step",
      "title": "Suggested Next Steps",
      "content": "Focus on background.js, content.js, and storage-manager.js first.",
      "items": [
        "Read manifest.json",
        "Trace message flow",
        "Review context extraction"
      ]
    }
  ],
  "meta": {
    "model": "your-llm-name",
    "source": "backend",
    "latencyMs": 842
  }
}
```

## Response Field Notes

- `placement`: can be `top`, or an object telling the extension to place content near a returned anchor
- `renderHints`: model-chosen layout and chrome hints that the extension maps into safe native-looking styles
- `cards`: array rendered by the extension
- `cards[].type`: optional category badge
- `cards[].title`: required for best display
- `cards[].content`: primary card content, usually markdown/plain text
- `cards[].items`: optional list rendered under the card
- `meta`: optional flat object displayed above cards
- `pageContext.pageSignals`: front-end extracted structure and style hints for the model

## Accepted Fallback Shapes

The extension currently normalizes these backend responses too:

### Raw array

```json
[
  {
    "title": "Summary",
    "content": "..."
  }
]
```

### Single object

```json
{
  "title": "Summary",
  "content": "..."
}
```

If the backend returns a single object, the extension wraps it into one card automatically.

## Error Response

Recommended shape:

```json
{
  "error": {
    "code": "LLM_FAILED",
    "message": "Failed to generate analysis"
  }
}
```

The extension mainly relies on HTTP status plus response text, so returning a non-2xx status is important.

## Recommended Status Codes

- `200`: success
- `400`: invalid request body
- `401`: missing or invalid auth token
- `500`: backend/LLM failure
- `502`: upstream LLM provider failure

## Authentication

If you configure `Backend Auth Token` in the extension settings, the extension sends:

```text
Authorization: Bearer <token>
```

## Backend Implementation Tips

- Validate that `pageContext` exists
- Use `selectedText` when available to prioritize targeted analysis
- Truncate `markdownContent` before calling your LLM if needed
- Always return a predictable `cards` array
- Keep `meta` flat and short for cleaner UI

## Minimal Prompt Strategy

Typical backend prompt strategy:

1. System prompt: explain card schema and desired output
2. User input: pass URL, title, selected text, page content, plugin content
3. Ask the LLM to return structured JSON only

## Current Extension Integration Points

- Request source: [background.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/background.js)
- Page context source: [content.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/content.js)
- Settings source: [settings.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/settings.js)

## Local Testing

You can use the sample backend in:

- [backend-example/server.js](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/server.js)
- [backend-example/README.md](c:/Users/wang/Desktop/毕设/code/LLaMbChromeExt/code/LLaMbChromeExt/backend-example/README.md)

That backend now supports:

- OpenAI official API
- OpenAI-compatible relay/gateway URLs
- strict JSON prompting
- one automatic retry when the model returns invalid JSON
