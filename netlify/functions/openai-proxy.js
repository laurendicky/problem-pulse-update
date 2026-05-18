// FILE: netlify/functions/anthropic-proxy.js
// Replaces openai-proxy.js — all OpenAI references removed.

const allowedOrigins = [
  'https://minky.ai',
  'https://www.minky.ai',
  'https://problempop.io',
  'https://www.problempop.io',
  'http://localhost:8888', // For `netlify dev`
];

exports.handler = async (event) => {
  const origin = event.headers.origin;

  console.log(`[PROXY LOG] Incoming request from origin: ${origin}`);

  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    console.log(`[PROXY LOG] Origin is in whitelist. Granting access.`);
  } else {
    console.warn(`[PROXY LOG] Origin NOT in whitelist: ${origin}`);
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Block non-whitelisted origins
  if (!allowedOrigins.includes(origin)) {
    return {
      statusCode: 403,
      headers,
      body: `Forbidden: Origin ${origin} is not allowed.`,
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Server configuration error: ANTHROPIC_API_KEY not set.');
    }

    // Expect the frontend to send a `prompt` string and optionally a `model`
    const { prompt, model } = JSON.parse(event.body);
    if (!prompt) {
      throw new Error('Request body is missing prompt.');
    }

    const anthropicModel = model || 'claude-sonnet-4-6';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('[PROXY LOG] Anthropic API error:', errorBody);
      throw new Error(`Anthropic API error: ${errorBody.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropicResponse: text }),
    };
  } catch (error) {
    console.error('[PROXY LOG] Error in Anthropic proxy function:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
