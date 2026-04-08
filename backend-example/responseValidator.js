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

function validateAnalysisResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Response must be a JSON object');
  }

  const placement = payload.placement || 'top';
  if (!['top', 'bottom'].includes(placement)) {
    throw new Error('placement must be "top" or "bottom"');
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

  return {
    placement,
    cards: normalizedCards,
    meta
  };
}

module.exports = {
  parseJsonResponse,
  validateAnalysisResponse
};
