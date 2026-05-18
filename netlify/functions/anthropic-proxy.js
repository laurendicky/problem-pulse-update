// FILE: netlify/functions/anthropic-proxy.js

const allowedOrigins = [
  'https://minky.ai',
  'https://www.minky.ai',
  'https://problempop.io',
  'https://www.problempop.io',
  'http://localhost:8888',
];

// Map OpenAI model names from frontend to Anthropic equivalents
// 'gpt-4o-mini' (lightweight tasks) -> Haiku 4.5 (very fast, cheap)
// 'gpt-4o' (heavy tasks) -> Sonnet 4.6 (fast and capable)
function mapModel(openaiModel) {
  if (!openaiModel) return 'claude-sonnet-4-6';
  if (openaiModel.includes('mini')) return 'claude-haiku-4-5-20251001';
  return 'claude-sonnet-4-6';
}

exports.handler = async (event) => {
  const origin = event.headers.origin;
  console.log(`[PROXY LOG] Incoming request from origin: ${origin}`);
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '*',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Server configuration error: API key not set.');
    }
    const { openaiPayload } = JSON.parse(event.body);
    if (!openaiPayload) {
      throw new Error('Request body is missing openaiPayload.');
    }

    const model = mapModel(openaiPayload.model);
    console.log(`[PROXY LOG] Using model: ${model} (requested: ${openaiPayload.model})`);

    // Build a single prompt string from the OpenAI-style messages array
    const prompt = openaiPayload.messages
      .map(m => m.content)
      .join('\n\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: openaiPayload.max_tokens || 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Anthropic API Error Response:', errorBody);
      throw new Error(`Anthropic API failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    let text = data.content[0].text;

    // Strip markdown code fences that Claude sometimes wraps JSON in
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ openaiResponse: text }),
    };
  } catch (error) {
    console.error('Error in Anthropic proxy function:', error.message);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
