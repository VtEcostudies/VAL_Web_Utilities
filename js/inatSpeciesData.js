//https://api.inaturalist.org/v1/taxa?q=Acipenser%20fulvescens

const inatApi = 'https://api.inaturalist.org/v1/taxa';

export async function getInatSpecies(searchTerm=false) {

    if (!searchTerm) {console.log(`getInatSpecies(${searchTerm}). Search Term is empty.`); return {};}

    let reqHost = inatApi;
    let reqQuery = `?q=${searchTerm}`;
    let url = reqHost+reqQuery;
    let enc = encodeURI(url);

    //console.log(`getInatSpecies(${searchTerm})`, enc);

    try {
        let res = await fetch(enc);
        //console.log(`getInatSpecies(${searchTerm}) RAW RESULT:`, res);
        if (res.status < 300) {
            let json = await res.json();
            json.query = enc;
            console.log(`getInatSpecies(${searchTerm}) JSON RESULT:`, json);
            return json;
        } else {
            console.log(`getInatSpecies(${searchTerm}) BAD RESULT:`, res.status);
            return new Error(res);
        }
    } catch (err) {
        err.query = enc;
        console.log(`getInatSpecies(${searchTerm}) ERROR:`, err);
        throw new Error(err)
    }
}

/*
json.results[0].default_photo.medium_url
json.results[0].default_photo.attribution
*/