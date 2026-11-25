/*
localStorage is a property that allows JavaScript sites and apps to save key-value pairs in a web browser with no expiration date. 
This means the data stored persists even after the user closes the browser or restarts the computer.
sessionStorage is similar to localStorage; the difference is that while data in localStorage doesn't expire, data in sessionStorage 
is cleared when the page session ends. Whenever a document is loaded in a particular tab in the browser, a unique page session gets 
created and assigned to that particular tab.
*/
import { occQuery } from "./gbifOccQuery.js";

const gbifApi = "https://api.gbif.org/v1";

/*
    Occurrence counts for every taxon at once, as {taxonKey:count}, cached for the day.

    This is what got disabled in 2024-11 (VAL_Data_Explorers 5eb8ccc) with the note "must restrict
    to accepted species & subspecies for now - it double-counts some sub-taxa for genus and above".
    That restriction was narrow enough that per-taxon queries won instead, and the explorer has paid
    ~300 requests a page ever since.

    The double-count was never in the facet. It was in what we did with the facet. GBIF's taxonKey
    facet is HIERARCHICAL: an occurrence is counted under every key in its lineage, so the same 1131
    Vermont Amanita records appear under Fungi, Basidiomycota, Agaricomycetes, Agaricales,
    Amanitaceae AND Amanita, each reading 1131. A parent's count already contains its children.
    sumSubTaxonOccs then added the children on top - hence the doubling, and hence the rank
    restriction that made it not worth using.

    So there is nothing to sum. occCounts[nubKey] is the entire answer for any taxon GBIF recognises,
    at any rank: verified equal to a direct per-taxon occurrence query for 26 of 26 taxa across
    SPECIES, GENUS, FAMILY, ORDER and CLASS in four kingdoms. Only a taxon GBIF cannot match at all
    still needs a per-taxon query, and getNubKey now resolves nearly all of those.

    Cost: one request per root-predicate query for a whole page (~3, about 0.5MB of counts) against
    roughly 300 for a 100-row page done per taxon. See occCountForListTaxon in gbifOccSimpleCounts.js.
*/
export async function getStoredOccCnts(fileConfig, searchTerm='') {
    return getAggOccCounts(fileConfig, searchTerm, 'taxonKey');
}

