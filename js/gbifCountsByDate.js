import { getGbifTaxonKeyFromName } from "./commonUtilities.js";

/*
GBIF occurrence counts by year:
https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&hasCoordinate=false&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
*/
async function fetchAllByKey(taxonKey) {
    return await fetchAll(`taxonKey=${taxonKey}`);
}
async function fetchAllByName(taxonName) {
    return await fetchAll(`scientificName=${taxonName}`);
}
function fetchAll(searchTerm) {
    let urls = [
        `https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&${searchTerm}&facet=eventDate&facetLimit=1200000&limit=0`,
        `https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&stateProvince=vermont (State)&hasCoordinate=false&${searchTerm}&facet=eventDate&facetLimit=1200000&limit=0`
        ]
    let all = Promise.all([fetch(encodeURI(urls[0])),fetch(encodeURI(urls[1]))])
        .then(responses => {
            //console.log(`gbifCountsByDate::fetchAll(${searchTerm}) RAW RESULT:`, responses);
            //Convert each response to json object
            return Promise.all(responses.map(async res => {
                let json = await res.json();
                console.log(`gbifCountsByDate::fetchAll(${searchTerm}) JSON RESULT FOR URL:`, res.url, json);
                return json;
            }));
        })
        .then(arrj => {
            //console.log(`gbifCountsByDate::fetchAll(${searchTerm}) ALL JSON RESULT:`, arrj);
            let total = 0, max = 0, min = 7000000000000, sum = {}, counts = [];
            arrj.forEach(json => {
                //console.log('json', json);
                total += json.count;
                if (json.facets[0]) {
                    json.facets[0].counts.map(count => {
                        let date = Date.parse(count.name); //convert facet name (eventDate) to date
                        sum[date] = sum[date] ? sum[date] + count.count : count.count;
                    });
                    //console.log('sum', sum);
                } else {
                    console.log(`gbifCountsByDate::fetchAll NO Facets Returned`, json.facets);
                }
            });
            for (const [key, val] of Object.entries(sum)) {
                //console.log('gbifCountsByDate::fetchAll | sum entries', key, val);
                let d = Number(key);
                let o = {'date':d, 'count':val};
                max = d > max ? d : max;
                min = d < min ? d : min;
                counts.push(o);
            }
            //console.log('GBIF counts by date sorted by count:', counts);
            counts.sort((a,b) => {return a.date > b.date;})
            //console.log('GBIF counts by date sorted by date:', counts);
            //return Promise.resolve({total:total, max:max, counts:counts}); //this works too, but not needed
            return {total:total, max:max, min:min, counts:counts};
        })
        .catch(err => {
            console.log(`ERROR fetchAll ERROR:`, err);
            //return Promise.reject(new Error(err)); //this works too, but not needed
            return new Error(err);
        })
    console.log(`fetchAll promise.all`, all);
    return all; //this is how it's done. strange errors when not.
}

export async function gbifCountsByDateByTaxonKey(taxonKey) {
    return await fetchAllByKey(taxonKey);
}

export async function gbifCountsByDateByTaxonName(taxonName) {
    return await fetchAllByName(taxonName);
}

export async function gbifCountsByDate(taxonName) {

    let taxonKey = await getGbifTaxonKeyFromName(taxonName);
    
    if (taxonKey) {
        return await fetchAllByKey(taxonKey);
    } else {
        return await fetchAllByName(taxonName);
    }

/*
    .then(data => {
        console.log(`gbifCountsByDate | data`, data);
        return data;
    })
    .catch(err => {
        console.log(`ERROR gbifCountsByDate ERROR: `, err);
        return data;
    })
*/
}