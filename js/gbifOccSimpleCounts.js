import { getListSubTaxonKeys, getNubKey, getStoredOccCnts } from "../../VAL_Web_Utilities/js/gbifOccFacetCounts.js";
import { cacheThrough } from "./gbifCache.js";
import { occQuery } from "./gbifOccQuery.js";
import { getGbifTaxonKeyFromName, getGbifTaxonFromKey, getParentRank } from "../../VAL_Web_Utilities/js/fetchGbifSpecies.js";
const gbifApi = "https://api.gbif.org/v1";

/*
    Occurrence count for one species-list row.

    Reads the page-wide facet map, which costs ~3 requests for the whole page instead of ~3 per row.
    GBIF's taxonKey facet is hierarchical, so the taxon's own key already carries every descendant -
    no sub-taxon summing, which is exactly what used to double-count. See getStoredOccCnts.

    Falls back to a per-taxon query in the two cases the map cannot answer: a taxon GBIF cannot match
    at all (no nubKey to look up), and a map built from requests GBIF refused, where a lookup would
    silently undercount instead of admitting it does not know.
*/
export async function occCountForListTaxon(taxon, fileConfig) {
    const nub = await getNubKey(taxon);
    if (nub) {
        const agg = await getStoredOccCnts(fileConfig);
        if (agg && agg.objOcc && Number.isFinite(agg.total)) {
            const total = agg.objOcc[nub] ? agg.objOcc[nub] : 0;
            /*
                A zero is the one answer this map can get wrong, so it is the one answer we check.

                A non-zero count is the taxon's own hierarchical count and already contains every
                descendant - nothing can improve on it. A zero can also mean our classification and
                GBIF's disagree about where this taxon lives, so we looked up the wrong branch.
                Genus Paulinella is the worked example: our checklist calls it Protozoa, so the
                matcher returns the Protozoa homonym (8634019, no Vermont records), while the
                species underneath it sit in the backbone under Chromista/Cercozoa (3212296), which
                has the records. The per-taxon path finds them because it sums the children.

                Measured at 8-11% of rows on the val checklist, so verifying every zero is cheap.
            */
            if (total) {
                return {total:total, nubKey:nub, keys:[nub], names:[], search:`taxonKey=${nub}`, arrQry:agg.arrQry};
            }
            console.log(`occCountForListTaxon(${taxon.key}): facet map says zero, confirming per-taxon`);
        } else {
            console.log(`occCountForListTaxon(${taxon.key}): facet map unavailable, querying this taxon directly`);
        }
    }
    return fetchOccSimpleCountByKey(taxon.key, fileConfig);
}

/*
    The per-taxon path: one call per row, each costing a species lookup, a nubKey
    resolution and one occurrence query per root predicate - about 300 requests for a 100-row page.
    Cached per taxon per atlas, a return visit within the day costs none of them. See gbifCache.js
    for the daily expiry and the reload-means-refresh rule.

    A result whose total is not a number means GBIF refused us. Never store that, or one
    rate-limited page load would pin a wrong count in place for a day.
*/
export async function fetchOccSimpleCountByKey(taxonKey, fileConfig) {
    return cacheThrough(
        `occSimple.${fileConfig.dataConfig.atlasAbbrev}.${taxonKey}`,
        () => fetchOccSimpleCountByKeyFromGbif(taxonKey, fileConfig),
        res => Number.isFinite(res.total)
    );
}
async function fetchOccSimpleCountByKeyFromGbif(taxonKey, fileConfig) {
    let self = await getGbifTaxonFromKey(taxonKey); //retrieve species info for species-list taxonKey - to get nubKey for below
    let nub = await getNubKey(self); //WORKAROUND: self.nubKey is null for most kingdoms since the COL XR republication. See gbifOccFacetCounts.js.
    let srch = `taxonKey=${nub ?? taxonKey}`;
    let subs = {keys:[], names:[]}; //getListSubTaxonKeys fills this object with arrays of values
    if (fileConfig.dataConfig.drillRanks.includes(self.rank)) { //only drill-down lower ranks
        subs = await getListSubTaxonKeys(fileConfig, taxonKey); //get sub-nubKeys of species-list key
        for (const key of subs.keys) {
            srch += `&taxonKey=${key}`; //add sub-nubKeys to searchTerm to be used by fetchAll
        }
    }
    console.log(`gbifOccSimpleCount=>fetchOccCountByKey(${taxonKey})=> self-nubKey:`, nub, 'sub-nubKeys:', subs.keys, 'searchTerm:', srch);
    
    if (nub) {subs.keys.push(nub);} //IMPORTANT FOR predicateFetch: add self nubKey to array of keys for species-list key
/*
    let res = {total: 0};
    if (subs.keys.length) {
        res = await predicateFetchOccSimpleCount(fileConfig.dataConfig.rootPredicate, subs.keys);
    }
*/
    const agg = await occQuery(fileConfig, {search: srch}); //no facet: we only want the total
    const res = {total: agg.total, arrQry: agg.queries, missed: agg.missed};
    res.nubKey = nub;
    res.keys = subs.keys;//.push(self.nubKey); //add self nubKey to array of keys for species-list key
    res.names = subs.names;
    res.search = srch; //return our enhanced searchTerm for caller to use
    return res;
}