/*
    For a given species-list higherTaxonKey, get a list of all its species-list sub-taxonKeys. 
    This is primarily used to sum occurrence counts across ACCEPTED and NON-ACCEPTED taxa when 
    GBIF does not agree with the species-list's taxon definitions.

    NOTE: We MUST return the nubKeys of the returned results b/c occCnts uses nubKeys,
    and the GBIF occurrence/search api only works with nubKeys.

    We already do this elsewhere, like this:

    https://api.gbif.org/v1/species/search?datasetKey=73eb16f0-4b06-4347-8069-459bc2d96ddb&higherTaxonKey=177419414
*/
export async function getListSubTaxonKeys(fileConfig, higherTaxonKey) {
    let speciesFilter = fileConfig.dataConfig.speciesFilter;
    return getListSubTaxonKeysByFilter(speciesFilter, higherTaxonKey);
}
/*
    The one decision every occurrence-count path makes before drilling into a species-list taxon's sub-taxa.

    Drill when:
    - the taxon's rank is in the atlas's drillRanks (the low ranks, where drilling is cheap), or
    - GBIF's backbone has no match for it (vtFishes Actinopterygii, VAL Teleostei, Capparales), or
    - its backbone key has no records in the atlas (VAL Reptilia: an empty backbone stub).
    Otherwise GBIF's own hierarchical count for the taxon stands, and we do not look beneath it.
    That is what keeps a taxon like Plantae - matched, with records - from walking its whole subtree.

    The zero check is one small count query for the taxon's own backbone key, cached like any other.
    A refused query (total null) is not a zero: we do not drill on an unknown.

    Whatever the reason, getListSubTaxonKeysByFilter refuses subtrees larger than DRILL_MAX_TAXA.
*/
export async function getDrillSubTaxonKeys(fileConfig, self, nub) {
    let why = '';
    if (fileConfig.dataConfig.drillRanks.includes(self.rank)) {why = `rank ${self.rank}`;}
    else if (!nub) {why = 'no backbone match';}
    else {
        const own = await occQuery(fileConfig, {search:`taxonKey=${nub}`});
        if (own.total === 0) {why = `backbone key ${nub} has no records`;}
    }
    if (!why) {return {keys:[], names:[]};}
    console.log(`getDrillSubTaxonKeys(${self.key}) ${self.canonicalName ? self.canonicalName : self.scientificName}: drilling because ${why}`);
    return getListSubTaxonKeys(fileConfig, self.key);
}
/*
    ---------------------------------------------------------------------------
    GBIF nubKey workaround. DELETE THIS BLOCK, and its one call in
    getListSubTaxonKeysByFilter below, when GBIF populates nubKey again.

    Since vt_species was republished from COL XR on 2026-08-26, GBIF indexes our
    checklist usages with issues:["BACKBONE_MATCH_NONE"] and no nubKey, while
    GBIF's own matcher resolves the very same names EXACT at confidence 97-100.
    It hits Fungi/Plantae/Protozoa/Chromista in dataset 0b1735ff-6a66-454b-8686-cae1cbc732a2.
    No nubKeys means nothing to facet on, which means every occurrence count is zero.

    To check whether this is still needed - if these results carry nubKeys, delete all of it:
    https://api.gbif.org/v1/species/search?datasetKey=0b1735ff-6a66-454b-8686-cae1cbc732a2&q=Amanita&limit=3

    See VAL_Taxonomy_Manager/docs/GBIF_NUBKEY_WORKAROUND.md.
    ---------------------------------------------------------------------------
*/
const nubKeyByListKey = new Map(); //memo of species-list usage key => backbone key (or null). Lives for the page session.

/*
    The backbone key for a species-list usage: whatever GBIF indexed, or - since it stopped
    indexing them - whatever GBIF's own matcher says. Callers that resolve a FOCAL taxon
    (gbifOccSimpleCounts, gbifCountsByWeek/Year/Date/Month) must use this instead of reading
    res.nubKey directly, or their counts are zero for every unmatched kingdom.
    When GBIF is fixed, this collapses back to `res.nubKey` and can be deleted with the rest.
*/
export async function getNubKey(res) {
    return res.nubKey ? res.nubKey : await matchNubKey(res);
}

