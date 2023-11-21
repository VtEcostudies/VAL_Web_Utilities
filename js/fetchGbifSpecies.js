import { fetchJsonFile } from "./commonUtilities.js";

let gbifApi = "https://api.gbif.org/v1";
export const datasetKeys = {
    "chkVtb1":"73eb16f0-4b06-4347-8069-459bc2d96ddb"
};
export var checklistVtButterflies;
export var checklistVernacularNames;

/*
    https://api.gbif.org/v1/species/search?dataset_key=73eb16f0-4b06-4347-8069-459bc2d96ddb&limit=300
*/
export async function getGbifSpeciesDataset(datasetKey=datasetKeys['chkVtb1'], offset=0, limit=1000, params=false) {
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
        //console.log(`getGbifSpeciesDataset(${datasetKey}) JSON RESULT:`, json);
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
export async function getGbifSpeciesByTaxonKey(taxonKey) {
    let reqHost = gbifApi;
    let reqRoute = `/species/${taxonKey}`;
    let url = reqHost+reqRoute;
    let enc = encodeURI(url);
    try {
        let res = await fetch(enc);
        //console.log(`getGbifSpeciesByTaxonKey(${datasetKey}) RAW RESULT:`, res);
        let json = await res.json();
        //console.log(`getGbifSpeciesByTaxonKey(${datasetKey}) JSON RESULT:`, json);
        json.query = enc;
        return json;
    } catch (err) {
        err.query = enc;
        console.log(`getGbifSpeciesByTaxonKey(${datasetKey}) ERROR:`, err);
        return new Error(err)
    }
}

/*
    Get synonyms, etc for a taxonKey having the same taxonomic rank as the requested taxonKey
    
    https://api.gbif.org/v1/species/search?datasetKey=73eb16f0-4b06-4347-8069-459bc2d96ddb&higherTaxonKey=177419414
*/
export async function getGbifSynonymsByTaxonKey(higherTaxonKey, rank=0, fileConfig) {
    let speciesFilter = fileConfig.dataConfig.speciesFilter;
    let reqHost = gbifApi;
    let reqRoute = "/species/search";
    let reqFilter = `?${speciesFilter}&higherTaxonKey=${higherTaxonKey}`;
    let url = reqHost+reqRoute+reqFilter;
    let enc = encodeURI(url);

    try {
        let res = await fetch(enc);
        let json = await res.json();
        //console.log(`getGbifSynonymsByTaxonKey(${speciesFilter}, ${higherTaxonKey}) QUERY:`, enc);
        //console.log(`getGbifSynonymsByTaxonKey(${speciesFilter}, ${higherTaxonKey}) RESULT:`, json);
        let arr = [];
        for (const idx in json.results) { //returns array indexes of array of objects
            //console.log(`element of array:`, idx);
            if ('ACCEPTED' != json.results[idx].taxonomicStatus && (!rank || rank == json.results[idx].rank)) {
                arr.push(json.results[idx]);
            }
        }
        console.log(`getGbifSynonymsByTaxonKey(${speciesFilter}, ${higherTaxonKey})`, arr);
        return {'synonyms':arr, 'query':enc};
    } catch (err) {
        err.query = enc;
        console.log(`getGbifSynonymsByTaxonKey(${speciesFilter}, ${higherTaxonKey}) ERROR:`, err);
        return new Error(err)
    }
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

checklistVtButterflies = await getGbifSpeciesDataset(); //load file-scope dataset
checklistVernacularNames = await checklistToVernaculars(checklistVtButterflies.results); //fill file-scope vernacalar list object

