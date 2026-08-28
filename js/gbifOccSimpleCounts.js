import { getListSubTaxonKeys, getNubKey } from "../../VAL_Web_Utilities/js/gbifOccFacetCounts.js";
import { gbifFetchJson } from "./gbifFetch.js";
import { cacheThrough } from "./gbifCache.js";
import { getGbifTaxonKeyFromName, getGbifTaxonFromKey, getParentRank } from "../../VAL_Web_Utilities/js/fetchGbifSpecies.js";
const gbifApi = "https://api.gbif.org/v1";

/*
    The species explorer's hot path: one call per row, each costing a species lookup, a nubKey
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
    let res = await multiFetchOccSimpleCount(srch, fileConfig);
    res.nubKey = nub;
    res.keys = subs.keys;//.push(self.nubKey); //add self nubKey to array of keys for species-list key
    res.names = subs.names;
    res.search = srch; //return our enhanced searchTerm for caller to use
    return res;
}

async function multiFetchOccSimpleCount(searchTerm, fileConfig) {
    let arrQry = []; //declared out here on purpose: a let inside the try is not in scope in the catch below
    try {
        let xClud = searchTerm ? (searchTerm.includes('taxonKey')  ? 'taxonKey' : false) : false;
        xClud += searchTerm ? (searchTerm.includes('scientificName')  ? 'scientificName' : false) : false;
        let qrys = fileConfig.predicateToQueries(fileConfig.dataConfig.rootPredicate, xClud);
        let occTot = 0;
        let missed = 0;
        for (var i=0; i<qrys.length; i++) { //necessary: wait for a synchronous loop
            let qry = qrys[i];
            qry += searchTerm ? `&${searchTerm}` : '';
            let res = await fetchOccSimpleCount(qry);
            arrQry.push(res.query);
            //A missing count must never reach the sum. `occTot += undefined` is what put NaN in the species list.
            if (Number.isFinite(res.count)) {occTot += res.count;} else {missed++;}
            console.log(`gbifOccSimpleCounts=>multiFetchOccSimpleCount searchTerm=${searchTerm} RESULT`, res);
        }
        //A partial sum is a wrong number wearing the clothes of a right one. Say unavailable instead.
        return {total: missed ? null : occTot, arrQry:arrQry, missed:missed};
    } catch (err) {
        console.error(`gbifOccSimpleCounts=>multiFetchOccSimpleCount ERROR`, err);
        //throw err;
        return {total: null, arrQry:arrQry, missed:-1}
    }
}
async function fetchOccSimpleCount(filter) {
    let reqHost = gbifApi;
    let reqRoute = "/occurrence/search";
    let reqFilter = `?limit=0&${filter}`;
    let url = reqHost+reqRoute+reqFilter;
    let enc = encodeURI(url);

    try {
        //gbifFetchJson queues behind a concurrency limit and retries 429s, and throws rather than
        //handing back a rate-limit body. So json.count here is real, or we are in the catch.
        let json = await gbifFetchJson(enc);
        return {count:Number(json.count), query:enc};
    } catch (err) {
        console.error('gbifOccSimpleCounts=>fetchOccSimpleCount ERROR', err);
        return {count:null, query:enc}; //null, NOT 0 - a refused request must never read as "no occurrences"
    }
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