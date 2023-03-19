import { googleApiKey } from "./secrets.js";

export var defaultSheetIds = {
    "vbaSignUps": '1O5fk2pDQCg_U4UNzlYSbewRJs4JVgonKEjg3jzDO6mA',
    "vernacular": '17_e15RB8GgpMVZgvwkFHV8Y9ZgLRXg5Swow49wZsAyQ',
    "taxonSrank": '1bEu_14eXGaBvPiwEirJs88F2ZdwR_ywBMpamtgIv0lc'
}

/*
    Fetch a single Google sheet's data by sheet ID and ordinal sheet number.
    
*/
export async function fetchGoogleSheetData(spreadsheetId=defaultSheetIds.signUps, sheetNumber=0) {
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
        return new Error(err)
    }
}
