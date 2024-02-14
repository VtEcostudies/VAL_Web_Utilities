let iNatWeb = "https://www.inaturalist.org";
let iNatApi = "https://api.inaturalist.org/v1"
let iNatWebObs = "https://www.inaturalist.org/observations/user_stats.json";
let iNatApiObs = "https://api.inaturalist.org/v2/observations/observers"

export async function getInatObserverStats(inat_place_id=47, params) {
    let reqHost = ''; //iNatApi; //iNatWeb;
    let reqRoute = iNatApiObs; //"/v1/observations/observers"; //"/observations/user_stats.json";
    let reqValue = `?place_id=${inat_place_id}`;
    let url = reqHost+reqRoute+reqValue;
    let enc = encodeURI(url);

    console.log('getInatObservationStats', enc);

    try {
        let tres = await fetch(enc);
        let json = await tres.json();
        //console.log(`getInatObserverStats(${key}) QUERY:`, enc);
        //console.log(`getInatObserverStats(${key}) RESULT:`, json);
        if (json.total_results) {json.total = json.total_results;}
        return json;
    } catch (err) {
        err.query = enc;
        console.log(`getInatObserverStats(${inat_place_id},${params}) ERROR:`, err, enc);
        return Promise.reject(err);
    }
}

/*
https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&facet=recordedBy&facetLimit=1199999&limit=0
*/
let gbifApi = 'https://api.gbif.org/v1';
let gbifQry = '/occurrence/search?facet=recordedBy&facetLimit=1199999&limit=0';

export async function getGbifRecordedBy(gadm_gid='USA.46_1', params) {
    let reqHost = gbifApi;
    let reqRoute = gbifQry;
    let reqValue = `&gadm_gid=${gadm_gid}`;
    let url = reqHost+reqRoute+reqValue;
    let enc = encodeURI(url);

    console.log('getGbifRecordedBy', enc);

    try {
        let tres = await fetch(enc);
        let json = await tres.json();
        //console.log(`getGbifRecordedBy(${key}) QUERY:`, enc);
        //console.log(`getGbifRecordedBy(${key}) RESULT:`, json);
        if (json.facets[0] && 'RECORDED_BY' == json.facets[0].field) {
            json.count_users = json.facets[0].counts.length;
        } else {
            json.count_users = null;
        }
        return json;
    } catch (err) {
        err.query = enc;
        console.log(`getGbifRecordedBy(${gadm_gid},${params}) ERROR:`, err, enc);
        return Promise.reject(err);
    }
}

export async function getEbirdUsers(gadm_gid='USA.46_1', params) {
    return {count:15443}
}

export async function getEbutterflyUsers(gadm_gid='USA.46_1', params) {
    return {count:1234}
}