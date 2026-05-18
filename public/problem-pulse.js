// ==================================================================
// FINAL SCRIPT WITH HIGHCHARTS SPLIT PACKED BUBBLE CHART (WITH CLICK
// ==================================================================

// --- 1. GLOBAL VARIABLES & CONSTANTS ---
const ANTHROPIC_PROXY_URL = 'https://problempop-anthropic.netlify.app/.netlify/functions/anthropic-proxy';
const REDDIT_PROXY_URL = 'https://problempop-anthropic.netlify.app/.netlify/functions/reddit-proxy';
const HARD_MIN_SUBSCRIBERS = 1000;
const HARD_MIN_ACTIVE_USERS = 0;
const LENIENT_MIN_SUBSCRIBERS = 500;
const LENIENT_MIN_ACTIVE_USERS = 0;
let originalGroupName = '';
let _allRankedSubreddits = [];

const suggestions = ["Dog Lovers", "Start-up Founders", "Fitness Frea
const positiveColors = ['#00a5ce', '#0090b5', '#00c0e6', '#7bd9ec', '
const negativeColors = ['#fd80c7', '#d6539d', '#ff4fa3', '#ff99d6', '
const lemmaMap = { 'needs': 'need', 'wants': 'want', 'loves': 'love',
const positiveWords = new Set(['love', 'amazing', 'awesome', 'beautif
const negativeWords = new Set(['angry', 'annoy', 'anxious', 'awful', 
const emotionalIntensityScores = { 'annoy': 3, 'irritated': 3, 'bored
const stopWords = ["a", "about", "above", "after", "again", "against"


// ==================================================================
// === ADD THIS MISSING HELPER FUNCTION TO YOUR SCRIPT ===
// ==================================================================
function generateNgrams(words, n) {
    const ngrams = [];
    if (n > words.length) {
        return ngrams;
    }
    for (let i = 0; i <= words.length - n; i++) {
        // This check prevents creating phrases from common words lik
        const ngramSlice = words.slice(i, i + n);
        if (!ngramSlice.some(word => stopWords.includes(word))) {
            ngrams.push(ngramSlice.join(' '));
        }
    }
    return ngrams;
}

// ==================================================================
// === NEW HELPER FUNCTION: classifySentimentWithAI (Add this to your
// ==================================================================
async function classifySentimentWithAI(posts) {
    const BATCH_SIZE = 25; // Process 25 posts per AI call to stay wi
    let allSentiments = [];

    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        const batch = posts.slice(i, i + BATCH_SIZE);
        const postsForAI = batch.map((p, index) => ({
            index: index,
            text: `Title: ${p.data.title || ''}. Body: ${(p.data.self
        }));

        const prompt = `You are a sentiment analysis engine. For each

        Example Response:
        { "sentiments": [ {"post_index": 0, "sentiment": "Positive"},

        Posts to analyze:
        ${JSON.stringify(postsForAI)}`;

        const openAIParams = {
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "You are a precise 
            temperature: 0,
            max_tokens: 1500,
            response_format: { "type": "json_object" }
        };

        try {
            const response = await fetch(ANTHROPIC_PROXY_URL, { metho
            if (response.ok) {
                const data = await response.json();
                const parsed = JSON.parse(data.openaiResponse);
                if (parsed.sentiments && Array.isArray(parsed.sentime
                    // Create a temporary map to easily align results
                    const sentimentMap = new Map(parsed.sentiments.ma
                    const batchSentiments = postsForAI.map(p => senti
                    allSentiments.push(...batchSentiments);
                }
            } else {
                 // If AI fails for a batch, classify all as Neutral 
                 allSentiments.push(...Array(batch.length).fill('Neut
            }
        } catch (error) {
            console.error("AI sentiment classification batch failed:"
            allSentiments.push(...Array(batch.length).fill('Neutral')
        }
    }
    return allSentiments;
}
// ==================================================================
// === NEW HELPER FUNCTION: generateSentimentContextWithAI (Add this 
// ==================================================================
async function generateSentimentContextWithAI(posts, brandName) {
    // Take a representative sample of up to 25 posts for the summary
    const samplePosts = posts.slice(0, 25);
    if (samplePosts.length === 0) {
        return { positive_theme: "", negative_theme: "", verdict: "No
    }

    const postsForAI = samplePosts.map(p => `"${(p.data.title || '')}

    const prompt = `You are a market research analyst. Below is a sam
    Your task is to provide a brief, insightful summary of the discus

    Respond ONLY with a valid JSON object with three keys:
    1.  "positive_theme": A single, short sentence describing the mai
    2.  "negative_theme": A single, short sentence describing the mai
    3.  "verdict": A single concluding sentence that explains the ove

    User Comments:
    ${postsForAI}`;

    const openAIParams = {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "You are a concise mark
        temperature: 0.1,
        max_tokens: 300,
        response_format: { "type": "json_object" }
    };

    try {
        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        if (response.ok) {
            const data = await response.json();
            return JSON.parse(data.openaiResponse);
        }
    } catch (error) {
        console.error("AI context generation failed:", error);
    }
    // Return a default object on failure
    return { positive_theme: "N/A", negative_theme: "N/A", verdict: "
}

function deduplicatePosts(posts) { const seen = new Set(); return pos
function formatDate(utcSeconds) { const date = new Date(utcSeconds * 
async function fetchRedditForTermWithPagination(niche, term, totalLim
async function fetchMultipleRedditDataBatched(niche, searchTerms, lim

// ==================================================================
// === ADD THIS NEW, AGGRESSIVE DE-DUPLICATION FUNCTION ===
// ==================================================================

/**
 * Aggressively de-duplicates posts and comments based on their conte
 * It creates a "signature" of the content to catch bots, copypasta, 
 * @param {Array} items - An array of Reddit post or comment objects.
 * @returns {Array} A new array with content-based duplicates removed
 */
// ==================================================================
// === REPLACE THE OLD FUNCTION WITH THIS NEW, HYPER-AGGRESSIVE VERSI
// ==================================================================

/**
 * Aggressively de-duplicates posts and comments based on a robust co
 * This version is designed to catch bots, copypasta, and quote-repli
 * @param {Array} items - An array of Reddit post or comment objects.
 * @returns {Array} A new array with content-based duplicates removed
 */
function deduplicateByContent(items) {
    const seenContentSignatures = new Set();
    const uniqueIds = new Set(); // Also track IDs to prevent acciden
    
    return items.filter(item => {
        const id = item.data.id;
        const content = (item.data.selftext || item.data.body || '').

        // If there's no content or we've already seen this exact ID,
        if (!content || uniqueIds.has(id)) {
            return false;
        }

        // Create a robust signature: lowercase, first 500 chars, all
        // This makes it very difficult for slightly reformatted copy
        const signature = content.substring(0, 500).toLowerCase().rep

        // We only consider very short comments (like "this" or "lol"
        // For longer comments, the signature is very reliable.
        if (signature.length < 20) {
            if (seenContentSignatures.has(content)) {
                return false; // For short comments, require an exact
            }
            seenContentSignatures.add(content);
        } else {
            if (seenContentSignatures.has(signature)) {
                return false; // For longer content, the signature is
            }
            seenContentSignatures.add(signature);
        }
        
        uniqueIds.add(id);
        return true;
    });
}
function parseAISummary(aiResponse) { try { aiResponse = aiResponse.r
function parseAIAssignments(aiResponse) { try { aiResponse = aiRespon
function filterPosts(posts, minUpvotes = 20) { return posts.filter(po
function getTopKeywords(posts, topN = 10) { const freqMap = {}; posts
function getFirstTwoSentences(text) { if (!text) return ''; const sen

async function assignPostsToFindings(summaries, posts) {
    const postsForAI = posts.slice(0, 50);
    const prompt = `You are an expert data analyst. Your task is to c
    const openAIParams = { model: "gpt-4o-mini", messages: [{ role: "
    try {
        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        if (!response.ok) throw new Error(`OpenAI API Error for assig
        const data = await response.json();
        return parseAIAssignments(data.openaiResponse);
    } catch (error) {
        console.error("Assignment function error:", error);
        return [];
    }
}
function calculateRelevanceScore(post, finding) { let score = 0; cons
function calculateFindingMetrics(validatedSummaries, filteredPosts) {

function renderPosts(posts) {
    const container = document.getElementById("posts-container");
    if (!container) {
        return;
    }
    container.innerHTML = posts.map(post => {
        const content = post.data.selftext || post.data.body || 'No a
        const title = post.data.title || post.data.link_title || 'Vie
        const num_comments = post.data.num_comments ? `| 💬 ${post.da
        
        // All inline styles have been removed and replaced with CSS 
        return `
            <div class="insight">
                <a href="https://www.reddit.com${post.data.permalink}
                    ${title}
                </a>
                <p class="insight-content">
                    ${content.substring(0, 200) + '...'}
                </p>
                <small class="insight-meta">
                    r/${post.data.subreddit} | 👍 ${post.data.ups.toL
                </small>
            </div>
        `;
    }).join('');
}

function showSamplePosts(summaryIndex, assignments, allPosts, usedPos
    if (!assignments) return;
    const finding = window._summaries[summaryIndex];
    if (!finding) return;

    let relevantPosts = [];
    const addedPostIds = new Set();

    const addPost = (post) => {
        if (post && post.data && !usedPostIds.has(post.data.id) && !a
            relevantPosts.push(post);
            addedPostIds.add(post.data.id);
        }
    };

    const assignedPostNumbers = assignments.filter(a => a.finding ===
    assignedPostNumbers.forEach(postNum => {
        if (postNum - 1 < window._postsForAssignment.length) {
            addPost(window._postsForAssignment[postNum - 1]);
        }
    });

    if (relevantPosts.length < 8) {
        const candidatePool = allPosts.filter(p => !usedPostIds.has(p
        const scoredCandidates = candidatePool.map(post => ({
            post: post,
            score: calculateRelevanceScore(post, finding)
        })).filter(item => item.score >= 4).sort((a, b) => b.score - 

        for (const candidate of scoredCandidates) {
            if (relevantPosts.length >= 8) break;
            addPost(candidate.post);
        }
    }

    let html;
    if (relevantPosts.length === 0) {
        // Replaced inline style with a class
        html = `<div class="no-posts-found">Could not find any highly
    } else {
        const finalPosts = relevantPosts.slice(0, 8);
        finalPosts.forEach(post => usedPostIds.add(post.data.id));
        html = finalPosts.map(post => {
            const content = post.data.selftext || post.data.body || '
            const title = post.data.title || post.data.link_title || 
            const num_comments = post.data.num_comments ? `| 💬 ${pos
            
            // Note: The sample posts use a slightly different class 
            // to allow for different styling than the main post list
            return `
                <div class="sample-insight">
                    <a href="https://www.reddit.com${post.data.permal
                        ${title}
                    </a>
                    <p class="sample-insight-content">
                        ${content.substring(0, 150) + '...'}
                    </p>
                    <small class="sample-insight-meta">
                        r/${post.data.subreddit} | 👍 ${post.data.ups
                    </small>
                </div>
            `;
        }).join('');
    }

    const container = document.getElementById(`reddit-div${summaryInd
    if (container) {
        container.innerHTML = `
            <div class="reddit-samples-header">Real Stories from Redd
            <div class="reddit-samples-posts">${html}</div>
        `;
    }
}

async function getRelatedSearchTermsAI(audience) {
    const prompt = `Given the target audience "${audience}", generate
    const openAIParams = { model: "gpt-4o-mini", messages: [{ role: "
    try {
        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        if (!response.ok) throw new Error('AI keyword generation fail
        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        return parsed.terms || [];
    } catch (error) {
        console.error("Error generating related search terms:", error
        return [];
    }
}
async function findSubredditsForGroup(groupName) {
    const relatedTerms = await getRelatedSearchTermsAI(groupName);
    const allTerms = [groupName, ...relatedTerms];
    const prompt = `Based on the following audience and related keywo
    const openAIParams = { model: "gpt-4o-mini", messages: [{ role: "
    try {
        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        if (!response.ok) throw new Error('OpenAI API request failed.
        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        if (!parsed.subreddits || !Array.isArray(parsed.subreddits)) 
        return parsed.subreddits;
    } catch (error) {
        console.error("Error finding subreddits:", error);
        alert("Sorry, I couldn't find any relevant communities. Pleas
        return [];
    }
}
async function fetchCommentsForPosts(postIds, batchSize = 5) {
    let allComments = [];
    console.log(`Fetching comments for ${postIds.length} posts...`);
    for (let i = 0; i < postIds.length; i += batchSize) {
        const batchIds = postIds.slice(i, i + batchSize);
        const batchPromises = batchIds.map(postId => {
            const payload = { type: 'comments', postId: postId };
            return fetch(REDDIT_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => res.json()).then(data => {
                if (Array.isArray(data) && data.length > 1 && data[1]
                    return data[1].data.children.filter(comment => co
                }
                return [];
            }).catch(err => {
                console.error(`Failed to fetch comments for post ${po
                return [];
            });
        });
        const results = await Promise.all(batchPromises);
        results.forEach(comments => allComments.push(...comments));
        if (i + batchSize < postIds.length) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    console.log(`Successfully fetched ${allComments.length} comments.
    return allComments;
}
function lemmatize(word) { if (lemmaMap[word]) return lemmaMap[word];
async function generateEmotionMapData(posts) { try { const topPostsTe

function renderEmotionMap(data) {
    const container = document.getElementById('emotion-map-container'
    if (!container) return;

    if (window.myEmotionChart) {
        window.myEmotionChart.destroy();
    }

    if (data.length < 3) {
        container.innerHTML = `
            <h3 class="dashboard-section-title">Problem Polarity Map<
            <p class="chart-placeholder-text">Not enough distinct pro
        `;
        return;
    }

    // HTML with classes instead of inline styles
    container.innerHTML = `
        <h3 class="dashboard-section-title">Problem Polarity Map</h3>
        <p id="problem-map-description" class="chart-description">Top
        <div id="emotion-map-wrapper">
            <div id="emotion-map">
                <canvas id="emotion-chart-canvas"></canvas>
            </div>
            <button id="chart-zoom-btn"></button>
        </div>
    `;

    const ctx = document.getElementById('emotion-chart-canvas')?.getC
    if (!ctx) return;

    const maxFreq = Math.max(...data.map(p => p.x));
    const allFrequencies = data.map(p => p.x);
    const minObservedFreq = Math.min(...allFrequencies);
    const collapsedMinX = 5;
    const isCollapseFeatureEnabled = minObservedFreq >= collapsedMinX
    const initialMinX = isCollapseFeatureEnabled ? collapsedMinX : 0;

    window.myEmotionChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Problems/Topics',
                data: data,
                backgroundColor: 'rgba(52, 152, 219, 0.9)',
                borderColor: 'rgba(41, 128, 185, 1)',
                borderWidth: 1,
                pointRadius: (context) => 5 + (context.raw.x / maxFre
                pointHoverRadius: (context) => 8 + (context.raw.x / m
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            return tooltipItems[0].raw.label;
                        },
                        label: function(context) {
                            return '';
                        },
                        afterBody: function(tooltipItems) {
                            const point = tooltipItems[0].raw;
                            return `Frequency: ${point.x}, Intensity:
                        }
                    },
                    displayColors: false,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    },
                    backgroundColor: '#ff7ce2',
                    titleColor: '#ffffff',
                    bodyColor: '#dddddd',
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Frequency (1-10)',
                        color: 'white',
                        font: {
                            weight: 'bold'
                        }
                    },
                    min: initialMinX,
                    max: 10,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.15)'
                    },
                    ticks: {
                        color: 'white'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Problem Intensity (1-10)',
                        color: 'white',
                        font: {
                            weight: 'bold'
                        }
                    },
                    min: 0,
                    max: 10,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.15)'
                    },
                    ticks: {
                        color: 'white'
                    }
                }
            }
        }
    });

    const zoomButton = document.getElementById('chart-zoom-btn');
    // This style is dynamic based on logic, so it's correct to keep 
    zoomButton.style.display = 'none';

    if (isCollapseFeatureEnabled) {
        zoomButton.style.display = 'block'; // Or 'inline-block', etc
        const updateButtonText = () => {
            const isCurrentlyCollapsed = window.myEmotionChart.option
            zoomButton.textContent = isCurrentlyCollapsed ? 'Zoom Out
        };

        zoomButton.addEventListener('click', () => {
            const chart = window.myEmotionChart;
            const isCurrentlyCollapsed = chart.options.scales.x.min !
            chart.options.scales.x.min = isCurrentlyCollapsed ? 0 : c
            chart.update('none');
            updateButtonText();
        });

        updateButtonText();
    }
}

// ==================================================================
// === REVISED HYBRID FUNCTION V5: DEFINITIVE UNIQUE POST COUNTING ==
// ==================================================================
async function generateAndRenderHybridSentiment(posts, audienceContex
    const positiveContainer = document.getElementById('positive-cloud
    const negativeContainer = document.getElementById('negative-cloud

    if (!positiveContainer || !negativeContainer) {
        console.error("Sentiment cloud containers not found.");
        return;
    }

    // Set a loading state (with headers removed)
    positiveContainer.innerHTML = `<p class="loading-text">Analyzing 
    negativeContainer.innerHTML = `<p class="loading-text">Analyzing 

    // --- PART 1: Word Counting (Corrected for unique posts) ---
    let positiveCount = 0, negativeCount = 0;
    const wordFreq = { positive: new Map(), negative: new Map() };

    posts.forEach(post => {
        const text = `${post.data.title || post.data.link_title || ''
selftext || post.data.body || ''}`.toLowerCase();
        const words = text.replace(/[^a-z\s']/g, '').split(/\s+/);
        
        const uniqueWordsInPost = { positive: new Set(), negative: ne

        words.forEach(rawWord => {
            if (rawWord.length < 3 || stopWords.includes(rawWord)) re
            const lemma = lemmatize(rawWord);
            if (positiveWords.has(lemma)) {
                uniqueWordsInPost.positive.add(lemma);
            } else if (negativeWords.has(lemma)) {
                uniqueWordsInPost.negative.add(lemma);
            }
        });

        uniqueWordsInPost.positive.forEach(word => {
            if (!wordFreq.positive.has(word)) wordFreq.positive.set(w
            wordFreq.positive.get(word).add(post);
        });
        uniqueWordsInPost.negative.forEach(word => {
            if (!wordFreq.negative.has(word)) wordFreq.negative.set(w
            wordFreq.negative.get(word).add(post);
        });
    });

    // Calculate total counts for the score bar based on all occurren
    posts.forEach(post => {
        const words = `${post.data.title || ''} ${post.data.selftext 
        words.forEach(word => {
            if (positiveWords.has(word)) positiveCount++;
            if (negativeWords.has(word)) negativeCount++;
        });
    });
    renderSentimentScore(positiveCount, negativeCount);


    // --- PART 2: SCRIPT-FIRST - Programmatically Find All Common Ph
    const phraseFreq = new Map();
    posts.forEach(post => {
        const text = `${post.data.title || ''} ${post.data.selftext |
        const words = text.split(/\s+/).filter(w => w.length > 0);
        const ngrams = [...generateNgrams(words, 2), ...generateNgram
        
        // ** THE CRITICAL FIX **
        // Get only the UNIQUE ngrams for this post before counting.
        const uniqueNgramsInPost = new Set(ngrams);

        uniqueNgramsInPost.forEach(ngram => {
            if (!phraseFreq.has(ngram)) phraseFreq.set(ngram, new Set
            phraseFreq.get(ngram).add(post); // Add the post to the s
        });
    });

    // The value is now a Set of posts, so we use its .size property 
    const candidatePhrases = Array.from(phraseFreq.entries())
        .filter(([_, postSet]) => postSet.size >= 2) // A phrase must
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 100)
        .map(item => item[0]);

    // --- PART 3: AI-FILTER (Unchanged) ---
    let finalPositivePhrases = [], finalNegativePhrases = [];
    if (candidatePhrases.length > 0) {
        try {
            const prompt = `You are a market research analyst. Below 
            const openAIParams = { model: "gpt-4o-mini", messages: [{
            const response = await fetch(ANTHROPIC_PROXY_URL, { metho
            if (response.ok) {
                const data = await response.json();
                const parsed = JSON.parse(data.openaiResponse);
                finalPositivePhrases = parsed.positive_phrases || [];
                finalNegativePhrases = parsed.negative_phrases || [];
            }
        } catch (error) { console.error("AI phrase filtering failed, 
    }

    // --- PART 4: Merge and Render (Now uses the correct counts) ---
    const renderCloud = (container, title, wordMap, phraseList, color
        const topWords = Array.from(wordMap.entries())
            .map(([word, postSet]) => [word, { count: postSet.size, p
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 23);
        
        const topPhrases = phraseList.map(phrase => {
            const postSet = phraseFreq.get(phrase);
            return [phrase, { count: postSet.size, posts: postSet }];
        }).filter(item => item[1]);

        const combinedData = [...topWords, ...topPhrases];
        
        const category = title.includes('Positive') ? 'positive' : 'n
        window._sentimentData = window._sentimentData || {};
        window._sentimentData[category] = Object.fromEntries(combined
        
        // MODIFIED CODE (FIX)
container.innerHTML = ''; // Clear the "loading..." text
const cloudContainer = document.createElement('div');
container.appendChild(cloudContainer); // This will now be the only c
        
        if (combinedData.length < 3) {
            cloudContainer.innerHTML = `<p style="font-family: sans-s
        }

        const counts = combinedData.map(item => item[1].count);
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);
        const minFontSize = 16, maxFontSize = 42;
        const cloudHTML = combinedData.map(([word, data]) => {
            const fontSize = minFontSize + ((data.count - minCount) /
            const color = colors[Math.floor(Math.random() * colors.le
            const rotation = Math.random() * 8 - 4;
            return `<span class="cloud-word" data-word="${word}" styl
        }).join('');
        cloudContainer.innerHTML = cloudHTML;
    };

    renderCloud(positiveContainer, 'Positive Words & Phrases', wordFr
    renderCloud(negativeContainer, 'Negative Words & Phrases', wordFr
}

function renderContextContent(word, posts) { const contextBox = docum
function showSlidingPanel(word, posts, category) { const positivePane
async function generateFAQs(posts) { const topPostsText = posts.slice
async function extractAndValidateEntities(posts, nicheContext) {
    const topPostsText = posts.slice(0, 50).map(p => {
        const title = p.data.title || p.data.link_title;
        const body = p.data.selftext || p.data.body || '';
        if (title) {
            return `Title: ${title}\nBody: ${body.substring(0, 800)}`
        }
        return `Body: ${body.substring(0, 800)}`;
    }).join('\n---\n');
    const prompt = `You are a market research analyst reviewing Reddi
    const openAIParams = { model: "gpt-4o-mini", messages: [{ role: "
    try {
        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        if (!response.ok) throw new Error('AI entity extraction faile
        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        const allEntities = { brands: parsed.brands || [], products: 
        window._entityData = {};
        for (const type in allEntities) {
            window._entityData[type] = {};
            allEntities[type].forEach(name => {
                const regex = new RegExp(`\\b${name.replace(/ /g, '\\
                const mentioningPosts = posts.filter(post => regex.te
                if (mentioningPosts.length > 0) {
                    window._entityData[type][name] = { count: mention
                }
            });
        }
        return {
            topBrands: Object.entries(window._entityData.brands || {}
            topProducts: Object.entries(window._entityData.products |
        };
    } catch (error) {
        console.error("Entity extraction error:", error);
        return { topBrands: [], topProducts: [] };
    }
}
// ==================================================================
// === ADD THIS MISSING CORE FUNCTION TO YOUR SCRIPT ===
// ==================================================================
async function enhanceDiscoveryWithComments(initialPosts, nicheContex
    console.log("Starting comment-based discovery enhancement...");
    try {
        // Fetch comments for the top 50 posts
        const postIds = initialPosts.slice(0, 50).map(p => p.data.id)
        const comments = await fetchCommentsForPosts(postIds);

        if (comments.length < 20) {
            console.log("Not enough comments found to enhance discove
            return;
        }

        // Deduplicate comments aggressively to remove bots/spam
        const uniqueComments = deduplicateByContent(comments);
        console.log(`Found ${uniqueComments.length} unique comments f

        // Use the same AI entity extraction on the comments
        const entitiesFromComments = await extractAndValidateEntities

        // Merge the new findings with the existing ones
        const { topBrands, topProducts } = entitiesFromComments;

        // This logic safely merges new entities from comments with e
        const mergeData = (existingData, newData) => {
            const combined = new Map();
            // Add existing data first
            Object.entries(existingData).forEach(([name, details]) =>
                combined.set(name, { ...details });
            });
            // Add or update with new data
            newData.forEach(([name, details]) => {
                if (combined.has(name)) {
                    const existing = combined.get(name);
                    existing.count += details.count;
                    // Simple de-duplication of posts array
                    const postIds = new Set(existing.posts.map(p => p
                    details.posts.forEach(p => {
                        if (!postIds.has(p.data.id)) {
                            existing.posts.push(p);
                            postIds.add(p.data.id);
                        }
                    });
                } else {
                    combined.set(name, { ...details });
                }
            });
            return Array.from(combined.entries());
        };

        const finalBrands = mergeData(window._entityData.brands || {}
        const finalProducts = mergeData(window._entityData.products |

        // Re-render the discovery lists with the combined and update
        renderDiscoveryList('top-brands-container', finalBrands, 'Top
        renderDiscoveryList('top-products-container', finalProducts, 
        console.log("Successfully enhanced discovery lists with comme

    } catch (error) {
        console.error("Failed to enhance discovery with comments:", e
    }
}

// ==================================================================
// === REPLACEMENT FUNCTION: renderDiscoveryList ===
// ==================================================================
function renderDiscoveryList(containerId, data, title, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let listItems = '<p class="discovery-list-placeholder">No signifi
    if (data.length > 0) {
        listItems = data.map(([name, details], index) => `
            <li class="discovery-list-item" data-word="${name}" data-
                <div class="discovery-item-info">
                    <span class="rank">${index + 1}.</span>
                    <span class="name">${name}</span>
                    <span class="count">${details.count} mentions</sp
                </div>
                <button class="brief-button">See Brief</button>
            </li>
        `).join('');
    }
    container.innerHTML = `<h3 class="dashboard-section-title">${titl
}


function renderFAQs(faqs) {
    const container = document.getElementById('faq-container');
    if (!container) return;

    // Replaced inline style with a class
    let faqItems = '<p class="faq-placeholder">Could not generate com

    if (faqs.length > 0) {
        faqItems = faqs.map((faq) => `
            <div class="faq-item">
                <button class="faq-question">${faq}</button>
                <div class="faq-answer">
                    <div class="faq-answer-content">
                        <em>This question was commonly found in discu
                    </div>
                </div>
            </div>
        `).join('');
    }

    container.innerHTML = `
        <h3 class="dashboard-section-title">Frequently Asked Question
        ${faqItems}
    `;

    // REFACTORED: JS now only toggles a class. CSS handles all anima
    container.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', () => {
            const faqItem = button.closest('.faq-item'); // Get the p
            faqItem.classList.toggle('active');
        });
    });
}

// ==================================================================
// === SUBREDDIT VALIDATION & DISPLAY FUNCTIONS ===
// ==================================================================
async function handleRemoveSubClick(event) {
    const button = event.target.closest('.remove-sub-btn');
    if (!button) return;

    const card = button.closest('.subreddit-tag-detailed');
    const destinationList = document.querySelector('#similar-subreddi

    if (card && destinationList) {
        const actionContainer = card.querySelector('.tag-footer-actio
        const subName = button.dataset.subname;
        const subDetailsString = button.dataset.subDetails || '{}';

        if (actionContainer && subName) {
            const newButton = document.createElement('button');
            newButton.className = 'add-related-sub-btn';
            newButton.dataset.subname = subName;
            newButton.dataset.subDetails = subDetailsString;
            newButton.textContent = '+ Add to Analysis';
            
            // REMOVED: The long style.cssText line is no longer need
            // The button's appearance is now handled entirely by the

            actionContainer.replaceChild(newButton, button);
            destinationList.prepend(card);
        }
    }

    const subName = button.dataset.subname;
    if (!subName) {
        console.error("Missing subreddit name on the 'Remove' button.
        return;
    }

    const checkbox = document.getElementById(`sub-${subName}`);
    if (checkbox) {
        checkbox.checked = false;
    }

    const countHeaderDiv = document.getElementById("count-header");
    if (countHeaderDiv) {
        countHeaderDiv.innerHTML = 'Updating analysis... <span class=
    }

    await runProblemFinder({ isUpdate: true });
}

async function fetchSubredditDetails(subredditName) {
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const payload = { type: 'about', subreddit: subredditName
            const response = await fetch(REDDIT_PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.status >= 500) { throw new Error(`Server err
            if (!response.ok) {
                console.warn(`Subreddit r/${subredditName} not found 
                return null;
            }
            const data = await response.json();
            return data && data.data ? data.data : null;
        } catch (error) {
            console.error(`Attempt ${attempt} failed for r/${subreddi
            if (attempt === MAX_RETRIES) { return null; }
            await new Promise(r => setTimeout(r, 200 * attempt));
        }
    }
    return null;
}
function formatMemberCount(num) {
    if (num === null || num === undefined) return 'N/A';
    if (num >= 1000000) { return (num / 1000000).toFixed(1).replace(/
    if (num >= 1000) { return (num / 1000).toFixed(1).replace(/\.0$/,
    return num.toLocaleString();
}
function getActivityLabel(activeUsers, totalMembers) {
    if (!totalMembers || totalMembers === 0 || activeUsers === null |
    const ratio = activeUsers / totalMembers;
    if (activeUsers > 5000 || (ratio > 0.01 && totalMembers > 1000)) 
    if (activeUsers < 10 || (totalMembers > 20000 && activeUsers < 50
    return '🌤️ Warm';
}
async function fetchAndRankSubreddits(subredditNames) {
    console.log(`AI suggested ${subredditNames.length} subreddits. Va
    const BATCH_SIZE = 5;
    let allDetails = [];
    for (let i = 0; i < subredditNames.length; i += BATCH_SIZE) {
        const batchNames = subredditNames.slice(i, i + BATCH_SIZE);
        const batchPromises = batchNames.map(name => fetchSubredditDe
        const batchResults = await Promise.all(batchPromises);
        allDetails.push(...batchResults.filter(Boolean));
    }
    const mapDetails = (details) => ({
        name: details.display_name,
        members: details.subscribers,
        activityLabel: getActivityLabel(details.active_user_count, de
        description: details.public_description || ''
    });
    let strictResults = allDetails.filter(d => d.subscribers >= HARD_
    if (strictResults.length < 10) {
        console.log(`Strict filter yielded only ${strictResults.lengt
        const lenientResults = allDetails.filter(d => d.subscribers >
        const strictResultNames = new Set(strictResults.map(r => r.na
        lenientResults.forEach(lenientSub => {
            if (!strictResultNames.has(lenientSub.name)) {
                strictResults.push(lenientSub);
            }
        });
    }
    const finalResults = strictResults.sort((a, b) => b.members - a.m
    console.log(`Found ${finalResults.length} valid communities. Read
    return finalResults;
}
function renderSubredditChoicesHTML(subreddits) {
    // The color logic has been moved to CSS. These objects are no lo
    return subreddits.map(sub => {
        // Extract the key word (e.g., "Hot", "Warm", "Cool") from th
        const activityState = sub.activityLabel.split(' ')[1];

        return `
            <div class="subreddit-choice">
                <input type="checkbox" id="sub-${sub.name}" value="${
                <label for="sub-${sub.name}">
                    <span class="sub-name">r/${sub.name}</span>
                    <span class="sub-pills">
                        <span class="pill members-pill">${formatMembe
                        
                        <!-- The inline style is replaced with a data
                        <span class="pill activity-pill" data-activit
                            ${sub.activityLabel}
                        </span>
                    </span>
                </label>
            </div>
        `;
    }).join('');
}
function displaySubredditChoices(rankedSubreddits) {
    const choicesDiv = document.getElementById('subreddit-choices');
    const loadMoreContainer = document.getElementById('load-more-cont
    if (!choicesDiv || !loadMoreContainer) return;

    loadMoreContainer.innerHTML = '';
    _allRankedSubreddits = rankedSubreddits;

    if (_allRankedSubreddits.length === 0) {
        // The class 'loading-text' is already used, which is good.
        // We will provide a specific style for it in the CSS.
        choicesDiv.innerHTML = '<p class="loading-text">No suitable c
        return;
    }

    const initialToShow = _allRankedSubreddits.slice(0, 8);
    choicesDiv.innerHTML = renderSubredditChoicesHTML(initialToShow);

    if (_allRankedSubreddits.length > 8) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'load-more-subs-btn';
        loadMoreBtn.className = 'load-more-button'; // Added a class 
        loadMoreBtn.textContent = 'Load More Communities';
        
        // REMOVED: The style.cssText line is now handled by the .loa

        loadMoreBtn.onclick = loadMoreSubreddits;
        loadMoreContainer.appendChild(loadMoreBtn);
    }
}

function loadMoreSubreddits() {
    const choicesDiv = document.getElementById('subreddit-choices');
    const loadMoreBtn = document.getElementById('load-more-subs-btn')
    if (!choicesDiv || !loadMoreBtn) return;
    const currentlyShownCount = choicesDiv.querySelectorAll('.subredd
    const nextBatch = _allRankedSubreddits.slice(currentlyShownCount,
    if (nextBatch.length > 0) {
        const newChoicesHTML = renderSubredditChoicesHTML(nextBatch);
        choicesDiv.insertAdjacentHTML('beforeend', newChoicesHTML);
    }
    const newTotalShown = choicesDiv.querySelectorAll('.subreddit-cho
    if (newTotalShown >= _allRankedSubreddits.length) {
        loadMoreBtn.remove();
    }
}
async function renderIncludedSubreddits(subreddits) {
    const container = document.getElementById('included-subreddits-co
    if (!container) return;

    // The initial loading state now uses CSS classes
    container.innerHTML = `
        <h3 class="dashboard-section-title">Analysis Based On</h3>
        <div class="subreddit-tag-list">
            <p class="placeholder-text">Loading community details...<
        </div>
    `;

    try {
        const detailPromises = subreddits.map(sub => fetchSubredditDe
        const detailsArray = await Promise.all(detailPromises);
        const tagsHTML = detailsArray.map((details, index) => {
            const subName = subreddits[index];
            const detailsString = details ? JSON.stringify(details).r

            if (!details) {
                // The error card now uses a modifier class for its u
                return `
                    <div class="subreddit-tag-detailed subreddit-tag-
                        <div class="tag-header">r/${subName}</div>
                        <div class="tag-body">Details could not be lo
                    </div>
                `;
            }

            const description = details.public_description || 'No pub
            const members = formatMemberCount(details.subscribers);
            const [activityEmoji, activityText] = getActivityLabel(de

            return `
                <div class="subreddit-tag-detailed">
                    <div>
                        <div class="tag-header">
                            <span class="tag-name">r/${subName}</span
                            <span class="tag-activity">${activityEmoj
                        </div>
                        <p class="tag-description">
                            ${description.substring(0, 150)}${descrip
                        </p>
                        <div class="tag-footer">
                            <span class="tag-members"><strong>${membe
                        </div>
                    </div>
                    <div class="tag-footer-action">
                        <button class="remove-sub-btn" data-subname="
                            Remove
                        </button>
                        <a href="https://www.reddit.com/r/${subName}"
                            View on Reddit
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <h3 class="dashboard-section-title">Analysis Based On</h3
            <div class="subreddit-tag-list">${tagsHTML}</div>
        `;
    } catch (error) {
        console.error("Error rendering subreddit details:", error);
        const tags = subreddits.map(sub => `<div class="subreddit-tag
        container.innerHTML = `
            <h3 class="dashboard-section-title">Analysis Based On</h3
            <div class="subreddit-tag-list">
                ${tags}
                <p class="error-message">Could not load community det
            </div>
        `;
    }
}
async function findRelatedSubredditsAI(analyzedSubsData, audienceCont
    const subNames = analyzedSubsData.map(d => d.name).join(', ');
    const prompt = `You are a Reddit discovery expert. A user is anal
    const openAIParams = { model: "gpt-4o-mini", messages: [{ role: "
    try {
        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        if (!response.ok) throw new Error('OpenAI related subreddits 
        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        if (!parsed.subreddits || !Array.isArray(parsed.subreddits)) 
        return parsed.subreddits;
    } catch (error) {
        console.error("Error finding related subreddits via AI:", err
        return [];
    }
}
async function handleAddRelatedSubClick(event) {
    if (!event.target.classList.contains('add-related-sub-btn')) retu

    const button = event.target;
    const subName = button.dataset.subname;
    const subDetailsJSON = button.dataset.subDetails;

    if (!subName || !subDetailsJSON) {
        console.error("Missing subreddit data on the 'Add' button.");
        return;
    }

    const card = button.closest('.subreddit-tag-detailed');
    const destinationList = document.querySelector('#included-subredd

    if (card && destinationList) {
        const actionContainer = card.querySelector('.tag-footer-actio
        if (actionContainer) {
            const newButton = document.createElement('button');
            newButton.className = 'remove-sub-btn';
            newButton.dataset.subname = subName;
            newButton.dataset.subDetails = subDetailsJSON;
            newButton.textContent = 'Remove';
            
            // REMOVED: The long style.cssText line is no longer need
            // The button's appearance is now handled entirely by the

            actionContainer.replaceChild(newButton, button);
            destinationList.prepend(card);
        }
    }

    try {
        const countHeaderDiv = document.getElementById("count-header"
        if (countHeaderDiv) {
            countHeaderDiv.innerHTML = 'Adding new audiences... <span
        }

        const currentSubTags = document.querySelectorAll('#included-s
        const currentSubs = Array.from(currentSubTags).map(tag => tag
        const newSubList = [...new Set([...currentSubs, subName])];

        const choicesDiv = document.getElementById('subreddit-choices
        let checkbox = document.getElementById(`sub-${subName}`);
        if (!checkbox && choicesDiv) {
            const subDetails = JSON.parse(subDetailsJSON);
            const newChoiceHTML = renderSubredditChoicesHTML([subDeta
            choicesDiv.insertAdjacentHTML('beforeend', newChoiceHTML)
        }

        const allCheckboxes = document.querySelectorAll('#subreddit-c
        allCheckboxes.forEach(cb => {
            cb.checked = newSubList.includes(cb.value);
        });

        await runProblemFinder({
            isUpdate: true
        });
    } catch (error) {
        console.error("Failed to add related sub and re-run analysis:
        alert("An error occurred while adding the community. Please t
    }
}
async function renderAndHandleRelatedSubreddits(analyzedSubs) {
    const container = document.getElementById('similar-subreddits-con
    if (!container) return;

    // The initial loading state now uses CSS classes
    container.innerHTML = `
        <h3 class="dashboard-section-title related-communities-title"
        <div class="subreddit-tag-list">
            <p class="placeholder-text">Finding similar communities..
        </div>
    `;

    container.removeEventListener('click', handleAddRelatedSubClick);
    container.addEventListener('click', handleAddRelatedSubClick);

    try {
        const detailPromises = analyzedSubs.map(sub => fetchSubreddit
        const detailsArray = await Promise.all(detailPromises);
        const validDetails = detailsArray.filter(Boolean).map(d => ({
        if (validDetails.length === 0) throw new Error("Could not get

        const relatedSubNames = await findRelatedSubredditsAI(validDe
        const newSubNames = relatedSubNames.filter(name => !analyzedS

        if (newSubNames.length === 0) {
            container.querySelector('.subreddit-tag-list').innerHTML 
            return;
        }

        const rankedRelatedSubs = await fetchAndRankSubreddits(newSub
        if (rankedRelatedSubs.length === 0) {
            container.querySelector('.subreddit-tag-list').innerHTML 
            return;
        }

        const tagsHTML = rankedRelatedSubs.slice(0, 10).map(sub => {
            const subDetailsString = JSON.stringify(sub).replace(/'/g
            const members = formatMemberCount(sub.members);
            const [activityEmoji, activityText] = sub.activityLabel.s
            const description = sub.description.trim() ? sub.descript
            
            return `
                <div class="subreddit-tag-detailed">
                    <div>
                        <div class="tag-header">
                            <span class="tag-name">r/${sub.name}</spa
                            <span class="tag-activity">${activityEmoj
                        </div>
                        <p class="tag-description">
                            ${description.substring(0, 150)}${descrip
                        </p>
                        <div class="tag-footer">
                            <span class="tag-members"><strong>${membe
                        </div>
                    </div>
                    <div class="tag-footer-action">
                        <button class="add-related-sub-btn" data-subn
                            + Add to Analysis
                        </button>
                        <a href="https://www.reddit.com/r/${sub.name}
                            View on Reddit
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelector('.subreddit-tag-list').innerHTML = ta
    } catch (error) {
        console.error("Error in renderAndHandleRelatedSubreddits:", e
        container.querySelector('.subreddit-tag-list').innerHTML = `<
    }
}

const briefCache = new Map();

async function generateAndRenderBrandBrief(itemName, itemType) {
    const isBrand = itemType === 'brands';
    const targetPanel = document.getElementById(isBrand ? 'brand-deta
    const overlay = document.getElementById('brief-overlay');

    if (!targetPanel || !overlay) {
        console.error("Brandscape detail panels or overlay not found 
        return;
    }

    document.querySelectorAll('.custom-side-panel.visible').forEach(p

    targetPanel.innerHTML = '<div class="brief-content"><p class="loa
    targetPanel.classList.add('visible');
    overlay.classList.add('visible');

    const close = () => {
        targetPanel.classList.remove('visible');
        overlay.classList.remove('visible');
    };
    overlay.onclick = close;

    if (briefCache.has(itemName)) {
        targetPanel.innerHTML = briefCache.get(itemName);
        if (targetPanel.querySelector('#brand-momentum-chart')) {
            const chartData = JSON.parse(targetPanel.querySelector('#
            renderBrandMomentumChart(chartData);
        }
        targetPanel.querySelector('.context-close-btn')?.addEventList
        return;
    }
    
    const postsForAnalysis = (window._entityData?.[itemType]?.[itemNa
    if (postsForAnalysis.length < 3) {
        const htmlContent = `
            <div class="brief-content">
                <button class="context-close-btn">×</button>
                <h3 class="brief-header">Analysis for: ${itemName}</h
                <p class="error-message" style="text-align: center; p
                    Not enough mentions found (minimum 3 required) to
                </p>
            </div>`;
        targetPanel.innerHTML = htmlContent;
        targetPanel.querySelector('.context-close-btn').addEventListe
        return;
    }

    try {
        const top75Posts = postsForAnalysis.slice(0, 75);
        const topPostsText = top75Posts.map(p => `"${p.data.title || 
    

        const prompt = isBrand ?
            `You are an expert market research analyst creating a com

            Respond ONLY with a valid JSON object with the following 
            1.  "what_it_is": A simple, one-line explanation of what 
            2.  "use_case": A single sentence describing the primary 
            3.  "loves": An array of 3 bullet points of key strengths
            4.  "hates": An array of 3 bullet points. CRITICAL: Frame
            5.  "verdict": A single, insightful sentence summarizing 
            `You are a market validation analyst creating a category 

            Respond ONLY with a valid JSON object with the following 
            1.  "what_it_is": A simple, one-line explanation of what 
            2.  "job_to_be_done": A single sentence describing the fu
            3.  "table_stakes": An array of 3 bullet points describin
            4.  "disruption_opportunities": An array of 3 bullet poin

        const openAIParams = { model: "gpt-4o", messages: [{ role: "s

        const briefPromise = fetch(ANTHROPIC_PROXY_URL, { method: 'PO

        const selectedSubreddits = Array.from(document.querySelectorA
        const subredditQueryString = selectedSubreddits.map(sub => `s

        const trendPromise = isBrand ? fetchSentimentTrendData(itemNa

        const [briefResult, trendResult] = await Promise.all([briefPr

        const parsed = JSON.parse(briefResult.openaiResponse);

        let htmlContent = '';
        if (isBrand) {
            const latestSentiment = trendResult && trendResult.length
            const trendlineText = latestSentiment ? `Trendline: Posit
            const mentionCount = window._entityData?.[itemType]?.[ite

            htmlContent = `
                <div class="brief-content">
                    <button class="context-close-btn">×</button>
                    <h3 class="brief-header">Competitive Brief: ${ite
                    
                    <!-- === NEW SECTION ADDED HERE === -->
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <p class="brief-text">${parsed.what_it_is}</p
                    </div>

                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <div id="brand-momentum-chart"></div>
                        <script type="application/json" id="brand-mom
                        <p class="brief-ai-insight">Based on ${mentio
                    </div>
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <p class="brief-text">${parsed.use_case}</p>
                    </div>
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <ul class="brief-list loves">${parsed.loves.m
                    </div>
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <ul class="brief-list hates">${parsed.hates.m
                    </div>
                    <div class="brief-verdict">
                        <p><strong>🔮 Verdict:</strong> ${parsed.verd
                    </div>
                </div>`;
        } else { // Generic Product
            htmlContent = `
                <div class="brief-content">
                    <button class="context-close-btn">×</button>
                    <h3 class="brief-header">Category Analysis: ${ite
                    
                    <!-- === NEW SECTION ADDED HERE === -->
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <p class="brief-text">${parsed.what_it_is}</p
                    </div>
                    
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <p class="brief-text">${parsed.job_to_be_done
                    </div>
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <ul class="brief-list stakes">${parsed.table_
                    </div>
                    <div class="brief-section">
                        <h4 class="brief-section-title"><span class="
                        <ul class="brief-list hates">${parsed.disrupt
                    </div>
                </div>`;
        }

        targetPanel.innerHTML = htmlContent;
        briefCache.set(itemName, htmlContent);

        if (isBrand && trendResult && trendResult.length > 0) {
            renderBrandMomentumChart(trendResult);
        }

        targetPanel.querySelector('.context-close-btn').addEventListe

    } catch (error) {
        console.error(`Failed to generate brief for ${itemName}:`, er
        targetPanel.innerHTML = `<div class="brief-content"><button c
        targetPanel.querySelector('.context-close-btn').addEventListe
    }
}

// ==================================================================
// === REPLACEMENT FUNCTION: renderBrandMomentumChart (V2 - With Cont
// ==================================================================
function renderBrandMomentumChart(data) {
    if (typeof Highcharts === 'undefined' || !data || data.length ===
        // Display a message if no data is available
        const chartContainer = document.getElementById('brand-momentu
        if (chartContainer) {
            chartContainer.innerHTML = '<p class="chart-placeholder-t
        }
        return;
    }

    Highcharts.chart('brand-momentum-chart', {
        chart: { type: 'line', backgroundColor: 'transparent' },
        title: { text: null },
        credits: { enabled: false },
        xAxis: { categories: data.map(d => d.period), labels: { style
        yAxis: { title: { text: '% Positive', style: { color: '#555' 
        legend: { enabled: false },
        series: [{
            name: '% Positive Sentiment',
            data: data.map(d => ({
                y: d.positivePercentage,
                context: d.context // Pass context to each point
            })),
            color: '#00a5ce'
        }],
        // --- KEY CHANGE: Replaced pointFormat with a more powerful 
        tooltip: {
            useHTML: true,
            backgroundColor: '#FFFFFF',
            borderColor: '#E0E0E0',
            borderWidth: 1,
            padding: 12,
            shape: 'square',
            shadow: { color: 'rgba(0, 0, 0, 0.1)', opacity: 1, offset
            formatter: function() {
                const context = this.point.options.context;
                if (!context) return 'No context available.';

                let html = `<div style="font-family: sans-serif; font
                html += `<b>${this.key}</b><br/>`;
                html += `<span style="color: ${this.series.color};">●
                html += `<hr style="margin: 6px 0; border-color: #f0f
                
                // === THIS IS THE FIX ===
                // Added 'white-space: normal;' and 'overflow-wrap: b
                html += `<div style="font-size: 12px; max-width: 250p

                if (context.positive_theme) {
                    html += `<div style="margin-bottom: 5px;"><span s
                }
                if (context.negative_theme) {
                    html += `<div style="margin-bottom: 5px;"><span s
                }
                html += `<div style="margin-top: 8px; font-style: ita

                html += `</div></div>`;
                return html;
            }
        }
    });
}

function renderSentimentScore(positiveCount, negativeCount) { const c

// ==================================================================
// === REPLACEMENT FUNCTION: fetchSentimentTrendData (V4 - With Conte
// ==================================================================
async function fetchSentimentTrendData(brandName, subredditQueryStrin
    let searchTerms = [`"${brandName}"`];
    if (brandName.toLowerCase() === 'openai') {
        searchTerms.push('"gpt-4o"', '"chatgpt"', '"gpt-5"');
    }

    const revisedTimePeriods = [
        { label: 'Past 6 Mos', value: '6month' },
        { label: 'Past 3 Mos', value: '3month' },
        { label: 'Last 30 Days', value: 'month' },
        { label: 'Last 7 Days', value: 'week' },
    ];

    const fetchPromises = revisedTimePeriods.map(period =>
        fetchMultipleRedditDataBatched(subredditQueryString, searchTe
    );
    const results = await Promise.allSettled(fetchPromises);

    const trendData = [];

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const periodLabel = revisedTimePeriods[i].label;

        if (result.status === 'fulfilled' && result.value.length > 0)
            const uniquePosts = deduplicatePosts(result.value);
            const sentimentResults = await classifySentimentWithAI(un
            
            // --- KEY CHANGE 1: Generate context for this time perio
            const contextSummary = await generateSentimentContextWith

            const positiveMentions = sentimentResults.filter(s => s =
            const negativeMentions = sentimentResults.filter(s => s =
            const totalMentions = positiveMentions + negativeMentions
            const positivePercentage = totalMentions > 0 ? Math.round

            trendData.push({
                period: periodLabel,
                positivePercentage: positivePercentage,
                context: contextSummary // Attach the context to the 
            });
        } else {
            console.warn(`Could not fetch data for period: ${periodLa
        }
    }

    // --- KEY CHANGE 2: REMOVED .reverse() TO FIX X-AXIS ORDER ---
    // The data is now naturally ordered from oldest to newest.
    return trendData;
}

async function generateAndRenderConstellation(items) {
    console.log("[Highcharts] Starting full generation process with b
    const prioritizedItems = items.sort((a, b) => (b.data.ups || 0) -
    console.log(`[Highcharts] Prioritized top ${prioritizedItems.leng

    const BATCH_SIZE = 10;
    const batchPromises = [];

    for (let i = 0; i < prioritizedItems.length; i += BATCH_SIZE) {
        const batch = prioritizedItems.slice(i, i + BATCH_SIZE);
        const batchStartIndex = i;

        const extractionPrompt = `You are a market research analyst. 

        const apiCallPromise = fetch(ANTHROPIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                openaiPayload: {
                    model: "gpt-4o-mini",
                    messages: [{ role: "system", content: "You are a 
                    temperature: 0.1,
                    max_tokens: 1500,
                    response_format: { "type": "json_object" }
                }
            })
        }).then(response => {
            if (!response.ok) throw new Error(`Batch from index ${bat
            return response.json();
        }).then(data => {
            const parsedExtraction = JSON.parse(data.openaiResponse);
            if (parsedExtraction.signals && Array.isArray(parsedExtra
                return parsedExtraction.signals.map(signal => ({
                    quote: signal.quote,
                    sourceItem: prioritizedItems[batchStartIndex + si
                })).filter(s => s.sourceItem);
            }
            return [];
        }).catch(error => {
            console.error(`[Highcharts] Error processing batch starti
            return [];
        });
        batchPromises.push(apiCallPromise);
    }
    
    const results = await Promise.allSettled(batchPromises);
    let rawSignals = [];
    results.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.val
            rawSignals.push(...result.value);
        }
    });

    console.log(`[Highcharts] AI extracted a total of ${rawSignals.le
    if (rawSignals.length === 0) {
        renderHighchartsBubbleChart([]);
        return;
    }

    const enrichedSignals = [];
    const validCategories = ["DemandSignals", "WillingnessToPay", "Fr
    for (const rawSignal of rawSignals) {
        try {
            const enrichmentPrompt = `You are a market research analy
            const enrichmentResponse = await fetch(ANTHROPIC_PROXY_UR
            if (enrichmentResponse.ok) {
                const enrichmentData = await enrichmentResponse.json(
                const parsedEnrichment = JSON.parse(enrichmentData.op
                if (parsedEnrichment.problem_theme && parsedEnrichmen
                    enrichedSignals.push({ ...rawSignal, ...parsedEnr
                } else { console.warn("Skipping a signal due to missi
            } else { console.warn(`Failed to enrich a signal. Status:
        } catch (error) { console.error("CRITICAL ERROR during indivi
    }

    console.log(`[Highcharts] AI successfully enriched ${enrichedSign
    renderHighchartsBubbleChart(enrichedSignals);
}

async function runConstellationAnalysis(subredditQueryString, demandS
    console.log("--- Starting Delayed Highcharts Chart Analysis (in b
    try {
        const demandSignalPosts = await fetchMultipleRedditDataBatche
        const postIds = demandSignalPosts.sort((a,b) => (b.data.ups |
        const highIntentComments = await fetchCommentsForPosts(postId
        const allItems = [...demandSignalPosts, ...highIntentComments
        await generateAndRenderConstellation(allItems);
    } catch (error) {
        console.error("Highcharts analysis failed in the background:"
        renderHighchartsBubbleChart([]);
    } finally {
        console.log("--- Highcharts Analysis Complete. ---");
    }
}

function renderHighchartsBubbleChart(signals) {
    const container = document.getElementById('constellation-map-cont
    const panelContent = document.getElementById('bubble-content'); /

    if (typeof Highcharts === 'undefined') {
        console.error("Highcharts is not loaded. Please ensure the Hi
        if (panelContent) panelContent.innerHTML = `<div class="panel
        return;
    }

    if (!signals || signals.length === 0) {
        if (panelContent) panelContent.innerHTML = `<div class="panel
        Highcharts.chart(container, { chart: { type: 'packedbubble' }
        return;
    }

    const aggregatedSignals = {};
    signals.forEach(signal => {
        if (!signal.problem_theme || !signal.source || !signal.catego
        const theme = signal.problem_theme.trim();
        if (!aggregatedSignals[theme]) {
            aggregatedSignals[theme] = { ...signal, quotes: [], frequ
        }
        aggregatedSignals[theme].quotes.push(signal.quote);
        aggregatedSignals[theme].frequency++;
        aggregatedSignals[theme].totalUpvotes += (signal.source.ups |
    });

    const groupedByCategory = new Map();
    Object.values(aggregatedSignals).forEach(d => {
        const category = d.category.replace(/([A-Z])/g, ' $1').trim()
        if (!groupedByCategory.has(category)) {
            groupedByCategory.set(category, []);
        }
        groupedByCategory.get(category).push({
            name: d.problem_theme,
            value: d.frequency,
            quote: d.quotes[0],
            source: d.source
        });
    });

    const chartSeries = Array.from(groupedByCategory, ([name, data]) 

    Highcharts.chart(container, {
        chart: {
            type: 'packedbubble',
            backgroundColor: 'transparent'
        },
        title: {
            text: null
        },
        credits: {
            enabled: false
        },
        tooltip: {
            useHTML: true,
            backgroundColor: '#FFFFFF',
            borderColor: '#E0E0E0',
            borderWidth: 1,
            shadow: {
                color: 'rgba(0, 0, 0, 0.15)',
                offsetX: 0,
                offsetY: 3,
                opacity: 1,
                width: 10
            },
            style: {
                color: '#333333',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
            },
            formatter: function () {
                return `
                    <div style="font-weight: bold; font-size: 1rem; m
                    <div style="font-size: 0.9rem; margin-bottom: 8px
                    <a href="https://www.reddit.com${this.point.optio
                `;
            }
        },
        plotOptions: {
            packedbubble: {
                minSize: '35%',
                maxSize: '140%',
                zMin: 0,
                zMax: 1000,
                layoutAlgorithm: {
                    splitSeries: true,
                    gravitationalConstant: 0.05,
                    seriesInteraction: false, 
                    dragBetweenSeries: true,
                    parentNodeLimit: true,
                    parentNodeOptions: {
                        bubblePadding: 3
                    }
                },
                dataLabels: {
                    enabled: true,
                    useHTML: true,
                    style: {
                        color: 'black',
                        textOutline: 'none',
                        fontWeight: 'normal',
                        fontFamily: "'Plus Jakarta Sans', sans-serif"
                        textAlign: 'center'
                    },
                    formatter: function() {
                        const radius = this.point.marker.radius;
                        if (this.point.name.length * 6 > radius * 1.8
                             return null;
                        }
                        const fontSize = Math.max(8, radius / 3.5);
                        return `<div style="font-size: ${fontSize}px;
                    }
                },
                // --- NEW FEATURE: Click Event Handler ---
                point: {
                    events: {
                        click: function() {
                            // isParentNode is true for the large cat
                            if (!this.isParentNode) {
                                const bubbleContent = document.getEle
                                if (bubbleContent) {
                                    const { name, quote, source } = t
                                    bubbleContent.innerHTML = `
                                    <h4 class="bubble-detail-title">$
                                    <p class="bubble-detail-quote">“$
                                    
                                    <!-- This is the new element for 
                                    <p class="bubble-detail-meta">r/$
                                    
                                    <!-- This is the modified link wi
                                    <a href="https://www.reddit.com${
                                        View on Reddit
                                    </a>
                                `;
                                
                                }
                            }
                        }
                    }
                }
            }
        },
        series: chartSeries
    });
    
    if (panelContent) {
        panelContent.innerHTML = `<div class="panel-placeholder">Clic
    }
}

// ==================================================================
// === REVISED FUNCTION V2: AI MINDSET SUMMARY WITH DESCRIPTIVE POINT
// ==================================================================

async function generateAndRenderMindsetSummary(posts, audienceContext
    // --- Find all your target Webflow elements ---
    const container = document.getElementById('mindset-summary-contai
    const archetypeHeadingEl = document.getElementById('archetype-hea
    const archetypeDescEl = document.getElementById('archetype-d');
    const characteristicsEl = document.getElementById('characteristic
    const rejectsEl = document.getElementById('reject-d');

    // Exit if the required elements aren't on the page
    if (!container || !archetypeHeadingEl || !archetypeDescEl || !cha
        console.error("One or more target mindset elements are missin
        if (container) container.innerHTML = '';
        return;
    }

    // --- Set a loading state ---
    archetypeHeadingEl.textContent = 'Analyzing...';
    archetypeDescEl.textContent = '';
    characteristicsEl.innerHTML = '<p class="loading-text">Extracting
    rejectsEl.innerHTML = '<p class="loading-text">Identifying dislik

    try {
        const topPostsText = posts.slice(0, 40).map(p => `Title: ${p.

        // --- 1. THE NEW PROMPT ---
        // This prompt now asks for an array of objects, each with a 
        const prompt = `You are an expert market psychologist special

        Respond ONLY with a valid JSON object with the following keys
        1. "archetype": A short, 2-3 word evocative name for this aud
        2. "summary": A 1-2 sentence summary explaining the core moti
        3. "values": An array of 3 objects. Each object must have two
        4. "rejects": An array of 3 objects. Each object must have tw

        Example for "values" format:
        "values": [
            { "title": "Value in Action, Not Theory", "description": 
            { "title": "Authenticity is Currency", "description": "Th
        ]

        Posts:
        ${topPostsText}`;

        const openAIParams = {
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are an expert market 
                { role: "user", content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 600,
            response_format: { "type": "json_object" }
        };

        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        
        if (!response.ok) throw new Error('Mindset analysis API call 

        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        const { archetype, summary, values, rejects } = parsed;

        // --- 2. THE NEW RENDERING LOGIC ---
        // This now populates the elements based on the new "title" a
        archetypeHeadingEl.textContent = archetype;
        archetypeDescEl.textContent = summary;
        
        if (values && values.length > 0) {
            // Create a list item for each object, making the title b
            const characteristicsHTML = '<ul>' + values.map(item => 
                `<li><strong>${item.title}:</strong> ${item.descripti
            ).join('') + '</ul>';
            characteristicsEl.innerHTML = characteristicsHTML;
        } else {
             characteristicsEl.innerHTML = '<p>Could not identify key
        }

        if (rejects && rejects.length > 0) {
            const rejectsHTML = '<ul>' + rejects.map(item => 
                `<li><strong>${item.title}:</strong> ${item.descripti
            ).join('') + '</ul>';
            rejectsEl.innerHTML = rejectsHTML;
        } else {
            rejectsEl.innerHTML = '<p>Could not identify dislikes.</p
        }

    } catch (error) {
        console.error("Mindset summary generation error:", error);
        archetypeHeadingEl.textContent = 'Analysis Failed';
        archetypeDescEl.textContent = 'Could not generate the audienc
        characteristicsEl.innerHTML = '';
        rejectsEl.innerHTML = '';
    }
}
// ==================================================================
// === NEW FUNCTION: AI STRATEGIC PILLARS (GOALS & FEARS) ===
// ==================================================================
async function generateAndRenderStrategicPillars(posts, audienceConte
    const goalsContainer = document.getElementById('goals-pillar');
    const fearsContainer = document.getElementById('fears-pillar');
    if (!goalsContainer || !fearsContainer) return;

    // Set initial loading states
    goalsContainer.innerHTML = `<p class="placeholder-text">Analyzing
    fearsContainer.innerHTML = `<p class="placeholder-text">Analyzing

    try {
        const topPostsText = posts.slice(0, 40).map(p => `Title: ${p.
\nContent: ${p.data.selftext || p.data.body || ''}`.substring(0, 800)

        const prompt = `You are an expert market psychologist special

        const openAIParams = {
            model: "gpt-4o-mini",
            messages: [{
                role: "system",
                content: "You are an expert market psychologist provi
            }, {
                role: "user",
                content: prompt
            }],
            temperature: 0.3,
            max_tokens: 400,
            response_format: { "type": "json_object" }
        };

        const response = await fetch(ANTHROPIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ openaiPayload: openAIParams })
        });

        if (!response.ok) throw new Error('Strategic pillars API call

        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        const { goals, fears } = parsed;

        const createCustomListHTML = (items) => {
            if (!items || items.length === 0) return '';
            return items.map((item, index) => {
                const isLastItem = index === items.length - 1;
                return `
                    <div class="pillar-item">
                        <p class="pillar-item-text">${item}</p>
                        ${!isLastItem ? '<div class="pillar-separator
                    </div>
                `;
            }).join('');
        };

        // Render Goals
        if (goals && goals.length > 0) {
            goalsContainer.innerHTML = createCustomListHTML(goals);
        } else {
            goalsContainer.innerHTML = `<p class="placeholder-text">C
        }

        // Render Fears
        if (fears && fears.length > 0) {
            fearsContainer.innerHTML = createCustomListHTML(fears);
        } else {
            fearsContainer.innerHTML = `<p class="placeholder-text">C
        }

    } catch (error) {
        console.error("Strategic pillars generation error:", error);
        // Replaced inline style with a dedicated error class
        goalsContainer.innerHTML = `<p class="placeholder-text placeh
        fearsContainer.innerHTML = `<p class="placeholder-text placeh
    }
}
// ==================================================================
// === NEW FUNCTION: AI GENERATIVE PROMPT ===
// ==================================================================

async function generateAndRenderAIPrompt(posts, audienceContext) {
    const container = document.getElementById('ai-prompt-container');
    if (!container) return;

    container.innerHTML = `<h3 class="dashboard-section-title">Genera

    try {
        const topPostsText = posts.slice(0, 30).map(p => `"${p.data.t

        const prompt = `You are a world-class brand strategist and co

        Based on the text, identify the following:
        - **tone:** 3-4 descriptive adjectives for the overall emotio
        - **vocabulary:** 3-5 key slang words, acronyms, or insider p
        - **style:** 2-3 bullet points describing their writing style
        - **sentiment:** 1 sentence describing their general outlook 

        Respond ONLY with a valid JSON object with the keys "tone", "

        Sample Posts:\n${topPostsText}`;

        const openAIParams = {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a brand strategis
                { role: "user", content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 500,
            response_format: { "type": "json_object" }
        };

        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        
        if (!response.ok) throw new Error('AI prompt generation API c

        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        
        const promptText = `Write a blog post about [YOUR TOPIC] for 

Your writing should adopt the following characteristics:

**TONE:**
- ${parsed.tone.join('\n- ')}

**VOCABULARY:**
- Use terms like: ${parsed.vocabulary.join(', ')}

**STYLE:**
- ${parsed.style.join('\n- ')}

**SENTIMENT:**
- ${parsed.sentiment}
`;

        container.innerHTML = `
            <h3 class="dashboard-section-title">Generative AI Prompt<
            <div class="ai-prompt-content" id="ai-prompt-text">${prom
        `;

    } catch (error) {
        console.error("AI prompt generation error:", error);
        container.innerHTML = `
            <h3 class="dashboard-section-title">Generative AI Prompt<
            <p class="loading-text" style="color: red;">Could not gen
        `;
    }
}
// ==================================================================
// === NEW FUNCTION: AI KEYWORD OPPORTUNITIES ===
// ==================================================================

async function generateAndRenderKeywords(posts, audienceContext) {
    const container = document.getElementById('keyword-opportunities-
    if (!container) return;

    container.innerHTML = `<h3 class="dashboard-section-title">Keywor

    try {
        const topPostsText = posts.slice(0, 50).map(p => `Title: ${p.

        const prompt = `You are an expert SEO strategist specializing
        Analyze the following user posts and extract up to 15 high-va

        1.  "problem_aware": Keywords used by people who know they ha
        2.  "solution_seeking": Keywords used by people actively look
        3.  "purchase_intent": Keywords used by people close to makin

        Respond ONLY with a valid JSON object with three keys: "probl

        Posts:\n${topPostsText}`;

        const openAIParams = {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an SEO strategist
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 600,
            response_format: { "type": "json_object" }
        };

        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        
        if (!response.ok) throw new Error('Keyword analysis API call 

        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        const { problem_aware, solution_seeking, purchase_intent } = 
        
        const renderCluster = (title, icon, description, keywords) =>
            if (!keywords || keywords.length === 0) return '';
            const keywordList = keywords.map(kw => `<li>${kw}</li>`).
            return `
                <div class="keyword-cluster">
                    <div class="keyword-cluster-header">
                        <span class="keyword-cluster-icon">${icon}</s
                        <div>
                            <h4 class="keyword-cluster-title">${title
                            <p class="keyword-cluster-description">${
                        </div>
                    </div>
                    <ul class="keyword-list">${keywordList}</ul>
                </div>
            `;
        };
        
        container.innerHTML = `
            <h3 class="dashboard-section-title">Keyword Opportunities
            <div class="keyword-clusters-grid">
                ${renderCluster('Problem-Aware', '🤔', 'For blog post
                ${renderCluster('Solution-Seeking', '🔍', 'For compar
                ${renderCluster('Purchase-Intent', '💳', 'For landing
            </div>
        `;

    } catch (error) {
        console.error("Keyword generation error:", error);
        container.innerHTML = `
            <h3 class="dashboard-section-title">Keyword Opportunities
            <p class="loading-text" style="color: red;">Could not gen
        `;
    }
}
// ==================================================================
// === UPGRADED FUNCTION: Action Cards with Strategic Logic & Master 
// ==================================================================
function generateAndRenderActionCards(seoPlan, audienceContext) {
    const container = document.getElementById('keyword-opportunities-
    if (!container) return;

    // --- A. Flatten the complex SEO plan into a simple list of cont
    const allContentIdeas = [];
    ['problem_aware', 'solution_seeking', 'purchase_intent'].forEach(
        if (!seoPlan[intent]) return;
        seoPlan[intent].forEach(primary => {
            (primary.secondary_keywords || []).forEach(secondary => {
                (secondary.long_tail_keywords || []).forEach(longtail
                    (longtail.content_examples || []).forEach(content
                        allContentIdeas.push({
                            title: content.title,
                            intent: intent,
                            primaryKeyword: primary.keyword,
                            primaryVolume: primary.searchVolume,
                            secondaryKeyword: secondary.keyword,
                            secondaryVolume: secondary.searchVolume,
                            longTailKeyword: longtail.keyword,
                            longTailVolume: longtail.searchVolume,
                        });
                    });
                });
            });
        });
    });

    if (allContentIdeas.length === 0) {
        container.innerHTML = '';
        return;
    }

    // --- B. Curate the content for each of the 4 cards (REVISED STR

    // Card 1 & 2: Traffic Drivers & Conversion Boosters (No changes 
    const trafficDrivers = allContentIdeas.filter(idea => idea.intent
    const conversionBoosters = allContentIdeas.filter(idea => idea.in

    // Card 3: Quick Wins (Logic slightly improved to be more reliabl
    const quickWins = [...allContentIdeas].sort((a, b) => a.longTailV

    // Card 4: The Shortlist (NEW STRATEGIC CURATION)
    const shortlist = [];
    let candidates = [...allContentIdeas];

    // 1. Pick the single best "Purchase Intent" idea (highest volume
    const topPurchase = candidates.filter(c => c.intent === 'purchase
    if (topPurchase) {
        shortlist.push(topPurchase);
        candidates = candidates.filter(c => c.title !== topPurchase.t
    }

    // 2. Pick the single best "Solution Seeking" idea
    const topSolution = candidates.filter(c => c.intent === 'solution
    if (topSolution) {
        shortlist.push(topSolution);
        candidates = candidates.filter(c => c.title !== topSolution.t
    }
    
    // 3. Pick the single best "Problem Aware" traffic driver
    const topProblem = candidates.filter(c => c.intent === 'problem_a
    if (topProblem) {
        shortlist.push(topProblem);
        candidates = candidates.filter(c => c.title !== topProblem.ti
    }

    // 4. Fill remaining spots with the highest "overall score" ideas
    const intentWeights = { purchase_intent: 3, solution_seeking: 2, 
    while (shortlist.length < 4 && candidates.length > 0) {
        const bestRemaining = candidates.map(idea => ({
            ...idea,
            score: (idea.primaryVolume * 0.7 + idea.longTailVolume * 
        })).sort((a, b) => b.score - a.score)[0];
        
        if(bestRemaining) {
            shortlist.push(bestRemaining);
            candidates = candidates.filter(c => c.title !== bestRemai
        } else {
            break; // No more candidates
        }
    }


    // --- C. Render the HTML, including the new toggle button ---
    container.innerHTML = `
        <div class="card-toggle-wrapper">
            <button id="toggle-all-cards-btn" class="card-toggle-butt
        </div>
        <div class="action-cards-grid">
            ${renderActionCardHTML('Traffic Drivers', 'High-volume, t
            ${renderActionCardHTML('Conversion Boosters', 'Content fo
            ${renderActionCardHTML('Quick Wins', 'Low-competition, hi
            ${renderActionCardHTML('The Shortlist', 'Our top strategi
        </div>
    `;

    // --- D. Add Event Listener for the new toggle button ---
    const toggleBtn = document.getElementById('toggle-all-cards-btn')
    const allCards = document.querySelectorAll('.action-cards-grid .a
    if(toggleBtn && allCards.length > 0) {
        toggleBtn.addEventListener('click', () => {
            // Check if ANY card is closed. If so, the action is to o
            const shouldOpen = Array.from(allCards).some(card => !car
            allCards.forEach(card => card.open = shouldOpen);
            toggleBtn.textContent = shouldOpen ? 'Collapse All' : 'Ex
        });
    }
}
// ==================================================================
// === UPGRADED FUNCTION: Renders a single COLLAPSIBLE Action Card ==
// ==================================================================
function renderActionCardHTML(title, subtitle, ideas, whyItMattersGen
    if (!ideas || ideas.length === 0) return '';

    const blogTitlesHTML = ideas.map((idea, index) => {
        return `
            <details class="action-item-dropdown">
                <summary class="action-item-summary">
                    <span class="action-item-icon">📝</span>
                    ${idea.title}
                </summary>
                <div class="action-item-context">
                    <div class="context-item primary"><span class="co
                    <div class="context-item secondary"><span class="
                    <div class="context-item longtail"><span class="c
                    <div class="context-item why"><span class="contex
                </div>
            </details>
        `;
    }).join('');

    // The main card is now a <details> element
    return `
    <details class="action-card">
    <summary class="action-card-summary">
                <div class="action-card-header">
                    <h3 class="action-card-title">${title}</h3>
                    <p class="action-card-subtitle">${subtitle}</p>
                </div>
                <div class="action-card-arrow">›</div>
            </summary>
            <div class="action-item-list">
                ${blogTitlesHTML}
            </div>
        </details>
    `;
}
async function generateAndRenderSeoSunburst(posts, audienceContext) {
    const container = document.getElementById('keyword-sunburst');
    if (!container) {
        console.error('Sunburst container div "keyword-sunburst" not 
        return;
    }

    container.innerHTML = '<p class="loading-text">Building data-driv

    try {
        const topPostsText = posts.slice(0, 50).map(p => `Title: ${p.

        // *** CHANGE 1: The AI prompt is updated to match the new no
        const prompt = `You are an expert SEO strategist for the "${a

        Structure your response as a single, valid JSON object.

        For each of the three intents (problem_aware, solution_seekin

        - For EACH primary keyword, provide an array of 2-4 "secondar
        - For EACH secondary keyword, provide an array of 2-3 "long_t
        - For EACH long-tail keyword, provide an array of 1-2 "conten

        CRITICAL: Every keyword object (primary, secondary, long_tail
        - "keyword": The keyword phrase.
        - "searchVolume": A realistic monthly search volume (integer)

        Each "content_examples" item should be an object with a singl

        Example JSON Structure:
        {
          "problem_aware": [
            {
              "keyword": "primary keyword A", "searchVolume": 5000,
              "secondary_keywords": [
                {
                  "keyword": "secondary keyword A1", "searchVolume": 
                  "long_tail_keywords": [
                    {
                      "keyword": "long-tail keyword A1a", "searchVolu
                      "content_examples": [ { "title": "Example Blog 
                    }
                  ]
                }
              ]
            }
          ],
          "solution_seeking": [ ... ], "purchase_intent": [ ... ]
        }`;

        const openAIParams = {
            model: "gpt-4o",
            messages: [{ role: "system", content: "You are a JSON-onl
            temperature: 0.2,
            response_format: { "type": "json_object" }
        };

        const response = await fetch(ANTHROPIC_PROXY_URL, { method: '
        if (!response.ok) throw new Error('AI SEO plan generation fai

        const aiResult = await response.json();
        const seoPlan = JSON.parse(aiResult.openaiResponse);
        generateAndRenderActionCards(seoPlan, audienceContext);

        // Data transformation logic remains the same - it's robust e
        // In generateAndRenderSeoSunburst...

// ==================================================================
// === STEP 1: CORRECTED DATA GENERATION ============================
// ==================================================================

// Data transformation logic
const sunburstData = [{
    id: 'root', parent: '', name: 'SEO Plan',
    levelName: 'SEO Plan' // <-- FLATTENED PROPERTY
}, {
    id: 'pa', parent: 'root', name: 'Problem-Aware', color: '#6AA9FF'
    levelName: 'Intent bucket' // <-- FLATTENED PROPERTY
}, {
    id: 'ss', parent: 'root', name: 'Solution-Seeking', color: '#9B7C
    levelName: 'Intent bucket' // <-- FLATTENED PROPERTY
}, {
    id: 'pi', parent: 'root', name: 'Purchase-Intent', color: '#5ED1B
    levelName: 'Intent bucket' // <-- FLATTENED PROPERTY
}];

const processIntent = (intentId, intentName, intentData) => {
    if (!intentData || !Array.isArray(intentData)) return;
    
    // Level 3: Primary Keywords
    intentData.forEach((primary, i) => {
        const primaryId = `${intentId}_p_${i}`;
        sunburstData.push({ 
            id: primaryId, 
            parent: intentId, 
            name: primary.keyword, 
            // NO 'extra' OBJECT. Properties are added directly.
            intentName: intentName,
            levelName: 'Primary keyword',
            searchVolume: primary.searchVolume
        });

        // Level 4: Secondary Keywords
        (primary.secondary_keywords || []).forEach((secondary, j) => 
            const secondaryId = `${primaryId}_s_${j}`;
            sunburstData.push({ 
                id: secondaryId, 
                parent: primaryId, 
                name: secondary.keyword, 
                intentName: intentName,
                levelName: 'Secondary keyword',
                searchVolume: secondary.searchVolume
            });

            // Level 5: Long-tail Keywords
            (secondary.long_tail_keywords || []).forEach((longtail, k
                const longtailId = `${secondaryId}_l_${k}`;
                sunburstData.push({ 
                    id: longtailId, 
                    parent: secondaryId, 
                    name: longtail.keyword, 
                    intentName: intentName,
                    levelName: 'Long-tail keyword',
                    searchVolume: longtail.searchVolume
                });

                // Level 6: Content Examples
                (longtail.content_examples || []).forEach((content, l
                    const value = longtail.searchVolume / (longtail.c
                    sunburstData.push({
                        id: `${longtailId}_c_${l}`,
                        parent: longtailId,
                        name: content.title,
                        value: Math.max(value, 1),
                        intentName: intentName,
                        levelName: 'Content example',
                        searchVolume: longtail.searchVolume // Storin
                    });
                });
            });
        });
    });
};


        processIntent('pa', 'Problem-Aware', seoPlan.problem_aware);
        processIntent('ss', 'Solution-Seeking', seoPlan.solution_seek
        processIntent('pi', 'Purchase-Intent', seoPlan.purchase_inten

        const seriesName = sunburstData.find(d => d.id === 'root')?.n

                // ==================================================
        // === START: COPY AND REPLACE THIS ENTIRE BLOCK ============
        // ==========================================================

        Highcharts.chart(container, {
            chart: { type: 'sunburst', height: '650px', backgroundCol
            title: { text: null },
            credits: { enabled: false },

            // THIS IS THE KEY FIX for removing "Series 1" and enabli
            breadcrumbs: {
                showFullPath: false, // <-- This removes the "Series 
                useHTML: true        // <-- This allows our CSS to co
            },

            plotOptions: {
                sunburst: {
                    animation: { duration: 1000 },
                    borderColor: '#FFFFFF',
                    borderWidth: 1
                }
            },

            series: [{
                type: 'sunburst',
                name: seriesName,
                data: sunburstData,
                allowDrillToNode: true,
                cursor: 'pointer',
                dataLabels: {
                    format: '{point.name}',
                    filter: { property: 'innerArcLength', operator: '
                    rotationMode: 'circular',
                    style: {
                        color: '#FFFFFF',
                        textOutline: 'none',
                        fontWeight: '400'
                    }
                },
                levels: [{
                    level: 1,
                    levelIsConstant: false,
                    dataLabels: {
                        enabled: true,
                        filter: { property: 'value', operator: '>', v
                        style: {
                            fontSize: '1.1em',
                            fontWeight: '400',
                            color: '#FFFFFF',
                            textOutline: 'none'
                        }
                    }
                }, { level: 2, colorByPoint: true }, { level: 3, colo
            }],

            tooltip: {
                useHTML: true,
                headerFormat: '',
                pointFormatter: function() {
                    const point = this;
                    let html = `<div style="min-width: 250px; max-wid

                    // THIS IS THE FIX for the bold and capitalized n
                    const capitalizedName = point.name.replace(/(^\w{
                    html += `<b>Name:</b> <b>${capitalizedName}</b><b

                    if (point.levelName) {
                        html += `<b>Level:</b> ${point.levelName}<br/
                    }
                    if (point.intentName) {
                        html += `<b>Intent:</b> ${point.intentName}<b
                    }
                    if (point.searchVolume !== undefined) {
                        html += `<b>Search volume:</b> ${point.search
                    }
                    html += `</div>`;
                    return html;
                }
            },

            exporting: { enabled: true },
            accessibility: { enabled: true },
        });

        // ==========================================================
        // === END OF BLOCK TO REPLACE ==============================
        // ==========================================================
    } catch (error) {
        console.error("Failed to generate or render SEO Sunburst char
        container.innerHTML = `<p class="error-message">Could not gen
    }
}
// ==================================================================
// === NEW SOLUTION: PROBLEM/OFFER SANKEY DIAGRAM ===================
// ==================================================================

async function generateProblemOfferPairsAI(summaries) {
    if (!summaries || summaries.length === 0) return [];
    
    const problemTitles = summaries.map(s => s.title);
    const prompt = `You are a startup advisor. For each customer prob
    
    Respond ONLY with a valid JSON object with a single key "pairs". 
    
    CRITICAL: Ensure there is one object for each problem provided, a

    Example Response:
    { "pairs": [ { "problem": "Models take forever to train", "offer"

    Problems to solve:
    ${JSON.stringify(problemTitles)}
    `;

    const openAIParams = {
        model: "gpt-4o",
        messages: [{ role: "system", content: "You are a startup advi
        temperature: 0.6,
        max_tokens: 2000,
        response_format: { "type": "json_object" }
    };

    try {
        const response = await fetch(ANTHROPIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ openaiPayload: openAIParams })
        });
        if (!response.ok) throw new Error(`OpenAI API Error for pairs
        const data = await response.json();
        const parsed = JSON.parse(data.openaiResponse);
        if (parsed.pairs && Array.isArray(parsed.pairs)) return parse
        else throw new Error("AI response did not contain a valid 'pa
    } catch (error) {
        console.error("Problem/Offer pair generation failed:", error)
        return [];
    }
}

// ==================================================================
// === PASTE THIS ENTIRE CORRECTED FUNCTION =========================
// ==================================================================
async function generateAndRenderValueSankey(audienceName, summaries) 
    const container = document.getElementById('value-tree');
    if (!container) return;

    container.innerHTML = '<p class="loading-text">Generating AI valu

    const pairs = await generateProblemOfferPairsAI(summaries);
    const validatedPairs = pairs.filter(p => p.problem && p.offer && 

    if (validatedPairs.length === 0) {
        container.innerHTML = '<p class="placeholder-text">Could not 
        return;
    }

    const sankeyData = [];
    const sankeyNodes = [];
    const addedNodes = new Set();

    validatedPairs.forEach(pair => {
        // Create the link from problem to offer
        sankeyData.push([pair.problem, pair.offer, 1]); // Weight of 

        // Add the problem node if it doesn't exist
        if (!addedNodes.has(pair.problem)) {
            // --- THIS IS THE FIX: Add the 'name' property ---
            sankeyNodes.push({ id: pair.problem, name: pair.problem, 
            addedNodes.add(pair.problem);
        }
        // Add the offer node if it doesn't exist
        if (!addedNodes.has(pair.offer)) {
            // --- THIS IS THE FIX: Add the 'name' property ---
            sankeyNodes.push({ id: pair.offer, name: pair.offer, colu
            addedNodes.add(pair.offer);
        }
    });
// ==================================================================
// === PASTE THIS ENTIRE FINAL CHART CONFIGURATION ==================
// ==================================================================
Highcharts.chart('value-tree', {
    chart: {
        type: 'sankey',
        backgroundColor: 'transparent',
        margin: [20, 20, 20, 20] // Added slightly more margin
    },
    title: { text: null },
    credits: { enabled: false },
    tooltip: { enabled: false },
    series: [{
        keys: ['from', 'to', 'weight'],
        data: sankeyData,
        nodes: sankeyNodes,
        nodePadding: 25, // Vertical space between nodes

        // Link styling
        link: {
            color: 'rgba(94, 209, 216, 0.6)',
            linkOpacity: 0.6
        },

        // --- THIS IS THE DEFINITIVE FIX ---
        // We use the standard 'formatter' and remove all conflicting
        dataLabels: {
            enabled: true,
            useHTML: true,
            formatter: function() {
                // 'this.point' correctly refers to the node data
                const point = this.point;
                const className = point.type === 'problem' ? 'sankey-
                // Return the custom HTML div, which will now be rend
                return `<div class="sankey-label ${className}">${poin
            }
        },
    }]
});
}
async function generateAndRenderPowerPhrases(posts, audienceContext) 
    const container = document.getElementById('power-phrases');
    if (!container) return;

    // --- 1. Find Phrases (No changes to this part) ---
    const rawText = posts.map(p => `${p.data.title || ''} ${p.data.se
    const stopAcronyms = new Set(['AITA', 'TLDR', 'IIRC', 'IMO', 'IMH
    const acronymRegex = /\b[A-Z]{2,5}\b/g;
    const acronyms = rawText.match(acronymRegex) || [];
    const acronymFreq = {};
    acronyms.forEach(acronym => { if (!stopAcronyms.has(acronym)) { a
    const topAcronyms = Object.entries(acronymFreq).filter(([_, count
    const cleanedText = rawText.toLowerCase().replace(/[^a-z\s']/g, '
    const words = cleanedText.split(' ');
    const bigrams = generateNgrams(words, 2);
    const trigrams = generateNgrams(words, 3);
    const phraseFreq = {};
    [...bigrams, ...trigrams].forEach(phrase => { phraseFreq[phrase] 
    const topPhrases = Object.entries(phraseFreq).filter(([_, count])
    const finalResults = [...topAcronyms, ...topPhrases];

    if (finalResults.length < 3) {
        container.innerHTML = '<p style="font-family: Inter, sans-ser
        return;
    }

    // --- 2. Generate Dropdown HTML Structure ---
    const phrasesHTML = finalResults.map((item, index) => `
        <details class="power-phrase-item" id="phrase-item-${index}">
            <summary class="power-phrase-summary">${item}</summary>
            <div class="power-phrase-definition" id="phrase-def-${ind
                <p class="loading-text">Loading definition...</p>
            </div>
        </details>
    `).join('');

    // --- 3. Render the Dropdowns (Header is removed) ---
    container.innerHTML = `<div class="power-phrases-list">${phrasesH

    // --- 4. Fetch Definitions Asynchronously ---
    finalResults.forEach(async (phrase, index) => {
        try {
            const prompt = `For the target audience "${audienceContex
            const openAIParams = {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are an expert at 
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 100,
            };
            const response = await fetch(ANTHROPIC_PROXY_URL, { metho
            if (!response.ok) throw new Error('Definition API call fa
            
            const data = await response.json();
            const definitionText = data.openaiResponse;
            
            const definitionDiv = document.getElementById(`phrase-def
            if (definitionDiv) {
                definitionDiv.innerHTML = `<p>${definitionText}</p>`;
            }
        } catch (error) {
            console.error(`Failed to get definition for "${phrase}":`
            const definitionDiv = document.getElementById(`phrase-def
            if (definitionDiv) {
                definitionDiv.innerHTML = `<p class="loading-text" st
            }
        }
    });
}

// PASTE THIS ENTIRE FUNCTION INTO THE SPOT IDENTIFIED ABOVE

async function runProblemFinder(options = {}) {

    console.log("CHECKPOINT 2: Inside runProblemFinder. The audience 

    const { isUpdate = false } = options;

    const growthHeaderPrefix = document.getElementById('growth-header
    if (growthHeaderPrefix) {
        growthHeaderPrefix.innerHTML = `Growth Plan to target <span c
    }
    const searchButton = document.getElementById('search-selected-btn
    if (!searchButton) { console.error("Could not find button."); ret
    const selectedCheckboxes = document.querySelectorAll('#subreddit-
    if (selectedCheckboxes.length === 0) { alert("Please select at le
    const selectedSubreddits = Array.from(selectedCheckboxes).map(cb 

    const subredditQueryString = selectedSubreddits.map(sub => `subre
    if (!isUpdate) {
        searchButton.classList.add('is-loading');
        searchButton.disabled = true;
    }
    const problemTerms = ["problem", "challenge", "frustration", "ann
    const deepProblemTerms = ["struggle", "issue", "difficulty", "pai
    const demandSignalTerms = ["i'd pay good money for", "buy it in a
    const resultsWrapper = document.getElementById('results-wrapper-b
    const resultsMessageDiv = document.getElementById("results-messag
    const countHeaderDiv = document.getElementById("count-header");
    if (!isUpdate) {
        if (resultsWrapper) { resultsWrapper.style.display = 'none'; 
        ["count-header", "filter-header", "pulse-results", "posts-con
        if (resultsMessageDiv) resultsMessageDiv.innerHTML = "";
        for (let i = 1; i <= 5; i++) {
            const block = document.getElementById(`findings-block${i}
            if (block) {
                block.style.display = 'none';
                const prevalenceWrapper = block.querySelector('.preva
                if (prevalenceWrapper) {
                    prevalenceWrapper.innerHTML = "<p class='loading-
                }
            }
        }
    }
    try {
        console.log("--- STARTING PHASE 1: FAST ANALYSIS ---");
        const panelContent = document.getElementById('bubble-content'
        if (panelContent) {
            panelContent.innerHTML = `<div class="panel-placeholder">
        }
        const searchDepth = document.querySelector('input[name="searc
        let generalSearchTerms = (searchDepth === 'deep') ? [...probl
        let limitPerTerm = (searchDepth === 'deep') ? 75 : 40;
        const selectedTimeRaw = document.querySelector('input[name="t
        const selectedMinUpvotes = parseInt(document.querySelector('i
        const timeMap = { week: "week", month: "month", "6months": "y
        const selectedTime = timeMap[selectedTimeRaw] || "all";
        const problemItems = await fetchMultipleRedditDataBatched(sub
        const allItems = deduplicatePosts(problemItems);
        if (allItems.length === 0) throw new Error("No initial proble
        const filteredItems = filterPosts(allItems, selectedMinUpvote
        if (filteredItems.length < 10) throw new Error("Not enough hi
        window._filteredPosts = filteredItems;
        renderPosts(filteredItems);
        generateAndRenderHybridSentiment(filteredItems, originalGroup
        generateEmotionMapData(filteredItems).then(renderEmotionMap);
        renderIncludedSubreddits(selectedSubreddits);
        generateAndRenderPowerPhrases(filteredItems, originalGroupNam
        generateAndRenderMindsetSummary(filteredItems, originalGroupN
        generateAndRenderStrategicPillars(filteredItems, originalGrou
        generateAndRenderAIPrompt(filteredItems, originalGroupName);
        generateAndRenderSeoSunburst(filteredItems, originalGroupName
        extractAndValidateEntities(filteredItems, originalGroupName).
        generateFAQs(filteredItems).then(faqs => renderFAQs(faqs));
        if (countHeaderDiv) { countHeaderDiv.innerHTML = `Distilled <
        const topKeywords = getTopKeywords(filteredItems, 10);
        const topPosts = filteredItems.slice(0, 30);
        const combinedTexts = topPosts.map(post => `${post.data.title
        const openAIParams = { model: "gpt-4o-mini", messages: [{ rol
        const openAIResponse = await fetch(ANTHROPIC_PROXY_URL, { met
        if (!openAIResponse.ok) throw new Error('OpenAI summary gener
        const openAIData = await openAIResponse.json();
        const summaries = parseAISummary(openAIData.openaiResponse);
        const validatedSummaries = summaries.filter(finding => filter
        if (validatedSummaries.length === 0) {
            console.warn("AI generated summaries, but none met the va
            throw new Error("While posts were found, no clear, common
        }
        const metrics = calculateFindingMetrics(validatedSummaries, f
        const sortedFindings = validatedSummaries.map((summary, index
            summary,
            prevalence: Math.round((metrics[index].supportCount / (me
            supportCount: metrics[index].supportCount
        })).sort((a, b) => b.prevalence - a.prevalence);
        
        console.log("CHECKPOINT A: Analysis is complete. Found these 
        const problemTitles = sortedFindings.map(finding => finding.s
        updateGrowthHeaderDropdown(problemTitles);
        console.log("CHECKPOINT B: The dropdown should now be updated
        if (problemTitles.length > 0) {
            const headerLabel = document.getElementById('growth-heade
            if (headerLabel) {
                headerLabel.textContent = problemTitles[0];
            }
        }
        window._summaries = sortedFindings.map(item => item.summary);
        
        for (let i = 1; i <= 5; i++) {
            const block = document.getElementById(`findings-block${i}
            if (block) block.style.display = "none";
        }
        sortedFindings.forEach((findingData, index) => {
            const displayIndex = index + 1;
            if (displayIndex > 5) return;
            const block = document.getElementById(`findings-block${di
            if (!block) return;
            const content = document.getElementById(`findings-${displ
            const btn = block.querySelector('.sample-posts-button');
            block.style.display = "flex";
            if (content) {
                const { summary, prevalence, supportCount } = finding
                const titleEl = content.querySelector('.section-title
                if (titleEl) titleEl.textContent = summary.title;
                const teaserEl = content.querySelector('.summary-teas
                const fullEl = content.querySelector('.summary-full')
                const seeMoreBtn = content.querySelector('.see-more-b
                if (teaserEl && fullEl && seeMoreBtn) {
                    if (summary.body.length > 95) {
                        teaserEl.textContent = summary.body.substring
                        fullEl.textContent = summary.body;
                        teaserEl.style.display = 'inline';
                        fullEl.style.display = 'none';
                        seeMoreBtn.style.display = 'inline-block';
                        seeMoreBtn.textContent = 'See more';
                        const newBtn = seeMoreBtn.cloneNode(true);
                        seeMoreBtn.parentNode.replaceChild(newBtn, se
                        newBtn.addEventListener('click', function() {
                            const isHidden = teaserEl.style.display !
                            teaserEl.style.display = isHidden ? 'none
                            fullEl.style.display = isHidden ? 'inline
                            newBtn.textContent = isHidden ? 'See less
                        });
                    } else {
                        teaserEl.textContent = summary.body;
                        teaserEl.style.display = 'inline';
                        fullEl.style.display = 'none';
                        seeMoreBtn.style.display = 'none';
                    }
                }
                const quotesContainer = content.querySelector('.quote
                if (quotesContainer) {
                    const quoteElements = quotesContainer.querySelect
                    summary.quotes.forEach((quoteText, i) => {
                        if (quoteElements[i]) {
                            if (quoteText) {
                                quoteElements[i].textContent = `"${qu
                                quoteElements[i].style.display = 'blo
                            } else {
                                quoteElements[i].style.display = 'non
                            }
                        }
                    });
                }
                const metricsWrapper = content.querySelector('.preval
                if (metricsWrapper) {
                    metricsWrapper.innerHTML = (sortedFindings.length
                }
            }
            if (btn) {
                btn.onclick = () => showSamplePosts(index, window._as
            }
        });
        try {
            window._postsForAssignment = filteredItems.slice(0, 75);
            window._usedPostIds = new Set();
            const assignments = await assignPostsToFindings(window._s
            window._assignments = assignments;
            for (let i = 0; i < window._summaries.length; i++) {
                if (i >= 5) break;
                showSamplePosts(i, assignments, filteredItems, window
            }
        } catch (err) {
            console.error("CRITICAL (but isolated): Failed to assign 
            for (let i = 1; i <= 5; i++) { const redditDiv = document
        }
        
        // This is the single, correct call for the new mind map
        generateAndRenderValueSankey(originalGroupName, window._summa
        
        if (countHeaderDiv && countHeaderDiv.textContent.trim() !== "
            if (resultsWrapper) {
                resultsWrapper.style.setProperty('display', 'flex', '
                setTimeout(() => {
                    if (resultsWrapper) {
                        resultsWrapper.style.opacity = '1';
                        if (!isUpdate) {
                            resultsWrapper.scrollIntoView({ behavior:
                            const fullHeader = document.getElementByI
                            if (fullHeader) {
                                fullHeader.classList.add('header-hidd
                                fullHeader.addEventListener('transiti
                                    fullHeader.style.display = 'none'
                                }, { once: true });
                            }
                        }
                    }
                }, 50);
            }
        }
        setTimeout(() => runConstellationAnalysis(subredditQueryStrin
        setTimeout(() => renderAndHandleRelatedSubreddits(selectedSub
        setTimeout(() => enhanceDiscoveryWithComments(window._filtere
    } catch (err) {
        console.error("!!!!!!!! A FATAL ERROR STOPPED THE ANALYSIS !!
        alert("An error occurred during analysis. Please check the co
        if (resultsMessageDiv) resultsMessageDiv.innerHTML = `<p clas
        if (resultsWrapper) { resultsWrapper.style.setProperty('displ
    } finally {
        if (!isUpdate) {
            searchButton.classList.remove('is-loading');
            searchButton.disabled = false;
        }
    }
}


function initializeDashboardInteractivity() {
    document.addEventListener('click', (e) => {
        const backButton = e.target.closest('#results-wrapper-b #back
        if (backButton) {
            location.reload();
            return;
        }

        if (e.target.closest('#results-wrapper-b')) {
            const cloudWordEl = e.target.closest('.cloud-word');
            const briefButtonEl = e.target.closest('.brief-button'); 
            const removeBtnEl = e.target.closest('.remove-sub-btn');

            if (cloudWordEl) {
                const word = cloudWordEl.dataset.word;
                const category = cloudWordEl.closest('#positive-cloud
                const postsData = window._sentimentData?.[category]?.
                if (postsData) { showSlidingPanel(word, Array.from(po
            } else if (briefButtonEl) { // MODIFIED: Check for the bu
                const parentItem = briefButtonEl.closest('.discovery-
                const word = parentItem.dataset.word;
                const type = parentItem.dataset.type;
                generateAndRenderBrandBrief(word, type);
            } else if (removeBtnEl) {
                handleRemoveSubClick(e);
            }
        }
    });
}

function updateGrowthHeaderDropdown(problemTitles) {
    console.log("CHECKPOINT 1: Entering updateGrowthHeaderDropdown fu

    const dropdownList = document.querySelector('#growth-header-dropd
    
    if (!dropdownList) {
        console.error("DEBUGGING ERROR: Could not find the dropdown l
        return;
    }

    console.log("CHECKPOINT 2: Successfully found the dropdown list e
    dropdownList.innerHTML = ''; // Clear defaults
  
    // Create "Broad Problems" link which acts as our "View All"
    const viewAllLink = document.createElement('a');
    viewAllLink.className = 'w-dropdown-link';
    viewAllLink.textContent = 'broad problems';
    viewAllLink.setAttribute('data-problem', 'all');
    dropdownList.appendChild(viewAllLink);
  
    // Create a link for each specific problem
    problemTitles.forEach(title => {
      const problemLink = document.createElement('a');
      problemLink.className = 'w-dropdown-link';
      problemLink.textContent = title;
      problemLink.setAttribute('data-problem', title);
      dropdownList.appendChild(problemLink);
    });

    console.log("CHECKPOINT 3: Finished populating the dropdown with 
}

  function setupGrowthKitInteraction() {
    // Find the key elements of the dropdown header
    const audienceName = window.originalGroupName || 'your audience';
    const headerPrefix = document.getElementById('growth-header-prefi
    const headerLabel = document.getElementById('growth-header-label'
    const dropdownList = document.querySelector('#growth-header-dropd

    // Set the default state for the header when the tool first loads
    if (headerPrefix) {
        headerPrefix.innerHTML = `Growth Plan to target <span class="
    }
    if (headerLabel) {
        headerLabel.textContent = 'broad problems';
    }

    // This function will be called when a user clicks a problem
    function filterGrowthPlan(problemTitle) {
        if (!headerPrefix || !headerLabel) return;

        const currentAudience = window.originalGroupName || 'your aud
        headerPrefix.innerHTML = `Growth Plan to target <span class="

        if (problemTitle === 'all') {
            headerLabel.textContent = 'broad problems';
            // In the future, you can add code here to SHOW ALL growt
        } else {
            headerLabel.textContent = problemTitle;
            // In the future, you can add code here to FILTER growth 
        }
    }

    // --- Listen for clicks on the "Generate Growth Plan" buttons on
    document.addEventListener('click', function(event) {
        const clickedButton = event.target.closest('.generate-growth-
        if (!clickedButton) return;

        const parentCard = clickedButton.closest('.findings-block');
        const problemTitleElement = parentCard ? parentCard.querySele
        const growthTabLink = document.getElementById('growth-tab-lin

        if (problemTitleElement && growthTabLink) {
            const title = problemTitleElement.textContent.trim();
            filterGrowthPlan(title); // Update the header text
            growthTabLink.click();   // Switch to the Growth Plan tab
        }
    });

    // --- Listen for clicks inside the Dropdown Header itself ---
    if (dropdownList) {
        dropdownList.addEventListener('click', function(event) {
            const clickedLink = event.target.closest('.w-dropdown-lin
            if (!clickedLink) return;

            event.preventDefault();
            const selectedProblem = clickedLink.getAttribute('data-pr
            filterGrowthPlan(selectedProblem);

            // This is a common way to programmatically close a Webfl
            const dropdownToggle = document.querySelector('#growth-he
            if (dropdownToggle && dropdownToggle.getAttribute('aria-e
                 dropdownToggle.click();
            }
        });
    }
}
  function initializeProblemFinderTool() {
    const style = document.createElement('style');
    // ==============================================================
    // === PASTE THIS NEW CSS =======================================
    // ==============================================================
    style.textContent = `
        .sankey-label {
            padding: 12px 16px;
            border-radius: 12px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 15px;
            font-weight: 500;
            white-space: normal !important;
            word-break: break-word !important;
            text-align: center;
            line-height: 1.4;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }
        .sankey-problem {
            background-color: #e0f2fe; /* Light Blue */
            color: #0c4a6e; /* Dark Blue Text */
        }
        .sankey-offer {
            background-color: #ede9fe; /* Light Purple */
            color: #5b21b6; /* Dark Purple Text */
        }
    `;
    // ==============================================================
    document.head.appendChild(style);
    document.head.appendChild(style);

    console.log("Problem Finder elements found. Initializing...");
    const welcomeDiv = document.getElementById('welcome-div');
    const pillsContainer = document.getElementById('pf-suggestion-pil
    const groupInput = document.getElementById('group-input');
    const findCommunitiesBtn = document.getElementById('find-communit
    const searchSelectedBtn = document.getElementById('search-selecte
    const step1Container = document.getElementById('step-1-container'
    const step2Container = document.getElementById('subreddit-selecti
    const inspireButton = document.getElementById('inspire-me-button'
    const choicesContainer = document.getElementById('subreddit-choic
    const audienceTitle = document.getElementById('pf-audience-title'

    // Check if critical elements exist before proceeding
    if (!findCommunitiesBtn || !searchSelectedBtn || !choicesContaine
        console.error("Critical error: A key UI element was not found
        return;
    }

    const transitionToStep2 = () => {
        if (step2Container.classList.contains('visible')) return;
        if (welcomeDiv) { welcomeDiv.style.display = 'none'; }
        step1Container.classList.add('hidden');
        step2Container.classList.add('visible');
        choicesContainer.innerHTML = '<p class="loading-text">Finding
        audienceTitle.textContent = `Select Subreddits For: ${origina
    };
    
    // Setup for suggestion pills
    if (pillsContainer) {
        pillsContainer.innerHTML = suggestions.map(s => `<div class="
        pillsContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('pf-suggestion-pill')
                groupInput.value = event.target.getAttribute('data-va
                findCommunitiesBtn.click();
            }
        });
    }

    if (inspireButton) {
        inspireButton.addEventListener('click', () => {
            if(pillsContainer) pillsContainer.classList.toggle('visib
        });
    }

    // --- Event Listener for "Find Communities" Button ---
    findCommunitiesBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        const groupName = groupInput.value.trim();
        if (!groupName) {
            alert("Please enter a group of people or select a suggest
            return;
        }
        originalGroupName = groupName;
        transitionToStep2();
        try {
            const initialSuggestions = await findSubredditsForGroup(g
            const rankedSubreddits = await fetchAndRankSubreddits(ini
            displaySubredditChoices(rankedSubreddits);
        } catch (error) {
            console.error("Failed during subreddit validation process
            displaySubredditChoices([]);
        }
    });

        // --- Event Listener for "Search Selected" Button ---
        searchSelectedBtn.addEventListener("click", (event) => {
            event.preventDefault();
            console.log("CHECKPOINT 1: 'Search Selected' button click
            runProblemFinder();
        });
    
    // Logic for making the subreddit choices clickable
    choicesContainer.addEventListener('click', (event) => {
        const choiceDiv = event.target.closest('.subreddit-choice');
        if (choiceDiv) {
            const checkbox = choiceDiv.querySelector('input[type="che
            if (checkbox) checkbox.checked = !checkbox.checked;
        }
    });

    // Initialize the other interactive parts of the dashboard
    initializeDashboardInteractivity();
    setupGrowthKitInteraction();

    console.log("Problem Finder tool successfully initialized.");
}

function waitForElementAndInit() {
    const keyElementId = 'find-communities-btn';
    let retries = 0;
    const maxRetries = 50;
    const intervalId = setInterval(() => {
        const keyElement = document.getElementById(keyElementId);
        if (keyElement) {
            clearInterval(intervalId);
            initializeProblemFinderTool();
        } else {
            retries++;
            if (retries > maxRetries) {
                clearInterval(intervalId);
                console.error(`Initialization FAILED. Key element "#$
            }
        }
    }, 100);
}

// --- SCRIPT ENTRY POINT ---
document.addEventListener('DOMContentLoaded', waitForElementAndInit);
