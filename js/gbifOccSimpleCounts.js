import { getListSubTaxonKeys } from "../../VAL_Web_Utilities/js/gbifOccFacetCounts.js";
import { getGbifTaxonKeyFromName, getGbifTaxonFromKey, getParentRank } from "../../VAL_Web_Utilities/js/fetchGbifSpecies.js";
const gbifApi = "https://api.gbif.org/v1";

export async function fetchOccSimpleCountByKey(taxonKey, fileConfig) {
    let self = await getGbifTaxonFromKey(taxonKey); //retrieve species info for species-list taxonKey - to get nubKey for below
    let srch = `taxonKey=${self.nubKey ? self.nubKey : taxonKey}`;
    let subs = {keys:[]};
    if (fileConfig.dataConfig.drillRanks.includes(self.rank)) { //only drill-down lower ranks
        subs = await getListSubTaxonKeys(fileConfig, taxonKey); //get sub-nubKeys of species-list key
        for (const key of subs.keys) {
            srch += `&taxonKey=${key}`; //add sub-nubKeys to searchTerm to be used by fetchAll
        }
    }
    console.log(`gbifOccSimpleCount=>fetchOccCountByKey(${taxonKey})=> self-nubKey:`, self.nubKey, 'sub-nubKeys:', subs.keys, 'searchTerm:', srch);
    
    let res = await multiFetchOccSimpleCount(srch, fileConfig);
    res.nubKey = self.nubKey;
    res.keys = subs.keys.push(self.nubKey); //add self nubKey to array of keys for species-list key
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

async function predicateFetchOccSimpleCount(searchTerm, fileConfig) {

}