/*
    A cache for fetched GBIF data. NOT for user preferences - see the warning at the bottom.

    Three properties, which are exactly what the explorers were missing:

    - It survives the tab. localStorage, so a returning visitor gets an instant page instead of
      refetching what they already fetched this morning. The older caches here use sessionStorage,
      which dies with the tab and therefore can never hold yesterday's data - there is nothing for
      a daily refresh to refresh.

    - It goes stale on purpose. Every entry records when it was written and expires after TTL_HOURS,
      so the explorers pick up new GBIF data daily without anyone clearing anything.

    - Reload means refresh. Any reload navigation bypasses the cache for that page load. A script
      cannot tell ctrl-shift-R from F5 - the platform does not expose the difference - and it does
      not need to: someone pressing reload wants current data either way. Writes still happen on a
      reload, so the next ordinary navigation is fast again.

    Bump CACHE_VERSION when what we store, or what it means, changes. Entries from older versions
    are ignored and swept up on the next prune. That is the deploy-time escape hatch.

    NOT FOR PREFERENCES. siteName stays in storedData.js on purpose: a preference must not expire
    daily or vanish on reload. A reload that forgot the visitor's chosen atlas would be a bug, not
    a refresh.
*/
const CACHE_VERSION = 1;
const TTL_HOURS = 24;             //"daily" - a visitor returning tomorrow refetches, today does not
const NAMESPACE = 'valCache.';
const KEY_PREFIX = `${NAMESPACE}${CACHE_VERSION}.`;
const TTL_MS = TTL_HOURS * 60 * 60 * 1000;

//localStorage throws outright in some private windows and when site data is blocked. Degrade to
//memory rather than letting a cache failure take the page down with it.
const memory = new Map();
const store = (() => {
    try {
        const probe = `${NAMESPACE}probe`;
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        return window.localStorage;
    } catch (err) {
        console.log('gbifCache: localStorage unavailable, caching in memory for this page load only');
        return {
            getItem: k => memory.has(k) ? memory.get(k) : null,
            setItem: (k,v) => memory.set(k,v),
            removeItem: k => memory.delete(k),
            key: i => Array.from(memory.keys())[i],
            get length() {return memory.size;}
        };
    }
})();

const isReload = (() => {
    try {
        const nav = performance.getEntriesByType('navigation')[0];
        return nav ? 'reload' == nav.type : false;
    } catch (err) {return false;}
})();
if (isReload) {console.log('gbifCache: reload detected, serving this page from source');}

/*
    Return cached data for name, or null if there is none, it has expired, or this is a reload.
    null means "go fetch" - it is never a cached value, because we only ever store what a caller
    hands us and a caller with nothing to store should not be calling cacheSet.
*/
export function cacheGet(name) {
    if (isReload) {return null;}
    try {
        const raw = store.getItem(KEY_PREFIX + name);
        if (!raw) {return null;}
        const ent = JSON.parse(raw);
        if (!ent || !ent.t) {return null;}
        if (Date.now() - ent.t > TTL_MS) {store.removeItem(KEY_PREFIX + name); return null;}
        return ent.d;
    } catch (err) {
        try {store.removeItem(KEY_PREFIX + name);} catch (e) {}
        return null;
    }
}

export function cacheSet(name, data) {
    const rec = JSON.stringify({t: Date.now(), d: data});
    try {
        store.setItem(KEY_PREFIX + name, rec);
    } catch (err) { //in practice always QuotaExceededError - localStorage is ~5MB
        prune();
        try {store.setItem(KEY_PREFIX + name, rec);}
        catch (err2) {console.log('gbifCache: could not store', name, err2.name);}
    }
}

/*
    Read-through cache. Concurrent callers asking for the same name share one fetch - the species
    explorer renders every row at once and would otherwise fire the same request many times over.
    isCacheable decides whether a result is worth keeping: a count that GBIF refused to give us
    must never be stored, or one rate-limited page load would poison the number for a day.
*/
const inFlight = new Map();

export async function cacheThrough(name, fetchFn, isCacheable = () => true) {
    const hit = cacheGet(name);
    if (null !== hit && undefined !== hit) {return hit;}
    if (inFlight.has(name)) {return inFlight.get(name);}
    const pending = (async () => {
        const data = await fetchFn();
        if (isCacheable(data)) {cacheSet(name, data);}
        return data;
    })();
    inFlight.set(name, pending);
    try {return await pending;}
    finally {inFlight.delete(name);}
}

//Drop expired entries and any left by an older CACHE_VERSION. If that frees nothing, drop the
//oldest half - we are only ever called because a write just failed for want of room.
function prune() {
    const ours = [];
    try {
        for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (k && 0 == k.indexOf(NAMESPACE)) {ours.push(k);}
        }
    } catch (err) {return;}
    const now = Date.now();
    const live = [];
    let dropped = 0;
    for (const k of ours) {
        if (0 != k.indexOf(KEY_PREFIX)) {store.removeItem(k); dropped++; continue;} //older CACHE_VERSION
        try {
            const ent = JSON.parse(store.getItem(k));
            if (!ent || !ent.t || now - ent.t > TTL_MS) {store.removeItem(k); dropped++;}
            else {live.push([ent.t, k]);}
        } catch (err) {store.removeItem(k); dropped++;}
    }
    if (dropped) {console.log(`gbifCache: pruned ${dropped} expired entries`); return;}
    live.sort((a,b) => a[0] - b[0]);
    const half = Math.ceil(live.length / 2);
    for (let i = 0; i < half; i++) {store.removeItem(live[i][1]);}
    console.log(`gbifCache: storage full, dropped the ${half} oldest entries`);
}

//Clear everything this module owns, any version. For a "refresh data" control, or the console.
export function cacheClear() {
    const ours = [];
    try {
        for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (k && 0 == k.indexOf(NAMESPACE)) {ours.push(k);}
        }
    } catch (err) {return 0;}
    for (const k of ours) {store.removeItem(k);}
    console.log(`gbifCache: cleared ${ours.length} entries`);
    return ours.length;
}
