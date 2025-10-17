let gbifApi = "https://api.gbif.org/v1";
export const datasetKeys = {
    "chkVtb1":"73eb16f0-4b06-4347-8069-459bc2d96ddb" //this is actually the 'live' checklist of butterflies, not from VBA1
};
/*
export var checklistVtButterflies;
export var checklistVernacularNames;
checklistVtButterflies = await getGbifSpeciesByDataset(); //load file-scope dataset
checklistVernacularNames = await checklistToVernaculars(checklistVtButterflies.results); //fill file-scope vernacular list object
*/
export async function getChecklistVernaculars(dataSetKey=datasetKeys["chkVtb1"]) {
    let checklist = await getGbifSpeciesByDataset(dataSetKey);
    let vernaculars = await checklistToVernaculars(checklist.results);
    return vernaculars;
}

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
        //console.log(`getGbifSpeciesByDataset(${datasetKey}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifSpeciesByDataset(${datasetKey}) JSON RESULT:`, json, enc);
        json.query = enc;
        return json;
    } catch (err) {
        err.query = enc;
        console.error(`getGbifSpeciesByDataset(${datasetKey}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
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
        console.error(`getGbifSpeciesByTaxonKey(${taxonKey}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
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
        console.error(`getGbifVernacularsFromKey(${enc}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
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
        console.error(`getGbifSynonymsFromKey(${enc}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
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
        console.error(`getGbifParentFromKey(${enc}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
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
        console.error(`getGbifSynonymsByHigherTaxonKey(${speciesFilter}, ${higherTaxonKey}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
    }
}
/*
    Search for a taxonName (and taxonRank) within a Species List. Return failure if search yields no matching results.
*/
export async function findListTaxonByNameAndRank(fileConfig, taxonName, taxonRank='UNKNOWN') {
    let datasetKey = fileConfig.dataConfig.speciesDatasetKey;
    try {
        if (datasetKey && taxonName) {
            let params = `q=${taxonName}&qField=SCIENTIFIC`;
            if ('UNKNOWN' != taxonRank) params += `&rank=${taxonRank}`;
            let json = await getGbifSpeciesByDataset(datasetKey, 0, 20, params);
            if (0 == json.count) {
                return Promise.reject(new Error(`${taxonRank ? taxonRank : ''} ${taxonName} Not Found in ${fileConfig.dataConfig.atlasName}`))
            }
            if (1 == json.count) {
                return Promise.resolve(json.results[0]);
            }
            if (json.count > 1) {
                for (var i=0;i<json.results.length;i++) {
                    let txn = json.results[i];
                    if (txn.canonicalName.toUpperCase() == taxonName.toUpperCase() && ('UNKNOWN' == taxonRank || txn.rank.toUpperCase() == taxonRank.toUpperCase())) {
                        return Promise.resolve(json.results[i]);
                    }
                }
            }
        } else {
            return Promise.reject(new Error(`speciesDatasetKey is not defined for '${fileConfig.dataConfig.atlasName}'`))
        }
    } catch (err) {
        //return Promise.reject(err);
        throw err;
    }
}

/*
NOTE: This fails to find a valid match for some common taxa (eg. Sterna).
Everywhere possible we use taxonKey to search, not taxonName.
*/
export async function getGbifTaxonKeyFromName(taxonName, taxonRank='UNKNOWN') {
    let json = await getGbifTaxonFromName(taxonName, taxonRank);
    return json.usageKey;
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
            //return Promise.resolve(json);
            return json;
         } else {
            let err = {message:`Not found. ${taxonRank} ${taxonName} matched GBIF ${json.rank} ${json.canonicalName} with usageKey ${json.usageKey}`, status: 404};
            console.error(`getGbifTaxonFromName(${enc}) ERROR`, err);
            //return Promise.reject(err);
            throw err;
         }
    } catch (err) {
        console.error(`getGbifTaxonKeyFromName(${enc}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
    }
}

export async function getGbifTaxonFromKey(taxonKey) {

    //console.log(`getGbifTaxonFromKey ${taxonKey}`);

    let url = `${gbifApi}/species/${taxonKey}`;
    try {
        let res = await fetch(url);
        //console.log(`getGbifTaxonFromKey(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        //console.log(`getGbifTaxonFromKey(${enc}) JSON RESULT:`, json);
        if (json.key) {
            json.query = url;
            return json;
         } else {
            let err = {message:`Not found: ${taxonKey}`, status: 404};
            console.error(`getGbifTaxonFromKey(${url}) ERROR`, err);
            throw err;
         }
    } catch (err) {
        console.error(`getGbifTaxonFromKey(${url}) ERROR:`, err);
        throw err;
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
export async function checklistToVernaculars(list=[]) {
    //console.log(`checklistToVernaculars incoming list:`, list);
    let vern = {};
    list.forEach(spc => {
        if (1 == spc.vernacularNames.length) {
            //vern[key] = spc.vernacularNames; //former method: return array of objects
            vern[spc.nubKey] = spc.vernacularNames[0].vernacularName; //new method: set one name
            vern[spc.key] = spc.vernacularNames[0].vernacularName; //new method: set one name
        } else if (1 < spc.vernacularNames.length) {
            let name = false;
            for (const objN of spc.vernacularNames) {
                console.log('MULTIPLE VERNACULAR NAMES', objN)
                if (objN.preferred) {
                    name =  objN.vernacularName;
                }
            }
            if (!name) {
                vern[spc.nubKey] = spc.vernacularNames[0].vernacularName;
                vern[spc.key] = spc.vernacularNames[0].vernacularName;
            }
        }
    })
    //console.log(`checklistToVernaculars outgoing list:`, vern);
    return vern;
}
