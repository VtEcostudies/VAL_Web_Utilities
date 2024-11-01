import { parseNameToRank, getParentRank, getGbifParentsFromKey } from './fetchGbifSpecies.js';

//https://api.inaturalist.org/v1/taxa?q=Acipenser%20fulvescens

const inatApi = 'https://api.inaturalist.org/v1/taxa';

//To-do: these args are out-of-date. Check who's calling it.
export async function findInatSpecies(taxonName, parentName, parentRank) {
    return await getInatSpecies(taxonName, parentName, parentRank);
}

export async function getInatSpecies(taxonName=false, taxonRank=false, parentName=false, parentRank=false) {
    if (typeof(taxonName) == 'undefined') {taxonName = false;} 
    if (typeof(taxonRank) == 'undefined') {taxonRank = false;}
    if (typeof(parentName) == 'undefined') {parentName = false;}
    if (typeof(parentRank) == 'undefined') {parentRank = false;}
    if (!taxonRank) {
        taxonRank = parseNameToRank(taxonName);
        taxonRank = 'UNKNOWN' != taxonRank ? taxonRank : false;
    }
    if (taxonRank && parentName && !parentRank) {
        parentRank = getParentRank(taxonRank);
    }
    if (!taxonName || !taxonRank) {
        console.error(`getInatSpecies(${taxonName}, ${taxonRank}). taxonName or taxonRank is empty.`); 
        throw({message:'Missing taxonName or taxonRank'});
    }

    let reqQuery = `?q=${taxonName}`;
    let reqRank = taxonRank ? `&rank=${taxonRank.toLowerCase()}` : ''; //iNat ranks are LOWERCASE; API is CASE-SENSITIVE
    let reqLimit = '&per_page=100';
    let url = inatApi+reqQuery+reqRank+reqLimit;
    let enc = encodeURI(url);

    console.log(`getInatSpecies(${taxonName}, ${taxonRank}, ${parentName}, ${parentRank})`, enc);

    try {
        let res = await fetch(enc);
        //console.log(`getInatSpecies(${taxonName}) RAW RESULT:`, res);
        if (res.status < 300) {
            let json = await res.json();
            json.query = enc;
            console.log(`getInatSpecies(${taxonName}, ${taxonRank}, ${parentName}, ${parentRank}) JSON RESULT:`, json);
            if (1 == json.results.length) {
                return json.results[0];
            } else {
                let match = false;
                for (var i=0; i<json.results.length; i++) {
                    let find = json.results[i];
                    //console.log(`getInatSpecies(${taxonName},${taxonRank},${parentName},${parentRank})`, find.matched_term, taxonName);
                    if (find.matched_term == taxonName) {
                        console.log(`getInatSpecies(${taxonName},${taxonRank},${parentName},${parentRank}) FOUND ${find.matched_term}`, find);
                        //oops. In some cases there are duplicate names at the same rank in different trees. eg. Morus. Compare parent taxa.
                        if (parentName && parentRank) {
                            let parentObj = await findParentNameRank(parentName, parentRank, find.parent_id);
                            //oops. iNat includes infraTaxa in its tree, so parent_id can be eg. 'subfamily'. yikes, we need to traverse parent_ids to find a taxon for comparison.
                            if (parentObj.name) {
                                match = find;
                                break;
                            }
                        } else {
                            console.log(`inatSpeciesData=>getiNatSpecies(${taxonName},${taxonRank}) - no parent info. Taxon match is suspect.`)
                            match = find;
                            break;
                        }
                    }
                }
                if (match.id) {return match;}
                else {
                    console.error(`inatSpeciesData=>getInatSpecies: No match found for ${taxonRank} ${taxonName}`);
                    throw {message:`inatSpeciesData=>getInatSpecies: No match found for ${taxonRank} ${taxonName}`};
                }
            }
        } else {
            console.error(`inatSpeciesData=>getInatSpecies(${taxonName}) BAD RESULT:`, res.status);
            throw res;
        }
    } catch (err) {
        err.query = enc;
        console.error(`inatSpeciesData=>getInatSpecies(${taxonName})`, err);
        throw err;
    }
}

/*
    Starting from an attempted match between a GBIF taxonName/taxonRank and iNat, given multiple matches, traverse iNat's
    upper taxa starting at the target taxon's parent_id until we reach parentRank. Compare names. If they're equal, we
    have a match.
*/
export async function findParentNameRank(parentName, parentRank, parent_id, iter=0) {
    let taxObj = await getInatSpeciesByKey(parent_id);

    if (taxObj.rank.toLowerCase() == parentRank.toLowerCase() && taxObj.name.toLowerCase() == parentName.toLowerCase()) {
        console.log(`FOUND: findParentNameRank(${parentName},${parentRank},${parent_id},${taxObj.name},${taxObj.rank})`, iter);
        return taxObj;
    } else if (taxObj.rank.toLowerCase() == 'kingdom') {
        console.log(`FAILED: findParentNameRank(${parentName},${parentRank},${parent_id},${taxObj.name},${taxObj.rank})`, iter);
        return false;
    } else {
        console.log(`NEXT: findParentNameRank(${parentName},${parentRank},${parent_id},${taxObj.name}, ${taxObj.rank})`, iter);
        return await findParentNameRank(parentName, parentRank, taxObj.parent_id, ++iter);
    }
}

export async function getInatSpeciesByKey(key) {
    let url = `${inatApi}/${key}`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(enc);
        if (res.status < 300) {
            let json = await res.json();
            json.query = enc;
            console.log(`getInatSpeciesByKey(${key}) JSON RESULT:`, json);
            //return Promise.resolve(json);
            return json.results[0]; //we're looking up by a unique key, here. one entry iNat. please.
        } else {
            console.error(`inatSpeciesData.js=>getInatSpeciesByKey(${key}) BAD RESULT:`, res.status);
            //return res;
            throw(res);
        }
    } catch (err) {
        err.query = enc;
        console.error(`inatSpeciesData.js=>getInatSpeciesByKey(${key}) ERROR:`, err);
        //return err;
        throw(err);
    }
}

/*
json.results[0].default_photo.medium_url
json.results[0].default_photo.attribution
json.results[0].preferred_common_name
json.results[0].conservation_status {
    "user_id":null,
    "status_name":"vulnerable",
    "iucn":30,
    "authority":"NatureServe",
    "geoprivacy":null,
    "source_id":8,
    "place_id":null,
    "status":"g3g4"
}
*/