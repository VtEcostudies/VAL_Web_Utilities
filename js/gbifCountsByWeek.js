import { getListSubTaxonKeysByFilter, getNubKey } from "./gbifOccFacetCounts.js";
import { occQuery } from "./gbifOccQuery.js";
import { cacheThrough } from "./gbifCache.js";
import { getGbifTaxonFromKey, getGbifTaxonKeyFromName } from "./fetchGbifSpecies.js";
import './extendDate.js'; //import getWeek() and toUtc()
const facetQuery = '&facet=eventDate&facetLimit=1200000&limit=0';
var Storage = window.sessionStorage ? window.sessionStorage : false;
var vtGeo = ['gadmGid=USA.46_1','stateProvince=Vermont&stateProvince=Vermont (State)']; //NOTE: stateProvince is case-sensitive
var verbose = 0;
/*
Return an object having occurrence sums by week (and month) for a taxon in the requested geometry/geography:
{
    search: searchTerm, //the search term used, either scientificName=Turdus or taxonKey=12345
    taxonName: taxonName, //the taxonName requested, or empty if queried explicitly by taxonKey
    total: total, //total count of occurrences for all time, minus those without week or month info
    weekToday: tdWk, //1-based, numeric weekOfYear for today's date
    weekSum: wSum, //object with sums of occurrence counts by week, 1-based (1=first week, 53=last week): {...,'23':8, '24':25, '25':109, ...}
    monthSum: mSum, //object with sums of occurrence counts by month, 1-based (1=January, 12=December): {'1':2, ...,'5':239, '6':842, ..., '12':3}
    weekArr: wArr //array of 53 weekly occurrence counts for d3.js chart: [{count: wSum[week], week: week, month: month}]
}

Since 'In the State of Vermont' is represented in occurrence data differently for different datasets, 
in order to get all the data we must query by all the distinct ways they're stored. As of the writing
of this module, that means querying thrice, by 

    gadmGid=USA.46_1
    stateProvince=Vermont
    stateProvince=Vermont (State)

But the last two can be combined into one query because http converts those into an effective OR condition, and GBIF
handles it that way.

GBIF occurrence API counts by eventDate for Vermont example queries:
https://api.gbif.org/v1/occurrence/search?gadmGid=USA.46_1&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
https://api.gbif.org/v1/occurrence/search?stateProvince=vermont&stateProvince=vermont (State)&hasCoordinate=false&scientificName=Danaus%20plexippus&facet=eventDate&facetLimit=1200000&limit=0
*/
//wrap retrieval of phenology in this async function to return a promise, which elsewhere waits for data
/*
    Was sessionStorage with no expiry, which meant it could never go stale within a tab and was
    always cold in a new one - no amount of waiting refreshed it and no amount of returning reused
    it. gbifCache gives it both: kept across visits, refetched daily or on reload.
    A phenology with no total is a failed fetch; do not store it.
*/
export async function getStoredPhenology(searchTerm, geoSearch) {
    let storeName = searchTerm;
    if (geoSearch) {storeName = storeName + JSON.stringify(geoSearch);}
    return cacheThrough(
        `phenology.${storeName}`,
        () => fetchAll(searchTerm, geoSearch),
        pheno => pheno && Number.isFinite(pheno.total)
    );
}
export async function gbifCountsByWeekByListTaxonKey(taxonKey, fileConfig) {
    let speciesFilter = fileConfig.dataConfig.speciesFilter;
    let geoSearchA = fileConfig.predicateToQueries(fileConfig.dataConfig.rootPredicate, true);
    let drillRanks = fileConfig.dataConfig.drillRanks;
    return await gbifCountsByWeekByListKeyByFilters(taxonKey, speciesFilter, geoSearchA, drillRanks);
}
export async function gbifCountsByWeekByListKeyByFilters(taxonKey, speciesFilter, geoSearchA, drillRanks=['GENUS', 'SPECIES']) {
    let self = await getGbifTaxonFromKey(taxonKey); //retrieve species info for species-list taxonKey - to get nubKey for below
    let nub = await getNubKey(self); //WORKAROUND: self.nubKey is null for most kingdoms since the COL XR republication. See gbifOccFacetCounts.js.
    let srch = `taxonKey=${nub ? nub : taxonKey}`;
    let subs = {keys:[], names:[]};
    if (drillRanks.includes(self.rank)) { //only drill-down lower ranks
        subs = await getListSubTaxonKeysByFilter(speciesFilter, taxonKey); //get sub-nubKeys of species-list key
        for (const key of subs.keys) {
            srch += `&taxonKey=${key}`; //add sub-nubKeys to searchTerm to be used by fetchAll
        }
    }
    console.log(`gbifCountsByWeekByListKeyByFilters(${taxonKey}) | self-nubKey:`, nub, 'sub-nubKeys:', subs.keys, 'searchTerm:', srch);
    
    //let res = await fetchAll(srch, geoSearchA);
    let res = await getStoredPhenology(srch, geoSearchA);
    res.nubKey = nub;
    res.keys = subs.keys.push(nub); //add self nubKey to array of keys for species-list key
    res.names = subs.names;
    res.search = srch; //return our enhanced searchTerm for caller to use
    return res;
}
export async function gbifCountsByWeekByTaxonKey(taxonKey, geoSearch) {
    return await fetchAllByKey(taxonKey, geoSearch);
}
export async function gbifCountsByWeekByTaxonName(taxonName, geoSearch) {
    return await fetchAllByName(taxonName, geoSearch);
}
async function fetchAllByKey(taxonKey, geoSearch) {
    //return await fetchAll(`taxonKey=${taxonKey}`, geoSearch);
    return await getStoredPhenology(`taxonKey=${taxonKey}`, geoSearch);
}
async function fetchAllByName(taxonName, geoSearch) {
    //return await fetchAll(`scientificName=${taxonName}`, geoSearch);
    return await getStoredPhenology(`scientificName=${taxonName}`, geoSearch)
}
//function fetchAll(searchTerm, taxonName, geoSearch) {
/*
    occQuery does the fetching, the rate-limit handling, the merge across geographies and the daily
    cache - see gbifOccQuery.js. geoSearch IS the scope here: this module is called with explicit
    geography rather than an atlas rootPredicate. What is left below is the week arithmetic.

    Merging the geographies before bucketing is equivalent to bucketing each and adding, because
    every eventDate maps to the same day, week and month whichever query returned it.
*/
async function fetchAll(searchTerm, geoSearch) {
    geoSearch = geoSearch.length ? geoSearch : vtGeo;
    const res = await occQuery(null, {scope:geoSearch, search:searchTerm, facet:'eventDate', facetArgs:'facetLimit=1200000'});
    if (res.missed) {throw new Error(`gbifCountsByWeek: ${res.missed} of ${res.queries.length} queries unanswered`);}
    let total = 0, dSum = {}, wSum = {}, mSum = {}, dMin = 366, dMax = 0;
    for (const [name, cnt] of Object.entries(res.counts)) {
        //To-do: handle date ranges for phenology properly here.
        //It seems that date ranges spanning more than one day should be discarded,
        //While those that fall within a single day can be treated as that day.
        let date = new Date(name.split('/')[0]).toUtc(); //for eventDate ranges, use the range-start
        let mnth = date.getMonth()+1; //convert month to 1-based here
        let week = date.getWeek()+1; //convert week to 1-based here
        let doy = date.getDOY(); //getDOY is 1-based?
        if (1==week && 0==date.getHours() && 0==date.getMinutes() && 0==date.getSeconds()) {
            if (verbose) {console.log('NOT Adding to Sums by Week and removing', cnt, 'from total for:', searchTerm, date, week, mnth);}
        } else {
            total += cnt; //only total counts for returned facets with valid dates
            dSum[doy] = dSum[doy] ? dSum[doy] + cnt : cnt;
            wSum[week] = wSum[week] ? wSum[week] + cnt : cnt;
            mSum[mnth] = mSum[mnth] ? mSum[mnth] + cnt : cnt;
            if (doy < dMin) dMin = doy;
            if (doy > dMax) dMax = doy;
        }
    }
    let tday = new Date().toUtc(); //today's date shifted to UTC
    let tdWk = tday.getWeek()+1; // the week we're in today, 1-based
    let wArr = [];
    for (var i=1;i<54;i++) { //convert sparse object to complete array (for d3.js charts)
        wArr.push({count:wSum[i]?wSum[i]:0, week:i, month:weekToMonth(i)});
    }
    let dArr = [];
    for (var i=1;i<367;i++) { //convert sparse object to complete array (for d3.js charts)
        dArr.push({count:dSum[i]?dSum[i]:0, doy:i});
    }
    return {search:searchTerm, total:total, weekToday:tdWk, weekSum:wSum, monthSum:mSum, weekArr:wArr, doyArr:dArr, doyExt:{min:dMin,max:dMax}};
}

function weekToMonth(weekNumber, year=2023) {
    // Create a date based on the first day of the given year
    const dateBeg = new Date(year, 0, 1);
    const dateEnd = new Date(year, 0, 1);
    
    // Adjust the date to the first day of the week
    dateBeg.setDate(dateBeg.getDate() + (weekNumber - 1) * 7 - dateBeg.getDay());

    // Get the month of the adjusted first day of week
    let begMon = dateBeg.getMonth() + 1; // Months are zero-indexed, so add 1
    
    // Adjust the date to the last day of the week
    dateEnd.setDate(dateEnd.getDate() + (weekNumber) * 7 - dateEnd.getDay());

    // Get the month of the adjusted last day of week
    let endMon = dateEnd.getMonth() + 1; // Months are zero-indexed, so add 1

    if (begMon == 12) {endMon=begMon;} //don't wrap month of year back to January for last week of December 

    let arrMon = begMon == endMon ? [begMon] : [begMon, endMon];

    //console.log('weekToMonth', arrMon);

    return arrMon;
}