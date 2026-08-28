/*
    A single choke point for GBIF occurrence/search requests.

    GBIF rate-limits the occurrence API per client. When it does, it answers HTTP 429 with a
    JSON *array* body - so res.json() succeeds, json.count is undefined, and every caller that
    does `total += json.count` silently turns its running total into NaN. That is exactly where
    the NaN in the species-list occurrence column comes from: the species explorer fires one
    occurrence request per row per root-predicate query, all at once, and GBIF refuses most of them.
    Measured before this module: 42 of 60 concurrent occurrence requests came back 429.

    Two things are needed and neither alone is enough:

    - a concurrency limit, so we stop tripping the limiter in the first place
    - a retry with backoff, so the requests that do trip it come back with a real number.
      Without the retry we would only be trading a visible NaN for a silent zero, which is worse:
      a wrong count nobody notices beats a right one nobody gets.

    Callers get parsed JSON only for a genuinely OK response. Anything else throws, so no caller
    can mistake a rate-limit body for data.
*/
/*
    GBIF's limit turned out to be a burst budget over time, not a concurrency cap: with the budget
    drained, 2-at-a-time still drew 429s; with it full, 16-at-a-time drew none. So the retry is the
    load-bearing part and this number only sets the pace. 10 measured 300 requests in ~3.9s clean.
*/
const MAX_CONCURRENT = 10;
const MAX_RETRIES = 4;     //~0.25s, 0.5s, 1s, 2s (jittered) before giving up

let active = 0;
const waiting = [];

function pump() {
    while (active < MAX_CONCURRENT && waiting.length) {
        active++;
        waiting.shift()(); //hand out the slot synchronously, so the count cannot be oversubscribed
    }
}
function acquire() {
    return new Promise(resolve => { waiting.push(resolve); pump(); });
}
function release() {
    active--;
    pump();
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const backoff = attempt => Math.round(Math.pow(2, attempt) * 250 * (1 + Math.random())); //jittered, so a burst does not retry in lockstep

/*
    Fetch a GBIF url and return parsed JSON, queued behind the concurrency limit and
    retried through rate-limiting. Throws on a response we should not read as data.
    The slot is held across backoff sleeps on purpose - a client being told to slow down
    should not keep its other requests running at full rate.
*/
export async function gbifFetchJson(url, retries = MAX_RETRIES) {
    await acquire();
    try {
        for (let attempt = 0; ; attempt++) {
            let res;
            try {
                res = await fetch(url);
            } catch (err) { //network-level failure, no response at all
                if (attempt >= retries) {throw err;}
                await sleep(backoff(attempt));
                continue;
            }
            if (res.ok) {return await res.json();}
            if ((429 == res.status || res.status >= 500) && attempt < retries) {
                const after = Number(res.headers.get('Retry-After')); //GBIF does not always send it, so fall back to backoff
                console.log(`gbifFetch=>gbifFetchJson ${res.status}, retry ${attempt + 1}/${retries}:`, url);
                await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : backoff(attempt));
                continue;
            }
            let err = new Error(`GBIF responded ${res.status} for ${url}`);
            err.status = res.status;
            throw err;
        }
    } finally {
        release();
    }
}
