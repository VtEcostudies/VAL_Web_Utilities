/*
    Use json object from GBIF occurrence/search API to parse
    scientificName into canonicalName.
*/
export function parseCanonicalFromScientific(occJson, nameKey='scientificName') {
    var toks = occJson[nameKey].split(' ');
    var name = null;
    switch(occJson.taxonRank.toUpperCase()) {
      case 'SUBSPECIES':
      case 'VARIETY':
      case 'FORM':
        switch(toks[2].toUpperCase().slice(0,3)) { //the name itself usually (always?) includes a literal "subsp." token between specific and infraspecific epithets.
            case 'SUB':
            case 'VAR':
            case 'FOR':
                name = `${toks[0]} ${toks[1]} ${toks[3]}`;
                break;
            default:
                name = `${toks[0]} ${toks[1]} ${toks[2]}`;
                break;
            }
        break;
      case 'SPECIES':
        name = `${toks[0]} ${toks[1]}`;
        break;
      case 'GENUS':
      default:
        name = `${toks[0]}`;
        break;
    }
    return name;
  }
  
/*
    content-types: https://www.iana.org/assignments/media-types/media-types.xhtml
    eg.
    headers: {
        'Content-Type': 'application/json'
        'Content-Type': 'application/x-www-form-urlencoded'
        'Content-Type': 'text/csv'
    },
*/
export async function fetchJsonFile(filePath) {
    try {
        let options = {
            'Content-type': 'application/json'
            }
        let res = await fetch(filePath, options);
        console.log(`fetchJsonFile(${filePath}) RESULT:`, res);
        if (res.status > 299) {return res;}
        let json = await res.json();
        console.log(`fetchJsonFile(${filePath}) JSON:`, json);
        return json;
    } catch (err) {
        console.log(`fetchJsonFile(${filePath}) ERROR:`, err);
        return new Error(err)
    }
}
/*
    content-types: https://www.iana.org/assignments/media-types/media-types.xhtml
    eg.
    headers: {
        'Content-Type': 'application/json'
        'Content-Type': 'application/x-www-form-urlencoded'
        'Content-Type': 'text/csv'
    },
*/
export async function fetchCsvFile(filePath) {
    try {
        let options = {
            'Content-type': 'text/csv;charset=UTF-8'
            }
        let res = await fetch(filePath, options);
        console.log(`fetchCsvFile(${filePath}) RESULT:`, res);
        if (res.status > 299) {return res;}
        let text = await res.text();
        console.log(`fetchCsvFile(${filePath}) RESULT:`, text);
        return text;
    } catch (err) {
        console.log(`fetchCsvFile(${filePath}) ERROR:`, err);
        return new Error(err)
    }
}
/*
    content-types: https://www.iana.org/assignments/media-types/media-types.xhtml
    eg.
    headers: {
        'Content-Type': 'image/bmp'
        'Content-Type': 'image/png'
        'Content-Type': 'image/tiff'
    },
*/
export async function fetchImgFile(filePath, fileType='tiff') {
    try {
        let options = {
            'Content-type': `image/${fileType}`
            }
        let res = await fetch(filePath, options);
        console.log(`fetchImgFile(${filePath}) RESULT:`, res);
        if (res.status > 299) {return res;}
        let text = await res.text();
        console.log(`fetchImgFile(${filePath}) RESULT:`, text);
        return text;
    } catch (err) {
        console.log(`fetchImgFile(${filePath}) ERROR:`, err);
        return new Error(err)
    }
}

/*
NOTE: This fails to find a valid match for some common taxa (eg. Sterna).
Everywhere possible we use taxonKey to search, not taxonName.
*/
export async function getGbifTaxonKeyFromName(taxonName, taxonRank='UNKNOWN') {
    try {
        let json = await getGbifTaxonObjFromName(taxonName, taxonRank);
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
export async function getGbifTaxonObjFromName(taxonName, taxonRank='UNKNOWN') {

    //console.log(`getGbifTaxonKeyFromName ${taxonName}`);

    let url = `https://api.gbif.org/v1/species/match?name=${taxonName}`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(url);
        //console.log(`getGbifTaxonKeyFromName(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifTaxonKeyFromName(${enc}) JSON RESULT:`, json);
        if (json.usageKey && ('UNKNOWN' == taxonRank || taxonRank.toUpperCase() == json.rank.toUpperCase())) {
            //console.log('getGbifTaxonObjFromName MATCHED');
            return Promise.resolve(json);
         } else {
            let err = {message:`Not found. ${taxonRank} ${taxonName} matched GBIF ${json.rank} ${json.canonicalName} with usageKey ${json.usageKey}`, status: 404};
            console.log(`getGbifTaxonObjFromName(${enc}) ERROR`, err);
            return Promise.reject(err);
         }
    } catch (err) {
        console.log(`getGbifTaxonKeyFromName(${enc}) ERROR:`, err);
        return Promise.reject(err);
    }
}

export async function getGbifTaxonObjFromKey(taxonKey) {

    console.log(`getGbifTaxonObjFromKey ${taxonKey}`);

    let url = `https://api.gbif.org/v1/species/${taxonKey}`;
    let enc = encodeURI(url);
    try {
        let res = await fetch(url);
        console.log(`getGbifTaxonObjFromKey(${enc}) RAW RESULT:`, res);
        let json = await res.json();
        console.log(`getGbifTaxonObjFromKey(${enc}) JSON RESULT:`, json);
        if (json.key) {
            return Promise.resolve(json);
         } else {
            let err = {message:`Not found: ${taxonKey}`, status: 404};
            console.log(`getGbifTaxonObjFromKey(${enc}) ERROR`, err);
            return Promise.reject(err);
         }
    } catch (err) {
        console.log(`getGbifTaxonKeyFromKey(${enc}) ERROR:`, err);
        return Promise.reject(err);
    }
}
const ranks=['KINGDOM','PHYLUM','CLASS','ORDER','FAMILY','GENUS','SPECIES','SUBSPECIES'];
export function getParentRank(trank) {
    trank = trank.toUpperCase();
    let idx = ranks.findIndex((ele) => {return ele == trank;});
    console.log(`getParentRank`,trank,idx,ranks[idx-1]);
    return ranks[idx-1];
}
export function getNextChildRank(trank) {
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