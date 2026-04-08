const express = require('express');
const dotenv = require('dotenv');
const { analyzePageContext } = require('./llmClient');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'LLaMb LLM backend is running',
    analyzeEndpoint: `http://localhost:${PORT}/api/analyze-page`
  });
});

app.post('/api/analyze-page', async (req, res) => {
  const pageContext = req.body?.pageContext;

  if (!pageContext || typeof pageContext !== 'object') {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing pageContext object'
      }
    });
  }

  try {
    const startedAt = Date.now();
    const result = await analyzePageContext(pageContext);
    const latencyMs = Date.now() - startedAt;

    return res.json({
      placement: result.placement,
      cards: result.cards,
      meta: {
        ...result.meta,
        source: 'llm-backend',
        route: '/api/analyze-page',
        latencyMs
      }
    });
  } catch (error) {
    console.error('[LLaMb backend]', error);
    return res.status(502).json({
      error: {
        code: 'LLM_ANALYSIS_FAILED',
        message: error.message
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`LLaMb LLM backend running at http://localhost:${PORT}`);
  console.log(`Analyze endpoint: http://localhost:${PORT}/api/analyze-page`);
});
