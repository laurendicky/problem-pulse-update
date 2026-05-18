// FILE: netlify/functions/analyze-problems.js
// ONLY CHANGES:
//   1. OPENAI_API_KEY -> ANTHROPIC_API_KEY in destructure
//   2. OpenAI fetch call replaced with Anthropic fetch call
//   3. Response parsing updated: data.content[0].text instead of data.choices[0].message.content
// Everything else (logic, structure, prompts, helpers) is untouched.

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT, ANTHROPIC_API_KEY } = process.env;

// --- All helper functions are now self-contained in this server file ---
const stopWords = ["a","about","above","after","again","against","all","am","an","and","any","are","as","at","be","because","been","before","being","below","between","both","but","by","can't","cannot","could","did","do","does","doing","don't","down","during","each","few","for","from","further","had","has","have","having","he","her","here","hers","herself","him","himself","his","how","i","if","in","into","is","it","its","itself","let's","me","more","most","my","myself","no","nor","not","of","off","on","once","only","or","other","ought","our","ours","ourselves","out","over","own","same","she","should","so","some","such","than","that","the","their","theirs","them","themselves","then","there","these","they","this","those","through","to","too","under","until","up","very","was","we","were","what","when","where","which","while","who","whom","why","with","would","you","your","yours","yourself","yourselves","like","just","dont","can","people","help","really","even","know","still"];
function deduplicatePosts(e){const t=new Set;return e.filter(e=>{return!(!e.data||!e.data.id)&&!t.has(e.data.id)&&(t.add(e.data.id),!0)})}
async function getRedditToken(){const e=Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64");const t=await fetch("https://www.reddit.com/api/v1/access_token",{method:"POST",headers:{Authorization:`Basic ${e}`,"Content-Type":"application/x-www-form-urlencoded","User-Agent":REDDIT_USER_AGENT},body:"grant_type=client_credentials"});if(!t.ok)throw new Error("Failed to retrieve Reddit API token");return(await t.json()).access_token}
async function fetchRedditForTermWithPagination(e,t,r,n="all"){let o=[],s=null;try{for(;o.length<r;){const r=`( ${t} ) ${e}`,a=`https://oauth.reddit.com/search?q=${encodeURIComponent(r)}&limit=25&t=${n}&sort=relevance${s?`&after=${s}`:""}`,i=await fetch(a,{headers:{Authorization:`Bearer ${await getRedditToken()}`,"User-Agent":REDDIT_USER_AGENT}});if(!i.ok)break;const l=await i.json();if(!l.data||!l.data.children||!l.data.children.length)break;if(o=o.concat(l.data.children),s=l.data.after,!s)break}}catch(c){}return o.slice(0,r)}
async function fetchMultipleRedditDataBatched(e,t,r=100,n="all"){const o=[];for(let s=0;s<t.length;s+=8){const a=t.slice(s,s+8),i=a.map(t=>fetchRedditForTermWithPagination(t,e,r,n)),l=await Promise.all(i);l.forEach(e=>{Array.isArray(e)&&o.push(...e)}),s+8<t.length&&await new Promise(e=>setTimeout(e,500))}return deduplicatePosts(o)}
function filterPosts(e,t=20){return e.filter(e=>{const r=e.data.title.toLowerCase(),n=e.data.selftext||"";return!r.includes("[ad]")&&!r.includes("sponsored")&&!(e.data.upvote_ratio<.2)&&!(e.data.ups<t)&&!!(n&&n.length>=100)})}
function getTopKeywords(e,t=10){const r={};return e.forEach(e=>{const n=(e.data.title+" "+e.data.selftext).replace(/<[^>]+>/g,"").replace(/[^a-zA-Z0-9\s.,!?]/g,"").toLowerCase().replace(/\s+/g," ").trim().split(/\s+/);n.forEach(e=>{stopWords.includes(e)||e.length<=2||(r[e]=(r[e]||0)+1)})}),Object.keys(r).sort((e,t)=>r[t]-r[e]).slice(0,t)}
function getFirstTwoSentences(e){if(!e)return"";const t=e.match(/[^\.!\?]+[\.!\?]+(?:\s|$)/g);return t?t.slice(0,2).join(" ").trim():e}

exports.handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
        const topPosts = filteredPosts.slice(0, 30); // Use a safe number of posts
        const combinedTexts = topPosts.map(post => `${post.data.title}. ${getFirstTwoSentences(post.data.selftext)}`).join("\n\n");

        // Step 4: Call Anthropic for analysis
        const prompt = `You are a helpful assistant that summarizes user-provided text into between 1 and 5 core common struggles and provides authentic quotes.\n\nYour task is to analyze the provided text about the niche "${originalGroupName}" and identify 1 to 5 common problems. You MUST provide your response in a strict JSON format. The JSON object must have a single top-level key named "summaries". The "summaries" key must contain an array of objects. Each object in the array represents one common problem and must have the following keys: "title", "body", "count", "quotes", and "keywords". Here are the top keywords to guide your analysis: [${topKeywords.join(', ')}]. Make sure the niche "${originalGroupName}" is naturally mentioned in each "body". Example format: { "summaries": [ { "title": "Example", "body": "Example body", "count": 50, "quotes": ["Quote A"], "keywords": ["keyword1"] } ] }. Here is the text to analyze: \`\`\`${combinedTexts}\`\`\``;

        const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 1500,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!anthropicResponse.ok) {
            const errorBody = await anthropicResponse.json();
            console.error("Anthropic Error:", errorBody);
            throw new Error('Anthropic summary generation failed.');
        }

        const anthropicData = await anthropicResponse.json();
        const aiResponseContent = anthropicData.content[0].text;

        // Step 5: Send the final, clean JSON back to the browser
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: aiResponseContent
        };

    } catch (err) {
        console.error("Error in analyze-problems function:", err);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: err.message })
        };
    }
};
