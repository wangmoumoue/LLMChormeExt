function verifyOrInferPageType(input = {}) {
  const classification = input.classification || {};
  if (typeof classification.pageType === 'string' && classification.pageType.trim()) {
    return {
      pageType: classification.pageType.trim(),
      scores: classification.scores || {},
      reasons: Array.isArray(classification.reasons) ? classification.reasons : [],
      confidence: classification.confidence == null ? null : classification.confidence
    };
  }

  const pageContext = input.pageContext || {};
  const url = String(pageContext.url || '').toLowerCase();
  const title = String(pageContext.title || '').toLowerCase();
  const joined = `${url} ${title}`;

  if (/video|watch|play/.test(joined)) {
    return { pageType: 'video', scores: {}, reasons: ['backend inferred from url/title'], confidence: null };
  }
  if (/article|news|blog|post/.test(joined)) {
    return { pageType: 'article', scores: {}, reasons: ['backend inferred from url/title'], confidence: null };
  }
  if (/dashboard|admin|console|panel/.test(joined)) {
    return { pageType: 'dashboard', scores: {}, reasons: ['backend inferred from url/title'], confidence: null };
  }

  return { pageType: 'generic', scores: {}, reasons: ['backend fallback page type'], confidence: null };
}

module.exports = {
  verifyOrInferPageType
};
