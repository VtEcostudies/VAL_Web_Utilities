/*
    One way to ask GBIF "how many occurrences, and broken down how?"

    Every occurrence number in the explorers - a species-list row, a stats tile, a phenology chart,
    a CSV column - was the same question asked five different ways, each file rebuilding the same
    URLs, awaiting the same fetches, summing the same totals and merging the same facet buckets.
    That duplication is where the bugs lived: the 429-as-data bug had to be fixed in six places
    because the fetch was written six times.

    So there is one primitive here, and everything else is a thin wrapper over it.

    A query has three parts:

      scope   - WHERE to look. An atlas's rootPredicate expands to several http queries (Vermont is
                three: a gadm boundary plus two spellings of stateProvince for records with no
                coordinates), and their counts are summed. Callers with their own scope pass it.
      search  - WHAT to narrow to. `taxonKey=5` or `scientificName=Danaus plexippus`, or nothing.
      facet   - HOW to break the answer down. 'taxonKey', 'year', 'month', 'recordedBy', or nothing
                for a plain total.

    Returns {total, counts, queries, missed}:

      total   - a number, or null if any scope query went unanswered. Never a partial sum dressed
                as a whole one, and never NaN.
      counts  - {facetValue: count} merged across the scope queries. {} when no facet was asked for.
      queries - the URLs actually run, for the "(Error)" links and for debugging.
      missed  - how many scope queries did not answer.

    Answers are cached for the day, keyed on the URLs themselves - so anything that changes the
    answer changes the key, and nothing else has to be remembered. See gbifCache.js for the daily
    expiry and the reload-means-refresh rule, and gbifFetch.js for rate-limit handling.
*/
import { gbifFetchJson } from "./gbifFetch.js";
import { cacheThrough } from "./gbifCache.js";

const gbifApi = "https://api.gbif.org/v1";

/*
    When the search IS a taxon, the atlas's own taxon filters must come out of the scope queries.
    GBIF reads duplicate http params as ORs, so leaving both in widens the search instead of
    narrowing it - asking for "this one species OR the whole atlas" and getting the whole atlas.

    predicateToQueries takes the field names to drop as a single string and matches with .includes,
    or the boolean true to drop taxonKey and scientificName both. The old callers built that string
    by adding `false` to it and relying on "falsescientificName" still containing "scientificName";
    this says the same thing on purpose.
*/
function scopeFromConfig(fileConfig, search, dropScopeTaxa) {
    if (!fileConfig || !fileConfig.predicateToQueries) {return [];}
    let drop = dropScopeTaxa ? true : '';
    if (!dropScopeTaxa && search) {
        if (search.includes('taxonKey')) {drop += 'taxonKey';}
        if (search.includes('scientificName')) {drop += 'scientificName';}
    }
    return fileConfig.predicateToQueries(fileConfig.dataConfig.rootPredicate, drop ? drop : false);
}

//facet accepts 'taxonKey' or ['taxonKey'] - the explorers pass both - and '' or [] for no facet.
//facetArgs may or may not lead with '&'; callers differ, and both should mean the same thing.
function buildUrls(scope, search, facet, facetArgs) {
    const name = String(facet ? facet : '');
    const args = String(facetArgs ? facetArgs : '').replace(/^&+/, '');
    return scope.map(qry => {
        let url = `${gbifApi}/occurrence/search?limit=0&${qry}`;
        if (search) {url += `&${search}`;}
        if (name) {url += `&facet=${name}`; if (args) {url += `&${args}`;}}
        return encodeURI(url);
    });
}

async function runQuery(urls) {
    const answers = await Promise.all(urls.map(async url => {
        try {return await gbifFetchJson(url);}
        catch (err) {console.log('gbifOccQuery: no answer for', url, err.message); return null;}
    }));
    let total = 0, missed = 0;
    const counts = {};
    for (const json of answers) {
        //A refused request has no count. Letting undefined into the sum is what produced NaN.
        if (!json || !Number.isFinite(json.count)) {missed++; continue;}
        total += json.count;
        const buckets = (json.facets && json.facets[0]) ? json.facets[0].counts : [];
        for (const b of buckets) {counts[b.name] = (counts[b.name] ? counts[b.name] : 0) + Number(b.count);}
    }
    return {total: missed ? null : total, counts:counts, queries:urls, missed:missed};
}

/*
    opts: {search, facet, facetArgs, scope, dropScopeTaxa, cache}
      scope         - explicit array of http query strings, instead of the atlas rootPredicate
      dropScopeTaxa - drop the atlas's taxon filters regardless of what search looks like
      cache         - false to force a fresh read
*/
export async function occQuery(fileConfig, opts = {}) {
    const {search = '', facet = '', facetArgs = 'facetLimit=1199999',
           scope = null, dropScopeTaxa = false, cache = true} = opts;
    const where = (scope && scope.length) ? scope : scopeFromConfig(fileConfig, search, dropScopeTaxa);
    if (!where.length) {
        console.log('gbifOccQuery: nothing to query - no scope and no rootPredicate');
        return {total: null, counts:{}, queries:[], missed:0};
    }
    const urls = buildUrls(where, search, facet, facetArgs);
    if (!cache) {return runQuery(urls);}
    return cacheThrough(
        `occ.${urls.join('|')}`,          //the URLs ARE the identity of the answer
        () => runQuery(urls),
        res => Number.isFinite(res.total) //never cache a total built from refused requests
    );
}