async function matchNubKey(res) {
    if (nubKeyByListKey.has(res.key)) {return nubKeyByListKey.get(res.key);}
    let nub = null;
    try {
        let prm = new URLSearchParams({'name': res.scientificName ? res.scientificName : res.canonicalName});
        if (res.rank) {prm.set('rank', res.rank);}
        if (res.kingdom) {prm.set('kingdom', res.kingdom);} //a COL-only kingdom name only lowers confidence, it does not break the match
        let mch = await (await fetch(`${gbifApi}/species/match?${prm}`)).json();
        /*
            Two matches we MUST refuse, both verified against the live api:
            - usageKey 0 is 'incertae sedis'. It matches EXACT at confidence 98 but is not a backbone taxon.
            - HIGHERRANK hands back the GENUS key for a species it could not match, so one unmatched
              species would count the whole genus - and count it again for every unmatched sibling.
        */
        if (mch.usageKey && mch.matchType != 'NONE' && mch.matchType != 'HIGHERRANK') {nub = mch.usageKey;}
        console.log(`gbifOccFacetCounts=>matchNubKey(${res.key})`, res.scientificName, '| matchType:', mch.matchType, '| confidence:', mch.confidence, '=> nubKey:', nub);
        nubKeyByListKey.set(res.key, nub); //only memoize an answer GBIF actually gave us, never a failed request
    } catch (err) {
        console.log(`gbifOccFacetCounts=>matchNubKey(${res.key}) ERROR:`, res.scientificName, err);
    }
    return nub;
}
/*
    Find the backbone keys whose occurrences make up a species-list taxon, as GBIF does not already count them.

    Walk our list's whole subtree, top down. Every descendant (and every synonym, since GBIF often files
    records under the name we list as a synonym) that GBIF can match is a candidate. A candidate is added
    only if GBIF's backbone does not already place it under a key we hold - the taxon's own backbone key,
    or a key added higher up the walk. GBIF's counts are hierarchical, so those are already counted.

    What gets added, then, is exactly where our classification and GBIF's disagree:
    - vtFishes Actinopterygii (no class in GBIF's backbone): its 18 orders, and nothing below them unless
      GBIF files a genus or species under some other order.
    - a genus whose species GBIF knows only under older names: those names, via our synonyms.
    - a homonym (our genus matched to GBIF's same-named taxon elsewhere): its species, from where GBIF has them.

    Extra keys never double count - the occurrence query ORs them - they only lengthen the query, which GBIF
    rejects past a couple of hundred keys. So the 'already counted' test is about query size, not correctness.

    Cost: one species search for the subtree, plus one backbone parents lookup per matched descendant,
    memoized for the page session and run 20 at a time. Subtrees over DRILL_MAX_TAXA are refused outright.
    Callers should decide whether to drill at all with getDrillSubTaxonKeys, above.

    If an Atlas speciesFilter is defined by higherTaxonKeys, those are removed from the search, because
    duplicate http query params are treated as ORs. The search item itself constrains the taxonomic scope.
*/
export const DRILL_MAX_TAXA = 500; //largest real drill so far: VAL Pseudomonadota, 447 descendants. A walk costs up to one request per descendant.
const boneAncestry = new Map(); //memo of backbone key => Set of that key and its backbone ancestors' keys. Lives for the page session.
async function getBoneAncestry(nub) {
    if (!boneAncestry.has(nub)) {
        const parents = await (await fetch(`${gbifApi}/species/${nub}/parents`)).json();
        if (!Array.isArray(parents)) {throw new Error(`species/${nub}/parents returned no array`);} //never memoize a refused request
        boneAncestry.set(nub, new Set([nub, ...parents.map(p => p.key)]));
    }
    return boneAncestry.get(nub);
}
async function inBatches(items, fn, size=20) { //run fn over items 20 at a time, so a large rank does not invite GBIF 429s
    let out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
    }
    return out;
}
export async function getListSubTaxonKeysByFilter(speciesFilter, higherTaxonKey) {
    const nubs = [];
    const name = [];
    let enc = '';
    try {
        let fixedFilter = speciesFilter.split('&').filter(ele => !ele.includes('higherTaxonKey')).join('&');
        let rslt = [];
        for (let offset = 0, end = false; !end; offset += 1000) {
            enc = encodeURI(`${gbifApi}/species/search?${fixedFilter}&higherTaxonKey=${higherTaxonKey}&limit=1000&offset=${offset}`);
            const json = await (await fetch(enc)).json();
            if (json.count > DRILL_MAX_TAXA) { //the scope limit: never walk a subtree this size, whatever asked for it
                console.warn(`getListSubTaxonKeys(${higherTaxonKey}): ${json.count} descendants exceeds DRILL_MAX_TAXA (${DRILL_MAX_TAXA}) - not drilling`);
                return {'keys':[], 'names':[], 'query':enc, 'skipped':json.count};
            }
            rslt = rslt.concat(json.results ? json.results : []);
            end = json.endOfRecords !== false;
        }
        const kidsOf = new Map(); //accepted usage key => its accepted children
        const synsOf = new Map(); //accepted usage key => its synonyms (a synonym's parentKey is not reliable; acceptedKey is)
        for (const res of rslt) {
            const [map, key] = res.acceptedKey ? [synsOf, res.acceptedKey] : [kidsOf, res.parentKey];
            if (!map.has(key)) {map.set(key, []);}
            map.get(key).push(res);
        }
        //The taxon's own backbone key is the first 'held' key. Callers add it to the query themselves.
        const held = new Set();
        const self = await (await fetch(`${gbifApi}/species/${higherTaxonKey}`)).json();
        const selfNub = self && self.key ? await getNubKey(self) : null;
        if (selfNub) {held.add(selfNub);}

        let level = [higherTaxonKey];
        while (level.length) {
            //this rank's candidates: synonyms of the taxa we are standing on, and their accepted children
            const cands = [];
            const next = [];
            for (const key of level) {
                cands.push(...(synsOf.get(key) || []));
                for (const kid of (kidsOf.get(key) || [])) {cands.push(kid); next.push(kid.key);}
            }
            /*
                WORKAROUND: getNubKey falls back to GBIF's own matcher for any usage GBIF indexed without a nubKey.
                Delete matchNubKey (not this call) when GBIF populates nubKey again.
            */
            const bone = await inBatches(cands, res => getNubKey(res));
            const matched = cands.map((res, idx) => [res, bone[idx]]).filter(([res, nub]) => nub && !held.has(nub));
            const lineage = await inBatches(matched, ([res, nub]) => getBoneAncestry(nub));
            matched.forEach(([res, nub], idx) => {
                if ([...lineage[idx]].some(key => held.has(key))) {return;} //GBIF already counts this under a key we hold
                held.add(nub);
                nubs.push(nub);
                name.push(res.canonicalName);
            });
            level = next; //walk all the way down: a deeper taxon may sit somewhere else in GBIF's backbone
        }
        console.log(`getListSubTaxonKeys(${speciesFilter}, ${higherTaxonKey})`, nubs, name);
        return {'keys':nubs, 'names':name, 'query':enc};
    } catch (err) {
        err.query = enc;
        console.log(`getListSubTaxonKeys(${speciesFilter}, ${higherTaxonKey}) ERROR:`, err);
        return Promise.reject(err);
    }
}
/*
    For a given GBIF backbone higherTaxonKey, get a list of all its backbone sub-taxonKeys. 
    This is used as a list of keys to remove from a retrieved list of species-list keys NOT
    recognized by the GBIF backbone.

    Input: higherTaxonKey MUST be a GBIF nubKey
*/
export async function getBoneSubTaxonKeys(higherTaxonKey) {
    try {
        let reqHost = gbifApi;
        let reqRoute = "/species/search";
        let reqFilter = `?higherTaxonKey=${higherTaxonKey}`;
        let url = reqHost+reqRoute+reqFilter;
        let enc = encodeURI(url);

        let res = await fetch(enc);
        let json = await res.json();
        //console.log(`getBoneSubTaxonKeys(${higherTaxonKey}) QUERY:`, enc);
        //console.log(`getBoneSubTaxonKeys(${higherTaxonKey}) RESULT:`, json);
        let nubs = [];
        let name = [];
        for (const idx in json.results) { //returns array indexes of array of objects
            //console.log(`element of array:`, idx);
            if (json.results[idx].nubKey) {
                nubs.push(json.results[idx].nubKey);
                name.push(json.results[idx].canonicalName);
            }
        }
        console.log(`getBoneSubTaxonKeys(${higherTaxonKey})`, nubs, name);
        return {'keys':nubs, 'names':name, 'query':enc};
    } catch (err) {
        err.query = enc;
        console.log(`getBoneSubTaxonKeys(${higherTaxonKey}) ERROR:`, err);
        return Promise.reject(err);
    }
}
/*
NOTE: higherTaxonKey must be from species-list overlay (NOT nubKey) but occCounts is indexed by nubKey.
This means several things...
- getListSubTaxonKeys returns subTaxon nubKeys to be used in our stored backbone indexes
- getBoneSubTaxonKeys returns subTaxon nubKeys to remove from the above list (because GBIF already counts them by default)
*/
export async function sumSubTaxonOccs(fileConfig, occCounts, higherTaxonKey, nubKey=0) {
    try {
        console.log(`sumSubTaxonOccs(${higherTaxonKey}, ${nubKey})`);
        let res = await getListSubTaxonKeys(fileConfig, higherTaxonKey);
        let nub = nubKey ? await getBoneSubTaxonKeys(nubKey) : [];
        let sum = 0;
        for (const idx in res.keys) {
            if (nub.keys.find(ele => {return ele ==  res.keys[idx]})) {
                console.log(`sumSubTaxonOccs SKIPPING higherTaxonKey ${res.keys[idx]} equal to nubKey`);
            } else {
                console.log(`sumSubTaxonOccs Adding taxon ${res.keys[idx]}`, occCounts[res.keys[idx]]);
                sum += occCounts[res.keys[idx]] ? occCounts[res.keys[idx]] : 0;
            }
        }
        console.log(`sumSubTaxonOccs(${higherTaxonKey})`, sum);
        res.sum = sum;
        return res;
    } catch(err) {
        console.log(`sumSubTaxonOccs(${higherTaxonKey}) ERROR:`, err);
        return Promise.reject(err)
    }
}
/*
    Iterate over root predicate queries. Sum aggregate occurrence counts across queries for a
    single facet (or NO facet by passing facet=false).

    To potentially order species-list results across a large number of results, we need an
    ordered list of occurrence counts by taxonKey and taxonRank. The taxonKey facet results
    are a descending-ordered array by occurrence-count, but since we sum those across more
    than one rootPredicate query, list-sums are not necessarily ordered.

    This idea requires that for a specific species-list query, we somehow pre-query all taxonIds
    within it (filtered by user-defined constraints) then compare that list to our ordered list
    of occurrence-counts and present the union, ordered by those counts. This seems impossible
    unless we find a way to retrieve all results for any query all the time.

    NOTE: Here the xClud flag is critical. When an explorer site's scope is defined by taxonomy, we
    must remove those taxonNames or Keys when searching for specific taxa because the http API converts
    duplicate AND params to ORs.
*/
export async function getAggOccCounts(fileConfig, searchTerm='', facet='taxonKey', facetArgs='facetLimit=1199999') {
    const res = await occQuery(fileConfig, {
        search: searchTerm ? searchTerm : '',   //callers pass '' and false alike
        facet: facet,                           //'taxonKey' or ['taxonKey'] - both are in use
        facetArgs: facetArgs
    });
    return {total:res.total, objOcc:res.counts, arrQry:res.queries, missed:res.missed};
}

/*
    Get occurrence-counts aggregated by facet mediaType for a filter query.
    Return an object like {taxonKey:count, taxonKey:count, ...}
    https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&limit=0&taxonKey=5&facet=mediaType&facetLimit=100000
    https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&hasCoordinate=false&limit=0&taxonKey=5&facet=mediaType&facetLimit=100000
    IMPORTANT NOTE: It appears that this approach returns occurrence counts for nubKeys. Everywhere that uses these must do the same.
*/
export async function getAggImgCount(fileConfig, filter=false) {
    const res = await occQuery(fileConfig, {facet:'mediaType', scope: filter ? [filter] : null});
    const counts = Object.assign({}, res.counts);
    counts.query = res.queries[0]; //kept: callers read .query off the returned object
    return counts;
}

/*
    Image count for one taxon. Was returning facets[0].counts[0] - "whichever bucket GBIF happened
    to sort first" - which is StillImage only because it is usually the commonest. Now says so.
    No callers in this workspace at the time of writing.
*/
export async function getImgCount(fileConfig, key) {
    const res = await occQuery(fileConfig, {search:`taxon_key=${key}`, facet:'mediaType'});
    return {name:'StillImage', count: res.counts.StillImage ? res.counts.StillImage : 0};
}
