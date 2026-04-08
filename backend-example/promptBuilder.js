const { verifyOrInferPageType } = require('./pageClassifier');
const { buildStrategyPromptHints } = require('./strategyPlanner');

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

function buildMessages(input = {}) {
  const pageContext = input.pageContext || {};
  const classification = verifyOrInferPageType(input);
  const strategyHints = buildStrategyPromptHints(input.strategy, classification.pageType);

  const systemPrompt = [
    'You are a webpage analysis engine.',
    'You must return valid JSON only.',
    'Do not include markdown fences.',
    'Do not include explanations outside JSON.',
    'Follow the response schema exactly.',
    `The current pageType is "${classification.pageType}".`,
    `The current strategyId is "${strategyHints.strategyId}".`,
    `The content goal is "${strategyHints.contentGoal}".`,
    `Preferred render mode is "${strategyHints.renderMode}".`,
    'Use placement and renderHints so the injected block feels native to the page.',
    'Do not place the inserted block at the visual bottom of the page.',
    'Prefer an anchor-based placement when the page structure suggests a natural insertion point.',
    'When using anchor placement, choose an anchorId from pageContext.pageSignals.structure.anchors.',
    'Return exactly 1 card in simple Chinese.',
    'The card should briefly introduce what the current page is about, matching the pageType and strategy goal.',
    'For article pages, prefer a concise summary tone.',
    'For form pages, prefer guiding or clarifying language.',
    'For feed and video pages, prefer context-setting language.',
    'For dashboard and product pages, prefer structured and informative language.',
    'Each card must always include an items field. Use an empty array if there are no bullet items.',
    'Do not output raw HTML, CSS, or JS.',
    `Response JSON schema: ${JSON.stringify(ANALYSIS_RESPONSE_SCHEMA)}`
  ].join(' ');

  const userPayload = {
    task: 'Analyze this webpage context and return JSON that follows the schema exactly.',
    pageType: classification.pageType,
    strategy: strategyHints,
    classification,
    domFeatures: input.domFeatures || {},
    pageContext: {
      url: pageContext.url || '',
      title: pageContext.title || '',
      selectedText: truncateText(pageContext.selectedText || '', 1500),
      mainContent: truncateText(pageContext.mainContent || pageContext.markdownContent || '', 12000),
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
