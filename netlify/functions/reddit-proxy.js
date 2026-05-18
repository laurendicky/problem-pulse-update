// FILE: netlify/functions/analyze-problems.js
// All OpenAI API calls replaced with Anthropic Claude.
// claude-haiku-4-5 used for validation/data cleaning tasks.
// claude-sonnet-4-6 used for analysis and insight generation.

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT, ANTHROPIC_API_KEY } = process.env;

// --- All helper functions are self-contained in this server file ---
const stopWords = ["a","about","above","after","again","against","all","am","an","and","any","are","as","at","be","because","been","before","being","below","between","both","but","by","can't","cannot","could","did","do","does","doing","don't","down","during","each","few","for","from","further","had","has","have","having","he","her","here","hers","herself","him","himself","his","how","i","if","in","into","is","it","its","itself","let's","me","more","most","my","myself","no","nor","not","of","off","on","once","only","or","other","ought","our","ours","ourselves","out","over","own","same","she","should","so","some","such","than","that","the","their","theirs","them","themselves","then","there","these","they","this","those","through","to","too","under","until","up","very","was","we","were","what","when","where","which","while","who","whom","why","with","would","you","your","yours","yourself","yourselves","like","just","dont","can","people","help","really","even","know","still"];
function deduplicatePosts(e){const t=new Set;return e.filter(e=>{return!(!e.data||!e.data.id)&&!t.has(e.data.id)&&(t.add(e.data.id),!0)})}
async function getRedditToken(){const e=Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");const t=await fetch("https://www.reddit.com/api/v1/access_token",{method:"POST",headers:{Authorization:`Basic ${e}`,"Content-Type":"application/x-www-form-urlencoded","User-Agent":REDDIT_USER_AGENT},body:"grant_type=client_credentials"});if(!t.ok)throw new Error("Failed to retrieve Reddit API token");return(await t.json()).access_token}
async function fetchRedditForTermWithPagination(e,t,r,n="all"){let o=[],s=null;try{for(;o.length<r;){const r=`( ${t} ) ${e}`,a=`https://oauth.reddit.com/search?q=${encodeURIComponent(r)}&limit=25&t=${n}&sort=relevance${s?`&after=${s}`:""}`,i=await fetch(a,{headers:{Authorization:`Bearer ${await getRedditToken()}`,"User-Agent":REDDIT_USER_AGENT}});if(!i.ok)break;const l=await i.json();if(!l.data||!l.data.children||!l.data.children.length)break;if(o=o.concat(l.data.children),s=l.data.after,!s)break}}catch(c){}return o.slice(0,r)}
async function fetchMultipleRedditDataBatched(e,t,r=100,n="all"){const o=[];for(let s=0;s<t.length;s+=8){const a=t.slice(s,s+8),i=a.map(t=>fetchRedditForTermWithPagination(t,e,r,n)),l=await Promise.all(i);l.forEach(e=>{Array.isArray(e)&&o.push(...e)}),s+8<t.length&&await new Promise(e=>setTimeout(e,500))}return deduplicatePosts(o)}
function filterPosts(e,t=20){return e.filter(e=>{const r=e.data.title.toLowerCase(),n=e.data.selftext||"";return!r.includes("[ad]")&&!r.includes("sponsored")&&!(e.data.upvote_ratio<.2)&&!(e.data.ups<t)&&!!(n&&n.length>=100)})}
function getTopKeywords(e,t=10){const r={};return e.forEach(e=>{const n=(e.data.title+" "+e.data.selftext).replace(/<[^>]+>/g,"").replace(/[^a-zA-Z0-9\s.,!?]/g,"").toLowerCase().replace(/\s+/g," ").trim().split(/\s+/);n.forEach(e=>{stopWords.includes(e)||e.length<=2||(r[e]=(r[e]||0)+1)})}),Object.keys(r).sort((e,t)=>r[t]-r[e]).slice(0,t)}
function getFirstTwoSentences(e){if(!e)return"";const t=e.match(/[^\.!\?]+[\.!\?]+(?:\s|$)/g);return t?t.slice(0,2).join(" ").trim():e}

// --- Anthropic API helper ---
// Use claude-haiku-4-5 for fast validation/cleaning, claude-sonnet-4-6 for deep analysis.
async function callAnthropic(prompt, model = 'claude-sonnet-4-6', maxTokens = 1500) {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('Server configuration error: ANTHROPIC_API_KEY not set.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error('Anthropic API error:', errorBody);
        throw new Error(`Anthropic API error: ${errorBody.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

exports.handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    try {
        const { subredditQueryString, timeFilter, minUpvotes, originalGroupName, searchTerms } = JSON.parse(event.body);

        // Step 1: Fetch all posts from Reddit
        let allPosts = await fetchMultipleRedditDataBatched(subredditQueryString, searchTerms, 100, timeFilter);
        if (allPosts.length === 0) { throw new Error("No Reddit posts found."); }

        // Step 2: Filter posts
        const filteredPosts = filterPosts(allPosts, minUpvotes);
        if (filteredPosts.length < 10) { throw new Error("Not enough high-quality posts found."); }

        // Step 3: Prepare data for analysis
        const topKeywords = getTopKeywords(filteredPosts, 10);
        const topPosts = filteredPosts.slice(0, 30);
        const combinedTexts = topPosts.map(post => `${post.data.title}. ${getFirstTwoSentences(post.data.selftext)}`).join("\n\n");

        // Step 4a: Validation pass — use claude-haiku-4-5 (fast, cheap) to strip junk posts
        // This addresses the "irrelevant finding" / junk data problem from production.
        const validationPrompt = `You are a data cleaning assistant. Review the following list of Reddit post excerpts about the niche "${originalGroupName}". Remove any post that is clearly spam, nonsense, off-topic, or gibberish (e.g. random characters, unrelated content). Return ONLY the cleaned list with each post on a new line, preserving the original text of valid posts. Do not add commentary or numbering.

Posts to clean:
${combinedTexts}`;

        const cleanedTexts = await callAnthropic(validationPrompt, 'claude-haiku-4-5', 2000);

        // Step 4b: Analysis pass — use claude-sonnet-4-6 for deep insight generation
        const analysisPrompt = `Your task is to analyze the provided text about the niche "${originalGroupName}" and identify 1 to 5 common problems people face. You MUST provide your response in strict JSON format with no markdown, no code fences, no preamble — only raw JSON.

The JSON object must have a single top-level key named "summaries". The "summaries" key must contain an array of objects. Each object must have these keys: "title", "body", "count", "quotes", and "keywords".

Rules:
- "title": short problem title (max 8 words)
- "body": 2-3 sentence description that naturally mentions "${originalGroupName}"
- "count": estimated number of posts this problem appears in (integer)
- "quotes": array of 1-3 authentic short quotes from the text
- "keywords": array of 3-5 relevant keywords

Use these top keywords to guide your analysis: [${topKeywords.join(', ')}]

Text to analyze:
${cleanedTexts}`;

        const aiResponseText = await callAnthropic(analysisPrompt, 'claude-sonnet-4-6', 1500);

        // Strip any accidental markdown fences before parsing
        const cleanJson = aiResponseText.replace(/```json|```/g, '').trim();

        // Validate it parses correctly before sending
        JSON.parse(cleanJson);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: cleanJson,
        };

    } catch (err) {
        console.error("Error in analyze-problems function:", err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: err.message }),
        };
    }
};
