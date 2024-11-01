export const gbifApi = "https://api.gbif.org/v1";
export const gbifDatasetUrl = "https://gbif.org/dataset";

export const datasetKeys = {
    "vba1":"0901cecf-55f1-447e-8537-1f7b63a865a0",
    "inat":"50c9509d-22c7-4a22-a47d-8c48425ef4a7",
    "ebut":"cf3bdc30-370c-48d3-8fff-b587a39d72d6"
};

export async function fetchVba1GbifDatasetInfo() {
    return await fetchGbifDatasetInfo(datasetKeys.vba1);
}
export async function fetchInatGbifDatasetInfo() {
    return await fetchGbifDatasetInfo(datasetKeys.inat);
}
export async function fetchEbutGbifDatasetInfo() {
    return await fetchGbifDatasetInfo(datasetKeys.ebut);
}
/*
    https://api.gbif.org/v1/dataset/df2a8206-84e9-4530-8a0d-b60f687dba0b
*/
export async function fetchGbifDatasetInfo(datasetKey) {
    let reqHost = gbifApi;
    let reqRoute = `/dataset/${datasetKey}`;
    let url = reqHost+reqRoute;
    let enc = encodeURI(url);
    try {
        let res = await fetch(enc);
        //console.log(`fetchGbifDatasetInfo(${datasetKey}) RAW RESULT:`, res);
        let json = await res.json();
        //console.log(`fetchGbifDatasetInfo(${datasetKey}) JSON RESULT:`, json);
        json.query = enc;
        return json;
    } catch (err) {
        err.query = enc;
        console.error(`fetchGbifDatasetInfo(${datasetKey}) ERROR:`, err);
        //return Promise.reject(err);
        throw err(err);
    }
}
