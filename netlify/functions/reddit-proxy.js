// FILE: netlify/functions/reddit-proxy.js

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function getRedditToken() {
    const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT } = process.env;
    
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USER_AGENT) {
        throw new Error('Missing Reddit environment variables. Check Netlify env settings.');
    }
    
    const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': REDDIT_USER_AGENT
        },
        body: 'grant_type=client_credentials'
    });
    
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Reddit Token Error:", errorBody);
        throw new Error(`Failed to retrieve Reddit API token. Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.access_token;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    try {
        const { REDDIT_USER_AGENT } = process.env;
        const body = JSON.parse(event.body);
        const token = await getRedditToken();
        let url;

        if (body.type === 'about') {
            if (!body.subreddit) throw new Error("A 'subreddit' name is required for 'about' details.");
            url = `https://oauth.reddit.com/r/${body.subreddit}/about`;
        } else if (body.type === 'comments') {
            if (!body.postId) throw new Error("A 'postId' is required for fetching comments.");
            url = `https://oauth.reddit.com/comments/${body.postId}?limit=500&depth=10`;
        } else if (body.searchTerm) {
            const { searchTerm, niche, limit, timeFilter, after } = body;
            const query = encodeURIComponent(`( ${niche} ) ${searchTerm}`);
            url = `https://oauth.reddit.com/search?q=${query}&limit=${limit}&t=${timeFilter}&sort=relevance`;
            if (after) {
                url += `&after=${after}`;
            }
        } else {
            throw new Error("Invalid request payload.");
        }
        
        const redditResponse = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'User-Agent': REDDIT_USER_AGENT 
            }
        });

        if (!redditResponse.ok) {
            if (body.type === 'about') {
                return {
                    statusCode: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(null)
                };
            }
            const errorText = await redditResponse.text();
            console.error("Reddit API Error:", errorText);
            throw new Error(`Reddit API failed with status: ${redditResponse.status}`);
        }

        const data = await redditResponse.json();

        return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Proxy Error:', error.message);
        return {
            statusCode: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
