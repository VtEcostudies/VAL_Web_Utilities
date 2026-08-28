/*
localStorage is a property that allows JavaScript sites and apps to save key-value pairs in a web browser with no expiration date. 
This means the data stored persists even after the user closes the browser or restarts the computer.
sessionStorage is similar to localStorage; the difference is that while data in localStorage doesn't expire, data in sessionStorage 
is cleared when the page session ends. Whenever a document is loaded in a particular tab in the browser, a unique page session gets 
created and assigned to that particular tab.
*/
import { gbifFetchJson } from "./gbifFetch.js";
import { cacheThrough } from "./gbifCache.js";

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
    let storeName = `occCnts.${fileConfig.dataConfig.atlasAbbrev}`;
    if (searchTerm) {storeName += `.${searchTerm}`;}
    return cacheThrough(
        storeName,
        () => getAggOccCounts(fileConfig, searchTerm),
        res => res && Number.isFinite(res.total) //never cache a map built from refused requests
    );
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
    Again here as with elsewhere, if an Atlas speciesFilter is defined by higherTaxonKeys, then our search for 
    subKeys by a specific higherTaxonKey fails because duplicate http query params are treated as ORs.
    Same as elsewhere, if speciesFilter contains higherTaxonKeys, we remove those and just find subKeys for
    the search item itself, since it constrains the taxonomic scope.
