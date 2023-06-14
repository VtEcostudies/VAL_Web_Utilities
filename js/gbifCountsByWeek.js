import { getGbifTaxonKeyFromName, getGbifTaxonObjFromName } from "./commonUtilities.js";
import './extendDate.js'; //import getWeek() and toUtc()
var Storage = sessionStorage;
var vtGeo = ['gadmGid=USA.46_1','stateProvince=vermont&stateProvince=vermont (State)'];
/*
Return an object having occurrence sums by week (and month) for a taxon in the State of Vermont:

{
    search: searchTerm, //the search term used, either scientificName=Turdus or taxonKey=12345
    taxonName: taxonName, //the taxonName requested, or empty if queried explicitly by taxonKey
    total: total, //total count of occurrences for all time, minus those without week or month info
    weekToday: tdWk, //1-based, numeric weekOfYear for today's date
    weekSum: wSum, //object with sums of occurrence counts by week, 1-based (1=first week, 53=last week): {...,'23':8, '24':25, '25':109, ...}
    monthSum: mSum, //object with sums of occurrence counts by month, 1-based (1=January, 12=December): {'1':2, ...,'5':239, '6':842, ..., '12':3}
    weekAgg: wAgg //object with sums of occurrence counts by week, plus month: {week:{count: wSum[week], week: week, month: month}}
}

Since 'In the State of Vermont' is represented in occurrence data differently for different datasets, 
in order to get all the data we must query by all the distinct ways they're stored. As of the writing
of this module, that means querying thrice, by 

    gadmGid=USA.46_1
    stateProvince=vermont
    stateProvince=vermont (State)

But the last two can be combined into one query because http converts those into an effective OR condition, and GBIF
handles it that way.

GBIF occurrence API counts by eventDate for Vermont example queries:
https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&stateProvince=vermont (State)&hasCoordinate=false&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
*/
//wrap retrieval of phenology in this async function to return a promise, which elsewhere waits for data
export async function getStoredPhenology(taxonName, searchTerm, geoSearch) {
    let storeName = searchTerm;
    if (geoSearch) {storeName = storeName + JSON.stringify(geoSearch);}
    console.log(`gbifCountByWeek::getStoredPhenolody | session storage name: ${storeName} | searchTerm: ${searchTerm} | geoSearch: ${geoSearch}`);
    //alert(`gbifCountByWeek::getStoredPhenolody | session storage name: ${storeName} | searchTerm: ${searchTerm} | geoSearch: ${geoSearch}`);
    let phenology = Storage.getItem(storeName);
    if (phenology && '{}' != phenology) {
        phenology = JSON.parse(Storage.getItem(storeName));
        console.log(`Storage.getItem(${storeName}) returned`, phenology);
    } else {
        phenology = fetchAll(searchTerm, taxonName, geoSearch); //returns a promise. handle that downstream with occs.then(occs => {}).
        console.log(`fetchAll(${searchTerm}) returned`, phenology); //this returns 'Promise { <state>: "pending" }'
        phenology.then(pheno => { //convert promise to data object...
            Storage.setItem(storeName, JSON.stringify(pheno));
        });
    }
    return phenology; //return a JSON data object from async function wraps the object in a promise. the caller should await or .then() it.
}
export async function gbifCountsByWeekByTaxonKey(taxonKey, geoSearch) {
    return await fetchAllByKey(taxonKey, null, geoSearch);
}
export async function gbifCountsByWeekByTaxonName(taxonName, geoSearch) {
    return await fetchAllByName(taxonName, geoSearch);
}
export async function gbifCountsByWeek(taxonName, geoSearch) {
    try {
        let usageKey = await getGbifTaxonKeyFromName(taxonName);    
        return await fetchAllByKey(usageKey, taxonName, geoSearch);
    } catch(err) {
        return await fetchAllByName(taxonName, geoSearch);
    }
}
async function fetchAllByKey(taxonKey, taxonName, geoSearch) {
    //return await fetchAll(`taxonKey=${taxonKey}`);
    return await getStoredPhenology(taxonName, `taxonKey=${taxonKey}`, geoSearch)
}
async function fetchAllByName(taxonName, geoSearch) {
    //return await fetchAll(`scientificName=${taxonName}`, taxonName);
    return await getStoredPhenology(taxonName, `scientificName=${taxonName}`, geoSearch)
}
function fetchAll(searchTerm, taxonName, geoSearch) {
    let urls = [
        `https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&${searchTerm}&facet=eventDate&facetLimit=1200000&limit=0`,
        `https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&stateProvince=vermont (State)&hasCoordinate=false&${searchTerm}&facet=eventDate&facetLimit=1200000&limit=0`
        ]
    geoSearch = geoSearch.length ? geoSearch : vtGeo;
    console.log(`fetchAll geoSearch`, geoSearch);
    let trailing = 'facet=eventDate&facetLimit=1200000&limit=0';
    let uris = [];
    for (const geo of geoSearch) {
        let uri = encodeURI(`https://api.gbif.org/v1/occurrence/search?${geo}&${searchTerm}&${trailing}`);
        uris.push(uri);
    }
    //console.log('fetchAll URIs', uris);
    //let all = Promise.all([fetch(encodeURI(urls[0])),fetch(encodeURI(urls[1]))])
    let all = Promise.all(uris.map(uri => fetch(uri)))
        .then(responses => {
            //console.log(`gbifCountsByWeek::fetchAll(${searchTerm}) RAW RESULT:`, responses);
            //Convert each response to json object
            return Promise.all(responses.map(async res => {
                let json = await res.json();
                console.log(`gbifCountsByWeek::fetchAll(${searchTerm}) JSON RESULT FOR URL:`, res.url, json);
                return json;
            }));
        })
        .then(arrj => {
            //console.log(`gbifCountsByWeek::fetchAll(${searchTerm}) ALL JSON RESULT:`, arrj);
            let total = 0, wSum = {}, mSum = {}, wAgg = {}, counts = [];
            arrj.forEach(json => {
                //console.log('json', json);
                total += json.count;
                if (json.facets[0]) {
                    json.facets[0].counts.map(count => {
                        let date = new Date(count.name).toUtc();
                        let mnth = date.getMonth()+1; //convert month to 1-based here
                        let week = date.getWeek()+1; //convert week to 1-based here
                        if (1==week && 0==date.getHours() && 0==date.getMinutes() && 0==date.getSeconds()) {
                            console.log('NOT Adding to Sums by Week and removing', count.count, 'from total for:', searchTerm, date, week, mnth);
                            total -= count.count; //don't include these in totals either
                        } else {
                            wSum[week] = wSum[week] ? wSum[week] + count.count : count.count;
                            mSum[mnth] = mSum[mnth] ? mSum[mnth] + count.count : count.count;
                            wAgg[week] = {count: wSum[week], week: week, month: mnth};
                        }
                    });
                } else {
                    console.log(`gbifCountsByWeek::fetchAll NO Facets Returned`, json.facets);
                }
            });
            let tday = new Date().toUtc(); //today's date shifted to UTC
            let tdWk = tday.getWeek()+1; // the week we're in today, 1-based
            //return Promise.resolve({search:searchTerm, taxonName:taxonName, total:total, weekToday:tdWk, weekSum:wSum, monthSum:mSum, weekAgg:wAgg}); //this works too, but not needed
            return {search:searchTerm, taxonName:taxonName, total:total, weekToday:tdWk, weekSum:wSum, monthSum:mSum, weekAgg:wAgg};
        })
        .catch(err => {
            console.log(`ERROR fetchAll ERROR:`, err);
            //return Promise.reject(new Error(err)); //this works too, but not needed
            return new Error(err);
        })
    console.log(`fetchAll promise.all`, all);
    return all; //this is how it's done. strange errors when not.
}
