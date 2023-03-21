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
            return json.results[0];//To-Do: iterate over inat results to find the best match for taxonName... For now, assume 0th entry is always good.
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