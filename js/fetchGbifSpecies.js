let gbifApi = "https://api.gbif.org/v1";
export const datasetKeys = {
    "chkVtb1":"73eb16f0-4b06-4347-8069-459bc2d96ddb"
};
export var checklistVtButterflies;
export var checklistVernacularNames;

/*
    https://api.gbif.org/v1/species/search?dataset_key=73eb16f0-4b06-4347-8069-459bc2d96ddb&limit=300
*/
export async function getGbifSpeciesByDataset(datasetKey=datasetKeys['chkVtb1'], offset=0, limit=1000, params=false) {
    let reqHost = gbifApi;
    let reqRoute = `/species/search?dataset_key=${datasetKey}`;
    let reqLimit = `&offset=${offset}&limit=${limit}`
    let reqParam = params ? `&${params}` : '';
    let url = reqHost+reqRoute+reqParam+reqLimit;
    let enc = encodeURI(url);
    try {
        let res = await fetch(enc);
        //console.log(`getGbifSpeciesDataset(${datasetKey}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifSpeciesDataset(${datasetKey}) JSON RESULT:`, json);
        json.query = enc;
        return json;
    } catch (err) {
        err.query = enc;
        console.log(`getGbifSpeciesDataset(${datasetKey}) ERROR:`, err);
        return new Error(err)
    }
}

/*
    https://api.gbif.org/v1/species/search?dataset_key=73eb16f0-4b06-4347-8069-459bc2d96ddb&limit=300
*/
export async function DEPRECATED_getGbifSpeciesByTaxonKey(taxonKey) {
    let reqHost = gbifApi;
    let reqRoute = `/species/${taxonKey}`;
    let url = reqHost+reqRoute;
    let enc = encodeURI(url);
    try {
        let res = await fetch(enc);
        //console.log(`getGbifSpeciesByTaxonKey(${taxonKey}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifSpeciesByTaxonKey(${taxonKey}) JSON RESULT:`, json);
        json.query = enc;
        return json;
    } catch (err) {
        err.query = enc;
        console.log(`getGbifSpeciesByTaxonKey(${taxonKey}) ERROR:`, err);
        return new Error(err)
    }
}
export async function getGbifVernacularsFromKey(taxonKey) {

    console.log(`getGbifVernacularsFromKey ${taxonKey}`);

    let url = `${gbifApi}/species/${taxonKey}/vernacularNames`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(url);
        //console.log(`getGbifVernacularsFromKey(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifVernacularsFromKey(${enc}) JSON RESULT:`, json);
        return json.results;
    } catch (err) {
        console.log(`getGbifVernacularsFromKey(${enc}) ERROR:`, err);
        return Promise.reject(err);
    }
}
export async function getGbifSynonymsFromKey(taxonKey) {

    console.log(`getGbifSynonymsFromKey ${taxonKey}`);

    let url = `${gbifApi}/species/${taxonKey}/synonyms`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(url);
        //console.log(`getGbifSynonymsFromKey(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifSynonymsFromKey(${enc}) JSON RESULT:`, json);
        return json.results;
    } catch (err) {
        console.log(`getGbifSynonymsFromKey(${enc}) ERROR:`, err);
        return Promise.reject(err);
    }
}
export async function getGbifParentsFromKey(taxonKey) {

    console.log(`getGbifParentFromKey ${taxonKey}`);

    let url = `${gbifApi}/species/${taxonKey}/parents`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(url);
        //console.log(`getGbifParentFromKey(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifParentFromKey(${enc}) JSON RESULT:`, json);
        return json.results;
    } catch (err) {
        console.log(`getGbifParentFromKey(${enc}) ERROR:`, err);
        return Promise.reject(err);
    }
}

/*
    Get synonyms, etc for a taxonKey having the same taxonomic rank as the requested taxonKey
    
    https://api.gbif.org/v1/species/search?datasetKey=73eb16f0-4b06-4347-8069-459bc2d96ddb&higherTaxonKey=177419414
*/
export async function getGbifSynonymsByHigherTaxonKey(higherTaxonKey, rank=0, fileConfig) {
    let speciesFilter = fileConfig.dataConfig.speciesFilter;
    let reqHost = gbifApi;
    let reqRoute = "/species/search";
    let reqFilter = `?${speciesFilter}&higherTaxonKey=${higherTaxonKey}`;
    let url = reqHost+reqRoute+reqFilter;
    let enc = encodeURI(url);

    try {
        let res = await fetch(enc);
        let json = await res.json();
        //console.log(`getGbifSynonymsByHigherTaxonKey(${speciesFilter}, ${higherTaxonKey}) QUERY:`, enc);
        //console.log(`getGbifSynonymsByHigherTaxonKey(${speciesFilter}, ${higherTaxonKey}) RESULT:`, json);
        let arr = [];
        for (const idx in json.results) { //returns array indexes of array of objects
            //console.log(`element of array:`, idx);
            if ('ACCEPTED' != json.results[idx].taxonomicStatus && (!rank || rank == json.results[idx].rank)) {
                arr.push(json.results[idx]);
            }
        }
        console.log(`getGbifSynonymsByHigherTaxonKey(${speciesFilter}, ${higherTaxonKey})`, arr);
        return {'synonyms':arr, 'query':enc};
    } catch (err) {
        err.query = enc;
        console.log(`getGbifSynonymsByHigherTaxonKey(${speciesFilter}, ${higherTaxonKey}) ERROR:`, err);
        return new Error(err)
    }
}
/*
NOTE: This fails to find a valid match for some common taxa (eg. Sterna).
Everywhere possible we use taxonKey to search, not taxonName.
*/
export async function getGbifTaxonKeyFromName(taxonName, taxonRank='UNKNOWN') {
    try {
        let json = await getGbifTaxonFromName(taxonName, taxonRank);
        return json.usageKey;
    } catch (err) {
        return new Error(err);
    }
}