*/
export async function getListSubTaxonKeysByFilter(speciesFilter, higherTaxonKey) {
    try {
        let fixedFilter = speciesFilter.split('&').map(ele => {
            console.log(`getListSubTaxonKeys=>speciesFilter element:`, ele, 'includes higherTaxonKey:', ele.includes('higherTaxonKey'));
            return !ele.includes('higherTaxonKey') ? ele : null;
            }).join('&');
        console.log('gbifOccFacetCounts=>getListSubTaxonKeys | speciesFilter:', speciesFilter, 'fixedFilter',fixedFilter);
        let reqHost = gbifApi;
        let reqRoute = "/species/search";
        let reqFilter = `?${fixedFilter}&higherTaxonKey=${higherTaxonKey}`;
        let url = reqHost+reqRoute+reqFilter;
        let enc = encodeURI(url);

        let res = await fetch(enc);
        let json = await res.json();
        //console.log(`getListSubTaxonKeys(${speciesFilter}, ${higherTaxonKey}) QUERY:`, enc);
        //console.log(`getListSubTaxonKeys(${speciesFilter}, ${higherTaxonKey}) RESULT:`, json);
        let nubs = [];
        let name = [];
        let rslt = json.results ? json.results : [];
        /*
            WORKAROUND: fall back to GBIF's own matcher for any usage GBIF indexed without a nubKey.
            Resolved in parallel because this function passes no limit, so json.results is GBIF's
            default page of 20 - at most ~20 extra requests, dispatched at once rather than in series.
            Delete matchNubKey (not the loop) when GBIF populates nubKey again.
        */
        let bone = await Promise.all(rslt.map(res => getNubKey(res)));
        rslt.forEach((res, idx) => {
            if (bone[idx]) {
                nubs.push(bone[idx]);
                name.push(res.canonicalName);
            }
        });
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
export async function getAggOccCounts(fileConfig, searchTerm='', facet='taxonKey', facetArgs='&facetLimit=1199999') {
    try {
        let xClud = searchTerm ? (searchTerm.includes('taxonKey')  ? 'taxonKey' : false) : false;
        xClud += searchTerm ? (searchTerm.includes('scientificName')  ? 'scientificName' : false) : false;
        let qrys = fileConfig.predicateToQueries(fileConfig.dataConfig.rootPredicate, xClud);
        let objOcc = {};
        let occTot = 0;
        let missed = 0;
        let arrQry = [];
        for (var i=0; i<qrys.length; i++) { //necessary: wait for a synchronous loop
            let qry = qrys[i];
            qry += searchTerm ? `&${searchTerm}` : '';
            let aoc = await getAggOccCount(fileConfig.dataConfig, qry, facet, facetArgs);
            //getAggOccCount returns an Error object on failure, whose .total is undefined.
            //`occTot += undefined` is NaN, and NaN is what reached the stats panel.
            if (Number.isFinite(aoc.total)) {occTot += aoc.total;} else {missed++; console.log('getAggOccCounts: no total for', qry);}
            arrQry.push(aoc.query);
            for await (const [key,val] of Object.entries(aoc.obj)) {
                if (objOcc[key]) {objOcc[key] += Number(val);}
                else {objOcc[key] = Number(val);}
            }
            console.log(`getAggOccCounts searchTerm=${searchTerm} facet=${facet} RESULT`, objOcc);
        }
        //A partial sum is a wrong number wearing the clothes of a right one. Say unavailable instead.
        return {total: missed ? null : occTot, objOcc:objOcc, arrQry:arrQry, missed:missed};
    } catch (err) {
        console.log(`getAggOccCounts ERROR`, err);
        return Promise.reject(err);
    }
}
/*
    Get occurrence-counts aggregated by facet (taxonKey, mediaType, etc.) for a filter query.
    Return an object like {taxonKey:count, taxonKey:count, ...}
    https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&limit=0&taxonKey=5&facet=taxonKey&facetLimit=100000
    https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&hasCoordinate=false&limit=0&taxonKey=5&facet=taxonKey&facetLimit=100000
    IMPORTANT NOTE: It appears that this approach returns occurrence counts for nubKeys. Everywhere that uses these must do the same.
*/
export async function getAggOccCount(dataConfig, filter=dataConfig.occurrenceFilter, facet='taxonKey', facetArgs='&facetLimit=1199999') {
    let reqHost = gbifApi;
    let reqRoute = "/occurrence/search";
    let reqFilter = `?limit=0&${filter}`;
    //let reqFacet = facets.map(facet => `&facet=${facet}`); reqFacet += facetArgs;
    let reqFacet = `&facet=${facet}&${facetArgs}`; //wow, OK, taking `${['facetName']}` strips string from array. totally unexpected bug-fix.
    let url = reqHost+reqRoute+reqFilter+reqFacet;
    let enc = encodeURI(url);

    try {
        //gbifFetchJson queues behind the shared limiter and retries GBIF's 429s. Reading a
        //rate-limit body as data is what turned these totals into NaN.
        let json = await gbifFetchJson(enc);
        //console.log(`getAggOccCount(${filter}) QUERY:`, enc);
        //console.log(`getAggOccCount(${filter}) RESULT:`, json);
        let fCount = (json.facets && json.facets[0]) ? json.facets[0].counts : []; //array of occurrence-counts by taxonKey
        let aCount = [];
        let oCount = {};
        for (var i=0; i<fCount.length; i++) { //put array into object like {taxonKey:count, taxonKey:count, ...}
            oCount[fCount[i].name]=Number(fCount[i].count);
            aCount[i] = {'taxonKey':fCount[i].name, 'occurrences':Number(fCount[i].count)};
        }
        let retObj =  {'obj':oCount, 'arr':aCount, 'total':Number(json.count), 'query':enc};
        return retObj;
    } catch (err) {
        err.query = enc;
        console.log(`getAggOccCount(${filter}) ERROR:`, err);
        return new Error(err)
    }
}

/*
    Get occurrence-counts aggregated by facet mediaType for a filter query.
    Return an object like {taxonKey:count, taxonKey:count, ...}
    https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&limit=0&taxonKey=5&facet=mediaType&facetLimit=100000
    https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&hasCoordinate=false&limit=0&taxonKey=5&facet=mediaType&facetLimit=100000
    IMPORTANT NOTE: It appears that this approach returns occurrence counts for nubKeys. Everywhere that uses these must do the same.
*/
export async function getAggImgCount(dataConfig, filter = dataConfig.occurrenceFilter) {
    let reqHost = gbifApi;
    let reqRoute = "/occurrence/search";
    let reqFilter = `?limit=0&${filter}`;
    let reqFacet = `&facet=mediaType&facetLimit=1199999`;
    let url = reqHost+reqRoute+reqFilter+reqFacet;
    let enc = encodeURI(url);

    try {
        //gbifFetchJson queues behind the shared limiter and retries GBIF's 429s. Reading a
        //rate-limit body as data is what turned these totals into NaN.
        let json = await gbifFetchJson(enc);
        //console.log(`getAggImgCount(${filter}) QUERY:`, enc);
        console.log(`getAggImgCount(${filter}) RESULT:`, json);
        let fCount = (json.facets && json.facets[0]) ? json.facets[0].counts : []; //array of occurrence-counts by taxonKey
        let oCount = {};
        for (var i=0; i<fCount.length; i++) { //put array into object like {taxonKey:count, taxonKey:count, ...}
            oCount[fCount[i].name]=Number(fCount[i].count);
        }
        oCount.query = enc;
        return oCount;
    } catch (err) {
        err.query = enc;
        console.log(`getAggImgCount(${filter}) ERROR:`, err);
        return new Error(err)
    }
}

/*
Get an image count from the occurrence API by taxonKey and occurrenceFilter
https://api.gbif.org/v1/occurrence/search?gadm_gid=USA.46_1&taxonKey=1&limit=0&facet=mediaType
results are like
{
    offset: 0,
    limit: 0,
    endOfRecords: false,
    count: 217526.
    results: [],
    facets [
    field: "MEDIA_TYPE",
    counts [
        counts[0].name:"StillImage"
        counts[0].count:2837
        counts[1].name:"Sound"
        counts[1].count:149
        counts[2].name:"MovingImage"
        counts[2].count:149
    ]
    ]
}
*/
export async function getImgCount(dataConfig, key) {
    let reqHost = gbifApi;
    let reqRoute = "/occurrence/search";
    let reqFilter = `?advanced=1&limit=0&${dataConfig.occurrenceFilter}&taxon_key=${key}`
    let reqFacet = `&facet=mediaType`;
    let reqLimit = `&limit=0`;
    let url = reqHost+reqRoute+reqFilter+reqLimit+reqFacet;
    let enc = encodeURI(url);

    try {
        let res = await fetch(enc);
        let json = await res.json();
        console.log(`getImgCount(${key}) QUERY:`, enc);
        console.log(`getImgCount(${key}) RESULT:`, json);
        let jret = json.facets[0].counts[0];
        jret = typeof jret === 'object' ? jret : {count:0};
        return jret;
    } catch (err) {
        err.query = enc;
        console.log(`getImgCount(${key}) ERROR:`, err);
        return new Error(err)
    }
}