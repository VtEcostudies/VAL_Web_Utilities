import { googleApiKey } from "./secrets.js";

export var defaultSheetIds = {
    "vbaSignUps": '1O5fk2pDQCg_U4UNzlYSbewRJs4JVgonKEjg3jzDO6mA',
    "vernacular": '17_e15RB8GgpMVZgvwkFHV8Y9ZgLRXg5Swow49wZsAyQ',
    "taxonSrank": '1bEu_14eXGaBvPiwEirJs88F2ZdwR_ywBMpamtgIv0lc',
    "statusMVAL": '1Y1DCKqIQG0inJMaganaosVC-hgMjagXfcIDOkUfPMYM' //MVAL MA Conservation Status values distilled from https://www.mass.gov/info-details/list-of-endangered-threatened-and-special-concern-species#list-of-species-
}
const Storage = sessionStorage; //localStorage;

export async function getStoredConservationStatus(storeName, sheetNumber) {
    console.log(`fetchGoogleSheetData=>getStoredConservationStatus(${storeName}, ${sheetNumber})`);
    let storeData;
    if (Storage.getItem(storeName)) {
        storeData = JSON.parse(Storage.getItem(storeName));
        console.log(`fetchGoogleSheetData=>getStoredConservationStatus=>Storage.getItem(${storeName}) returned`, storeData);
    } else {
        storeData = getSheetConservationStatus(storeName, sheetNumber); //returns a promise. handle that downstream with storeData.then(data => {}).
        console.log(`${storeName} returned`, storeData); //this returns 'Promise { <state>: "pending" }'
        storeData.then(data => { //convert promise to data object...
            Storage.setItem(storeName, JSON.stringify(data));
        });
    }
    return storeData; //return a JSON data object from async function wraps the object in a promise. the caller should await or .then() it.
}

