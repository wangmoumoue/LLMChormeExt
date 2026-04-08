function parseJsonResponse(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('LLM returned empty content');
  }

  const trimmed = rawText.trim();

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
      return JSON.parse(fencedMatch[1].trim());
    }
    throw new Error(`Invalid JSON from LLM: ${error.message}`);
  }
}

function assertString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertOptionalString(value, path) {
  if (value !== undefined && value !== null && (typeof value !== 'string' || value.trim() === '')) {
    throw new Error(`${path} must be a non-empty string when provided`);
  }
}

function validateAnalysisResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Response must be a JSON object');
  }

  let placement = payload.placement || 'top';
  if (typeof placement === 'string') {
    if (!['top'].includes(placement)) {
      throw new Error('placement must be "top"');
    }
  } else if (placement && typeof placement === 'object' && !Array.isArray(placement)) {
    const mode = String(placement.mode || 'flow').trim();
    const position = String(placement.position || 'top').trim();
    if (!['flow', 'anchor'].includes(mode)) {
      throw new Error('placement.mode must be "flow" or "anchor"');
    }
    if (!['top', 'middle', 'center', 'before', 'after'].includes(position)) {
      throw new Error('placement.position is invalid');
    }
    assertOptionalString(placement.anchorId, 'placement.anchorId');
    assertOptionalString(placement.label, 'placement.label');
    placement = {
      mode,
      position,
      anchorId: placement.anchorId ? placement.anchorId.trim() : '',
      label: placement.label ? placement.label.trim() : ''
    };
  } else {
    throw new Error('placement must be a string or object');
  }

  if (!Array.isArray(payload.cards) || payload.cards.length === 0) {
    throw new Error('cards must be a non-empty array');
  }

  const normalizedCards = payload.cards.map((card, index) => {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      throw new Error(`cards[${index}] must be an object`);
    }

    assertString(card.type, `cards[${index}].type`);
    assertString(card.title, `cards[${index}].title`);
    assertString(card.content, `cards[${index}].content`);

    const normalized = {
      type: card.type.trim(),
      title: card.title.trim(),
      content: card.content.trim(),
      items: []
    };

    if (!Array.isArray(card.items) || !card.items.every(item => typeof item === 'string')) {
      throw new Error(`cards[${index}].items must be an array of strings`);
    }

    normalized.items = card.items.map(item => item.trim()).filter(Boolean);

    return normalized;
  });

  let meta = {};
  if (payload.meta !== undefined) {
    if (!payload.meta || typeof payload.meta !== 'object' || Array.isArray(payload.meta)) {
      throw new Error('meta must be an object');
    }

    meta = Object.fromEntries(
      Object.entries(payload.meta).map(([key, value]) => [key, value == null ? null : String(value)])
    );
  }

  let renderHints = {};
  if (payload.renderHints !== undefined) {
    if (!payload.renderHints || typeof payload.renderHints !== 'object' || Array.isArray(payload.renderHints)) {
      throw new Error('renderHints must be an object');
    }

    const layout = payload.renderHints.layout == null ? '' : String(payload.renderHints.layout).trim();
    const chrome = payload.renderHints.chrome == null ? '' : String(payload.renderHints.chrome).trim();
    const emphasis = payload.renderHints.emphasis == null ? '' : String(payload.renderHints.emphasis).trim();
    const tone = payload.renderHints.tone == null ? '' : String(payload.renderHints.tone).trim();

    if (layout && !['grid', 'inline', 'stack', 'minimal'].includes(layout)) {
      throw new Error('renderHints.layout is invalid');
    }
    if (chrome && !['blend', 'bordered', 'ghost', 'callout'].includes(chrome)) {
      throw new Error('renderHints.chrome is invalid');
    }
    if (emphasis && !['low', 'medium', 'high'].includes(emphasis)) {
      throw new Error('renderHints.emphasis is invalid');
    }

    renderHints = {
      ...(layout ? { layout } : {}),
      ...(chrome ? { chrome } : {}),
      ...(emphasis ? { emphasis } : {}),
      ...(tone ? { tone } : {})
    };
  }

  return {
    placement,
    cards: normalizedCards,
    meta,
    renderHints
  };
}

module.exports = {
  parseJsonResponse,
  validateAnalysisResponse
};
