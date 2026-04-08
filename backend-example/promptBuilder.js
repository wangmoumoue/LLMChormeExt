const ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['placement', 'renderHints', 'cards'],
  properties: {
    placement: {
      anyOf: [
        {
          type: 'string',
          enum: ['top']
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['mode', 'position', 'anchorId', 'label'],
          properties: {
            mode: {
              type: 'string',
              enum: ['flow', 'anchor']
            },
            position: {
              type: 'string',
              enum: ['top', 'middle', 'center', 'before', 'after']
            },
            anchorId: {
              type: ['string', 'null']
            },
            label: {
              type: ['string', 'null']
            }
          }
        }
      ]
    },
    renderHints: {
      type: 'object',
      additionalProperties: false,
      required: ['layout', 'chrome', 'emphasis', 'tone'],
      properties: {
        layout: {
          type: ['string', 'null'],
          enum: ['grid', 'inline', 'stack', 'minimal', null]
        },
        chrome: {
          type: ['string', 'null'],
          enum: ['blend', 'bordered', 'ghost', 'callout', null]
        },
        emphasis: {
          type: ['string', 'null'],
          enum: ['low', 'medium', 'high', null]
        },
        tone: {
          type: ['string', 'null']
        }
      }
    },
    cards: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'content', 'items'],
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }
};

function truncateText(text, maxLength) {
  const normalized = String(text || '').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function buildMessages(pageContext) {
  const systemPrompt = [
    'You are a webpage analysis engine.',
    'You must return valid JSON only.',
    'Do not include markdown fences.',
    'Do not include explanations outside JSON.',
    'Follow the response schema exactly.',
    'You may choose where the inserted block should appear so it feels native to the page.',
    'Do not place the inserted block at the visual bottom of the page.',
    'Prefer an anchor-based placement when the page structure suggests a natural insertion point.',
    'If pageContext.pageSignals.behavior.pageType is "dynamic-feed", avoid the feed stream and prefer a stable anchor near the top.',
    'When using anchor placement, choose an anchorId from pageContext.pageSignals.structure.anchors.',
    'Use renderHints to make the injected content feel like part of the host page rather than a floating widget.',
    'Because the response schema is strict, every field in placement objects and renderHints must always be present.',
    'When a field does not apply, set it to null instead of omitting it.',
    'Return 3 to 5 cards.',
    'Each card must be useful, concise, and readable inside a browser page.',
    'Each card must always include an "items" field. Use an empty array if there are no bullet items.',
    'Do not output a "meta" field. The server will add metadata after validation.',
    'Prefer these card types when relevant: summary, context, highlights, risks, next-steps, selection.',
    'Do not generate raw CSS, HTML, or JS.',
    'Design through placement and renderHints only.',
    `Response JSON schema: ${JSON.stringify(ANALYSIS_RESPONSE_SCHEMA)}`
  ].join(' ');

  const userPayload = {
    task: 'Analyze this webpage context and return JSON that follows the schema exactly.',
    pageContext: {
      url: pageContext.url || '',
      title: pageContext.title || '',
      selectedText: truncateText(pageContext.selectedText || '', 1500),
      markdownContent: truncateText(pageContext.markdownContent || '', 12000),
      pluginContent: truncateText(pageContext.pluginContent || '', 4000),
      pageSignals: pageContext.pageSignals || {},
      timestamp: pageContext.timestamp || ''
    }
  };

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(userPayload, null, 2) }
  ];
}

module.exports = {
  ANALYSIS_RESPONSE_SCHEMA,
  buildMessages
};
