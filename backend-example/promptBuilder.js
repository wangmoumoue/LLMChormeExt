const ANALYSIS_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['placement', 'cards'],
  properties: {
    placement: {
      type: 'string',
      enum: ['top', 'bottom']
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
    'Use placement="top" for now unless there is a very strong reason to use "bottom".',
    'Return 3 to 5 cards.',
    'Each card must be useful, concise, and readable inside a browser page.',
    'Each card must always include an "items" field. Use an empty array if there are no bullet items.',
    'Do not output a "meta" field. The server will add metadata after validation.',
    'Prefer these card types when relevant: summary, context, highlights, risks, next-steps, selection.',
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
