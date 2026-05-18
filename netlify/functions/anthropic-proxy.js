// FILE: netlify/functions/anthropic-proxy.js
// (renamed from openai-proxy.js)
// ONLY CHANGES:
//   1. Removed: const OpenAI = require('openai');
//   2. process.env.OPENAI_API_KEY -> process.env.ANTHROPIC_API_KEY
//   3. OpenAI SDK call replaced with fetch to Anthropic API
//   4. Response key kept as 'openaiResponse' so the frontend needs no changes
//   5. Strip markdown code fences from Claude's JSON responses before returning

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
  };
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    console.log(`[PROXY LOG] Origin is in whitelist. Granting access.`);
  } else {
    console.warn(`[PROXY LOG] Origin NOT in whitelist: ${origin}`);
  }
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (!allowedOrigins.includes(origin)) {
    return { statusCode: 403, headers, body: `Forbidden: Origin ${origin} is not allowed.` };
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
        max_tokens: openaiPayload.max_tokens || 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      const errorBody = await response.json();
      console.error('Error in Anthropic proxy function:', errorBody);
      throw new Error(errorBody.error?.message || 'Anthropic API call failed.');
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
    console.error('Error in Anthropic proxy function:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
