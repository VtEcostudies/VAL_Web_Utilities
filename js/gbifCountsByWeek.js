import { getGbifTaxonKeyFromName } from "./commonUtilities.js";

Date.prototype.getWeek = function () {
    var dt = new Date(this.getFullYear(), 0, 1);
    let millisecondOfYear = this - dt;
    let millisecondPerDay = 86400000;
    let dayOfYear = Math.ceil(millisecondOfYear / millisecondPerDay);
    let weekOfYear = Math.floor(dayOfYear / 7);
    return weekOfYear;
};
Date.prototype.toUtc = function() {
    let tz = this.getTimezoneOffset();
    let ut = new Date(this.setMinutes(this.getMinutes()+parseInt(tz)));
    return ut;
}
/*
GBIF occurrence counts by year:
https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&hasCoordinate=false&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
*/
async function fetchAllByKey(taxonKey) {
    return await fetchAll(`taxonKey=${taxonKey}`);
}
async function fetchAllByName(taxonName) {
    return await fetchAll(`scientificName=${taxonName}`, taxonName);
}
function fetchAll(searchTerm, taxonName) {
    let urls = [
        `https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&${searchTerm}&facet=eventDate&facetLimit=1200000&limit=0`,
        `https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&stateProvince=vermont (State)&hasCoordinate=false&${searchTerm}&facet=eventDate&facetLimit=1200000&limit=0`
        ]
    let all = Promise.all([fetch(encodeURI(urls[0])),fetch(encodeURI(urls[1]))])
    //let all = Promise.all([fetch(encodeURI(urls[1]))])
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
                            console.log('NOT Adding to Sums by Week for:', searchTerm, date, week, mnth, 'and removing', count.count, 'from total');
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
            let tdWk = tday.getWeek()+1; // the week we're in today
            //return Promise.resolve({search:searchTerm, taxonName: taxonName, total:total, weekToday:tdWk, weekSum:wSum, monthSum:mSum, weekAgg:wAgg}); //this works too, but not needed
            return {search:searchTerm, taxonName: taxonName, total:total, weekToday:tdWk, weekSum:wSum, monthSum:mSum, weekAgg:wAgg};
        })
        .catch(err => {
            console.log(`ERROR fetchAll ERROR:`, err);
            //return Promise.reject(new Error(err)); //this works too, but not needed
            return new Error(err);
        })
    console.log(`fetchAll promise.all`, all);
    return all; //this is how it's done. strange errors when not.
}

export async function gbifCountsByWeekByTaxonKey(taxonKey) {
    return await fetchAllByKey(taxonKey);
}

export async function gbifCountsByWeekByTaxonName(taxonName) {
    return await fetchAllByName(taxonName);
}

export async function gbifCountsByWeek(taxonName) {

    try {
        let taxonObj = await getGbifTaxonObjFromName(taxonName);    
        return await fetchAllByKey(taxonObj.usageKey, taxonName);
    } catch(err) {
        return await fetchAllByName(taxonName);
    }
}