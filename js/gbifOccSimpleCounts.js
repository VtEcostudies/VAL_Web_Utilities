import { getListSubTaxonKeys } from "../../VAL_Web_Utilities/js/gbifOccFacetCounts.js";
import { getGbifTaxonKeyFromName, getGbifTaxonFromKey, getParentRank } from "../../VAL_Web_Utilities/js/fetchGbifSpecies.js";
const gbifApi = "https://api.gbif.org/v1";

export async function fetchOccSimpleCountByKey(taxonKey, fileConfig) {
    let self = await getGbifTaxonFromKey(taxonKey); //retrieve species info for species-list taxonKey - to get nubKey for below
    let srch = `taxonKey=${self.nubKey ? self.nubKey : taxonKey}`;
    let subs = {keys:[], names:[]}; //getListSubTaxonKeys fills this object with arrays of values
    if (fileConfig.dataConfig.drillRanks.includes(self.rank)) { //only drill-down lower ranks
        subs = await getListSubTaxonKeys(fileConfig, taxonKey); //get sub-nubKeys of species-list key
        for (const key of subs.keys) {
            srch += `&taxonKey=${key}`; //add sub-nubKeys to searchTerm to be used by fetchAll
        }
    }
    console.log(`gbifOccSimpleCount=>fetchOccCountByKey(${taxonKey})=> self-nubKey:`, self.nubKey, 'sub-nubKeys:', subs.keys, 'searchTerm:', srch);
    
    let res = {total: 0};
    //let res = await multiFetchOccSimpleCount(srch, fileConfig);
    if (self.nubKey) {subs.keys.push(self.nubKey);} //IMPORTANT FOR predicateFetch: add self nubKey to array of keys for species-list key
    if (subs.keys.length) {
        res = await predicateFetchOccSimpleCount(fileConfig.dataConfig.rootPredicate, subs.keys);
    }
    res.nubKey = self.nubKey;
    res.keys = subs.keys;//.push(self.nubKey); //add self nubKey to array of keys for species-list key
    res.names = subs.names;
    res.search = srch; //return our enhanced searchTerm for caller to use
    return res;
}

async function multiFetchOccSimpleCount(searchTerm, fileConfig) {
    try {
        let xClud = searchTerm ? (searchTerm.includes('taxonKey')  ? 'taxonKey' : false) : false;
        xClud += searchTerm ? (searchTerm.includes('scientificName')  ? 'scientificName' : false) : false;
        let qrys = fileConfig.predicateToQueries(fileConfig.dataConfig.rootPredicate, xClud);
        let occTot = 0;
        let arrQry = [];
        for (var i=0; i<qrys.length; i++) { //necessary: wait for a synchronous loop
            let qry = qrys[i];
            qry += searchTerm ? `&${searchTerm}` : '';
            let res = await fetchOccSimpleCount(qry);
            arrQry.push(res.query);
            occTot += res.count;
            console.log(`gbifOccSimpleCounts=>multiFetchOccSimpleCount searchTerm=${searchTerm} RESULT`, res);
        }
        return {total:occTot, arrQry:arrQry};
    } catch (err) {
        console.error(`gbifOccSimpleCounts=>multiFetchOccSimpleCount ERROR`, err);
        throw err;
    }
}
async function fetchOccSimpleCount(filter) {
    let reqHost = gbifApi;
    let reqRoute = "/occurrence/search";
    let reqFilter = `?limit=0&${filter}`;
    let url = reqHost+reqRoute+reqFilter;
    let enc = encodeURI(url);

    try {
        let res = await fetch(enc);
        let json = await res.json();
        return {count:json.count, query:enc};
    } catch (err) {
        console.error('gbifOccSimpleCounts=>fetchOccSimpleCount ERROR', err);
        return {count:0, query:enc};
    }
}

//fetch a simple count of occurrences without results or facet results
//for a given rootPredicate whose scope is defined by a list of taxonKeys,
//we must replace the rootPredicate taxonKeys section with the contents of input keys
export async function predicateFetchOccSimpleCount(predicate=false, keys=[]) {
    console.log('predicateFetchOccSimpleCount predicate:', predicate, 'keys:', keys);
    try {
        let reqHost = gbifApi;
        let reqRoute = "/occurrence/search/predicate";
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
        console.log('gbifOccSimpleCounts=>predicateFetchOccSimpleCount res.json:', json);
        return {total: json.count};
    } catch(err) {
        console.error('gbifOccSimpleCounts=>predicateFetchOccSimpleCount', err);
        console.error(predicate);
        throw {error: err.message, predicate: predicate};
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