//wrap retrieval of data in this async function to return a promise, which elsewhere waits for data
export async function getStoredDataByFunc(storeFunc=getSheetSranks, sheetNumber=0) {
    let storeData; let storeName=`${storeFunc}`;
    if (Storage.getItem(storeName)) {
        storeData = JSON.parse(Storage.getItem(storeName));
        console.log(`fetchGoogleSheetData=>getStoredDataByFunc=>Storage.getItem(${storeName}) returned`, storeData);
    } else {
        storeData = storeFunc(sheetNumber); //returns a promise. handle that downstream with storeData.then(data => {}).
        console.log(`${storeName} returned`, storeData); //this returns 'Promise { <state>: "pending" }'
        storeData.then(data => { //convert promise to data object...
            Storage.setItem(storeName, JSON.stringify(data));
        });
    }
    return storeData; //return a JSON data object from async function wraps the object in a promise. the caller should await or .then() it.
}
/*
    Fetch a single Google sheet's data by sheet ID and ordinal sheet number.
*/
export async function fetchGoogleSheetData(spreadsheetId=defaultSheetIds.vbaSignUps, sheetNumber=0) {
    let apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/?key=${googleApiKey}&includeGridData=true`;

    try {
        let res = await fetch(apiUrl);
        //console.log(`fetchGoogleSheetData(${spreadsheetId},${sheetNumber}) RAW RESULT:`, res);
        if (res.status > 299) {return res;}
        let json = await res.json();
        //console.log(`fetchGoogleSheetData(${spreadsheetId}) JSON RESULT:`, json);
        let prop = json.sheets[sheetNumber].properties;
        let head = json.sheets[sheetNumber].data[0].rowData[0].values;
        let data = json.sheets[sheetNumber].data[0].rowData.slice(1);
        //console.log(`Sheet-${sheetNumber} properties:`, prop);
        //console.log(`Sheet-${sheetNumber} row header:`, head);
        //console.log(`Sheet-${sheetNumber} row data:`, data);
        return {'properties':prop, 'head':head, 'rows':data};
    } catch (err) {
        console.log(`fetchGoogleSheetData(${spreadsheetId}) ERROR:`, err);
        //return new Error(err)
        return Promise.reject(err);
    }
}
/* 
    Retrieve VBA2 Signups from Google Sheet for VBA2 Block Mapper Tool
*/
export async function getSheetSignups(sheetNumber=0) {
    try {
        let res = await fetchGoogleSheetData(defaultSheetIds.vbaSignUps, sheetNumber);
        //console.log('getSheetSignups RESULT:', res);
        if (res.status > 299) {return res;}
        let sign = [];
        res.rows.forEach(row => {
            if (row.values[1]) { //if sheet's row values are deleted but row is not deleted, API returns row of empty values!!!
                if (!sign[row.values[1].formattedValue]) {
                    sign[row.values[1].formattedValue] = [];
                }
                sign[row.values[1].formattedValue].push({
                    'last':row.values[4].formattedValue, 
                    'first':row.values[3].formattedValue,
                    'date':row.values[0].formattedValue
                });
            }
    })
    console.log('getSheetSignups 2D ARRAY', sign);
    return sign;
    } catch(err) {
        console.log(`getSheetSignups(${sheetNumber}) ERROR:`, err);
        //return new Error(err)
        return Promise.reject(err);
    }
}
/*
    Load entire data sheet into 2D Array keyed like [taxonId][i]. Return array.
*/
export async function getSheetVernaculars(sheetNumber=0) {
    try {
        let res = await fetchGoogleSheetData(defaultSheetIds.vernacular, sheetNumber);
        //console.log('getSheetVernaculars RESULT:', res);
        if (res.status > 299) {return res;}
        let name = [];
        res.rows.forEach((row,rid) => {
            //console.log('row:', rid);
            let data = {}
            /*
            Build a JSON object using headRow keys with eachRow values like {head[i]:row.value[i], head[i+1]:row.value[i+1], ...}
            */
            res.head.forEach((col,idx) => { //Asynchronous loop works here! This is better UX so use it.
            //for (var idx=0; idx<res.head.length; idx++) { let col = res.head[idx]; //synchronous loop works but delays page loading...
                let val = row.values[idx];
                //console.log('head:', idx, col.formattedValue);
                //console.log('col:', idx, val ? val.formattedValue : null);
                data[col.formattedValue] = val ? val.formattedValue : null;
            })
            //console.log(`Row ${rid} JSON:`, data);
            /*
                Now we have a JSON header-keyed row of data. Use specific keys to build a 2D Array of vernacular names like this:
                name[taxonId][0] = {head1:row1value1, head2:row1value2, ...}
                name[taxonId][1] = {head1:row2value1, head2:row2value2, ...}
                name[taxonId][N] = {head1:rowNvalue1, head2:rowNvalue2, ...}
            */
            if (name[data.taxonId]) { //We assume that if the 1st Dimension exists, the 2nd Dimension has been instantiated, as below.
                name[data.taxonId].push(data);
                //console.log('duplicate', name[data.taxonId]);
            } else {
                name[data.taxonId] = []; //We must instantiate a 2D array somehow before we push values on the the 1st Dimension
                name[data.taxonId][0] = data;
            }
        })
        //console.log('getSheetVernaculars 2D ARRAY', name);
        return name;
    } catch(err) {
        console.log(`getSheetVernaculars(${sheetNumber}) ERROR:`, err);
        //return new Error(err)
        return Promise.reject(err);
    }
}
/*
    Load entire data sheet into object keyed by nKey (SCIENTIFIC_NAME). Return object.
*/
export async function getSheetSranks(sheetNumber=0) {
    try {
        let res = await fetchGoogleSheetData(defaultSheetIds.taxonSrank, sheetNumber);
        console.log('getSheetSranks RESULT:', res);
        if (res.status > 299) {return res;}
        let name = {};
        let nKey = 'SCIENTIFIC_NAME'; //the column name whose value is the key to its row
        res.rows.forEach((row,rid) => {
            //console.log('row:', rid);
            let data = {};
            /*
            Build a JSON object using headRow keys with eachRow values like {head[i]:row.value[i], head[i+1]:row.value[i+1], ...}
            */
            res.head.forEach((col,idx) => { //Asynchronous loop works here! This is better UX so use it.
            //for (var idx=0; idx<res.head.length; idx++) { let col = res.head[idx]; //synchronous loop works but delays page loading...
                let val = row.values[idx];
                //console.log('head:', idx, col.formattedValue);
                //console.log('col:', idx, val ? val.formattedValue : null);
                data[col.formattedValue] = val ? val.formattedValue : null;
            })
            //console.log(`Row ${rid} JSON:`, data);
            /*
                Now we have a JSON header-keyed row of data. Use specific keys to build a nested object of vernacular names like this:
                name[nKey] = {head1:row1value1, head2:row1value2, ...}
                name[nKey] = {head1:row2value1, head2:row2value2, ...}
                name[nKey] = {head1:rowNvalue1, head2:rowNvalue2, ...}
            */
            name[data[nKey]] = data; //S-Ranks MUST have unique nKey entries
        })
        //console.log('getSheetSranks Nested Object', name);
        return name;
    } catch(err) {
        console.log(`getSheetSranks(${sheetNumber}) ERROR:`, err);
        //return new Error(err)
        return Promise.reject(err);
    }
}
/*
    Load entire data sheet into object keyed by nKey (SCIENTIFIC_NAME). Return object.
*/
export async function getSheetConservationStatus(sheetName=false, sheetNumber=0) {
    if (!sheetName) {return {};}
    try {
        let res = await fetchGoogleSheetData(defaultSheetIds[sheetName], sheetNumber);
        console.log('getSheetConservationStatus RESULT:', res);
        if (res.status > 299) {return res;}
        let name = {};
        let nKey = 'SCIENTIFIC_NAME'; //the column name whose value is the key to its spreadsheet row
        res.rows.forEach((row,rid) => {
            //console.log('row:', rid);
            let data = {};
            /*
            Build a JSON object using headRow keys with eachRow values like {head[i]:row.value[i], head[i+1]:row.value[i+1], ...}
            */
            res.head.forEach((col,idx) => { //Asynchronous loop works here! This is better UX so use it.
            //for (var idx=0; idx<res.head.length; idx++) { let col = res.head[idx]; //synchronous loop works but delays page loading...
                let val = row.values[idx];
                //console.log('head:', idx, col.formattedValue);
                //console.log('col:', idx, val ? val.formattedValue : null);
                data[col.formattedValue] = val ? val.formattedValue : null;
            })
            //console.log(`Row ${rid} JSON:`, data);
            /*
                Now we have a JSON header-keyed row of data. Use specific keys to build a nested object of vernacular names like this:
                name[nKey] = {head1:row1value1, head2:row1value2, ...}
                name[nKey] = {head1:row2value1, head2:row2value2, ...}
                name[nKey] = {head1:rowNvalue1, head2:rowNvalue2, ...}
            */
            name[data[nKey]] = data; //MA Status values MUST have unique nKey entries
            })
        //console.log('getSheetConservationStatus Compiled Object', name);
        return name;
    } catch(err) {
        console.log(`getSheetConservationStatus(${sheetNumber}) ERROR:`, err);
        //return new Error(err)
        return Promise.reject(err);
    }
}