/* 
Use the gbif taxon match API to resolve taxonName to taxonKey, or not.
In rare cases matching unexpectedly fails (eg. Sterna matches Animalia).
To avoid returning incorrect yet successful matches for such failures,
pass a taxonRank as a secondary check. However if a taxonRank is not
supplied, match will succeed with an 'UNKNOWN' rank.
*/
export async function getGbifTaxonFromName(taxonName, taxonRank='UNKNOWN') {

    //console.log(`getGbifTaxonKeyFromName ${taxonName}`);

    let url = `${gbifApi}/species/match?name=${taxonName}`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(url);
        //console.log(`getGbifTaxonKeyFromName(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifTaxonKeyFromName(${enc}) JSON RESULT:`, json);
        if (json.usageKey && ('UNKNOWN' == taxonRank || taxonRank.toUpperCase() == json.rank.toUpperCase())) {
            //console.log('getGbifTaxonFromName MATCHED');
            return Promise.resolve(json);
         } else {
            let err = {message:`Not found. ${taxonRank} ${taxonName} matched GBIF ${json.rank} ${json.canonicalName} with usageKey ${json.usageKey}`, status: 404};
            console.log(`getGbifTaxonFromName(${enc}) ERROR`, err);
            return Promise.reject(err);
         }
    } catch (err) {
        console.log(`getGbifTaxonKeyFromName(${enc}) ERROR:`, err);
        return Promise.reject(err);
    }
}

export async function getGbifTaxonFromKey(taxonKey) {

    console.log(`getGbifTaxonFromKey ${taxonKey}`);

    let url = `${gbifApi}/species/${taxonKey}`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(url);
        //console.log(`getGbifTaxonFromKey(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifTaxonFromKey(${enc}) JSON RESULT:`, json);
        if (json.key) {
            return Promise.resolve(json);
         } else {
            let err = {message:`Not found: ${taxonKey}`, status: 404};
            console.log(`getGbifTaxonFromKey(${enc}) ERROR`, err);
            return Promise.reject(err);
         }
    } catch (err) {
        console.log(`getGbifTaxonKeyFromKey(${enc}) ERROR:`, err);
        return Promise.reject(err);
    }
}
const ranks = ['KINGDOM','PHYLUM','CLASS','ORDER','FAMILY','GENUS','SPECIES','SUBSPECIES'];
export function getParentRank(trank) {
    if (typeof(trank) == 'undefined' || !trank) {return 'UNKNOWN';}
    trank = trank.toUpperCase();
    let idx = ranks.findIndex((ele) => {return ele == trank;});
    console.log(`getParentRank`,trank,idx,ranks[idx-1]);
    return ranks[idx-1];
}
export function getNextChildRank(trank) {
    if (typeof(trank) == 'undefined' || !trank) {return 'UNKNOWN';}
    trank = trank.toUpperCase();
    let idx = ranks.findIndex((ele) => {return ele == trank;});
    console.log(`getNextChildRank`,trank,idx,ranks[idx+1]);
    return ranks[idx+1];
}
export function parseNameToRank(name) {
    name = decodeURI(name);
    let nArr = name.split(' ');
    let nLen = nArr.length;
    let rank = 'UNKNOWN';
    if (nLen > 2) rank = 'SUBSPECIES';
    if (2 == nLen) rank = 'SPECIES';
    return rank;
}
/*
    Convert GBIF checklist API json.results to object keyed by taxonId having array of vernacularNames.
*/
async function checklistToVernaculars(list=[]) {
    //console.log(`checklistToVernaculars incoming list:`, list);
    let vern = {};
    list.forEach(spc => {
        if (spc.vernacularNames.length) {
            let key = spc.nubKey ? spc.nubKey : spc.key;
            vern[key] = spc.vernacularNames;
        }
    })
    //console.log(`checklistToVernaculars outgoing list:`, vern);
    return vern;
}

checklistVtButterflies = await getGbifSpeciesByDataset(); //load file-scope dataset
checklistVernacularNames = await checklistToVernaculars(checklistVtButterflies.results); //fill file-scope vernacular list object

