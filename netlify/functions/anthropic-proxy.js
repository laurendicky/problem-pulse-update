// FILE: netlify/functions/anthropic-proxy.js

const allowedOrigins = [
  'https://minky.ai',
  'https://www.minky.ai',
  'https://problempop.io',
  'https://www.problempop.io',
  'http://localhost:8888',
];

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
        model: 'claude-sonnet-4-6',
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