//fetch a simple count of occurrences without results or facet results
//for a given rootPredicate whose scope is defined by a list of taxonKeys,
//we must replace the rootPredicate taxonKeys section with the contents of input keys
export async function predicateFetchOccSimpleCount(predicate=false, keys=[]) {
    console.log('predicateFetchOccSimpleCount predicate:', predicate, 'keys:', keys);
    try {
        let reqHost = gbifApi;
        let reqRoute = `/occurrence/search/predicate?timestamp=${Date.now()}`;
        let url = reqHost+reqRoute;
        let enc = encodeURI(url);
        if (keys.length) {
            predicate = replaceTaxonKeysInPredicate(predicate, keys);
        }
        if (predicate) {
            predicate = predicateForV1Api(predicate);
            predicate = {"limit": 0, "predicate": predicate}
        }
        console.log('gbifOccSimpleCounts=>predicateFetchOccSimpleCount url:', url);
        console.log('gbifOccSimpleCounts=>predicateFetchOccSimpleCount predicate:', predicate);
        let res = await fetch(enc, 
            {
            method: "POST",
            headers: {'Content-Type': 'application/json'},      
            body: JSON.stringify(predicate)
            }
        );
        console.log('gbifOccSimpleCounts=>predicateFetchOccSimpleCount res:', res);
        let json = await res.json();
        if (res.ok) {
          console.log('gbifOccSimpleCounts=>predicateFetchOccSimpleCount res.json:', json);
          return {total: json.count};
        } else {
          return {total: -1}
        }
    } catch(err) {
        console.error('gbifOccSimpleCounts=>predicateFetchOccSimpleCount', err);
        console.error(predicate);
        //throw {error: err.message, predicate: predicate};
        return {total: -1}
    };
}

/* Alter the rootPredicate:
- if rootPredicate is defined by taxonKeys, replace root taxonKeys with search taxonKeys
- if rootPredicate is not defined by taxonKeys, simply add search taxonKeys to each sub-predicate
*/
function replaceTaxonKeysInPredicate(root, keys) {
    console.log('replaceTaxonKeysInPredicate before', root);
    let keysPredicateFound = false;
    for (var top of root.predicates) {
        for (var sub of top.predicates) {
            if ("taxonkey"==sub.key.toLowerCase() || "TAXON_KEY"==sub.key.toUpperCase()) {
                sub.values = keys;
                keysPredicateFound = true;
            }
        }
        if (keys.length && !keysPredicateFound) {
            top.predicates.push(
                {"type":"in","key":"TAXON_KEY","values":keys}
            )
        }
    }
    console.log('replaceTaxonKeysInPredicate after', root);
    return root;
}

/* Alter the rootPredicate:
- if rootPredicate is defined by "key":"geometry", copy "value":"POLYGON ((...))" to "geometry":"POLYGON ((...))"
- GBIF v1 API uses "type":"within","geometry":"POLYGON ((...))"
- GBIF data-widgets use "type":"within","key":"geometry","value":"POLYGON ((...))"
*/
function geometryForv1Predicate(root) {
    console.log('geometryForv1Predicate before', root);
    for (var top of root.predicates) {
        for (var sub of top.predicates) {
            if ("geometry"==sub.key.toLowerCase()) {
                sub.geometry = sub.value;
            }
        }
    }
    console.log('geometryForv1Predicate after', root);
    return root;
}

function predicateForV1Api(predicate) {
    let alter = JSON.stringify(predicate);
    alter = alter.replace(/gadmGid/g,"GADM_GID")
    alter = alter.replace(/taxonKey/g,"TAXON_KEY")
    alter = alter.replace(/hasCoordinate/g,"HAS_COORDINATE")
    alter = alter.replace(/occurrenceStatus/g,"OCCURRENCE_STATUS")
    alter = alter.replace(/country/g,"COUNTRY")
    alter = alter.replace(/stateProvince/g,"STATE_PROVINCE")
    alter = alter.replace(/locality/g,"LOCALITY")
    //alter = alter.replace(/geometry/g,"GEOMETRY") //not necessary. DON'T DO THIS for geometry.
    let json = JSON.parse(alter);
    json = geometryForv1Predicate(json);
    console.log('predicateForV1Api:', json);
    return json;
}