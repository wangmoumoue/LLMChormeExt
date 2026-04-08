const DEFAULT_STRATEGY_BY_TYPE = {
  article: {
    strategyId: 'article-inline-summary',
    contentGoal: 'summary',
    renderMode: 'card',
    cardStyle: 'concise summary card'
  },
  feed: {
    strategyId: 'feed-midstream-card',
    contentGoal: 'context-note',
    renderMode: 'card',
    cardStyle: 'mid-stream context card'
  },
  form: {
    strategyId: 'form-context-help',
    contentGoal: 'guide',
    renderMode: 'compact-tip',
    cardStyle: 'small contextual helper'
  },
  product: {
    strategyId: 'product-side-note',
    contentGoal: 'highlight',
    renderMode: 'inline-block',
    cardStyle: 'detail-side note'
  },
  dashboard: {
    strategyId: 'dashboard-compact-panel',
    contentGoal: 'context-note',
    renderMode: 'banner',
    cardStyle: 'compact panel header'
  },
  video: {
    strategyId: 'video-context-card',
    contentGoal: 'context-note',
    renderMode: 'card',
    cardStyle: 'video context card'
  },
  generic: {
    strategyId: 'generic-fallback-card',
    contentGoal: 'summary',
    renderMode: 'card',
    cardStyle: 'generic summary card'
  }
};

function buildStrategyPromptHints(strategy, pageType) {
  const fallback = DEFAULT_STRATEGY_BY_TYPE[pageType] || DEFAULT_STRATEGY_BY_TYPE.generic;
  return {
    strategyId: strategy?.strategyId || fallback.strategyId,
    contentGoal: strategy?.contentGoal || fallback.contentGoal,
    renderMode: strategy?.renderMode || fallback.renderMode,
    cardStyle: fallback.cardStyle,
    explanation: Array.isArray(strategy?.explanation) ? strategy.explanation : []
  };
}

module.exports = {
  buildStrategyPromptHints
};
