/*
    Use json object from GBIF occurrence/search API to parse
    scientificName into canonicalName.
*/
export function parseCanonicalFromScientific(occJson, nameKey='scientificName', rankKey='taxonRank') {
    //console.log('commonUtilities=>parseCanonicalFromScientific', nameKey, rankKey, occJson);
    var toks = occJson[nameKey].split(' ');
    var name = null;
    switch(occJson[rankKey].toUpperCase()) {
      case 'SUBSPECIES':
      case 'VARIETY':
      case 'FORM':
        switch(toks[2].toUpperCase().slice(0,3)) { //the name itself usually (always?) includes a literal "subsp." token between specific and infraspecific epithets.
            case 'SUB':
            case 'VAR':
            case 'FOR':
                name = `${toks[0]} ${toks[1]} ${toks[3]}`;
                break;
            default:
                name = `${toks[0]} ${toks[1]} ${toks[2]}`;
                break;
            }
        break;
      case 'SPECIES':
        name = `${toks[0]} ${toks[1]}`;
        break;
      case 'GENUS':
      default:
        name = `${toks[0]}`;
        break;
    }
    return name;
  }
/*
    content-types: https://www.iana.org/assignments/media-types/media-types.xhtml
    eg.
    headers: {
        'Content-Type': 'application/json'
        'Content-Type': 'application/x-www-form-urlencoded'
        'Content-Type': 'text/csv'
    },
*/
export async function fetchJsonFile(filePath) {
    try {
        let options = {
            'Content-type': 'application/json'
            }
        let res = await fetch(filePath, options);
        console.log(`fetchJsonFile(${filePath}) RESULT:`, res);
        if (res.status > 299) {return res;}
        let json = await res.json();
        console.log(`fetchJsonFile(${filePath}) JSON:`, json);
        return json;
    } catch (err) {
        console.error(`fetchJsonFile(${filePath}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
    }
}
/*
    content-types: https://www.iana.org/assignments/media-types/media-types.xhtml
    eg.
    headers: {
        'Content-Type': 'application/json'
        'Content-Type': 'application/x-www-form-urlencoded'
        'Content-Type': 'text/csv'
    },
*/
export async function fetchCsvFile(filePath) {
    try {
        let options = {
            'Content-type': 'text/csv;charset=UTF-8'
            }
        let res = await fetch(filePath, options);
        console.log(`fetchCsvFile(${filePath}) RESULT:`, res);
        if (res.status > 299) {return res;}
        let text = await res.text();
        console.log(`fetchCsvFile(${filePath}) RESULT:`, text);
        return text;
    } catch (err) {
        console.error(`fetchCsvFile(${filePath}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
    }
}
/*
    content-types: https://www.iana.org/assignments/media-types/media-types.xhtml
    eg.
    headers: {
        'Content-Type': 'image/bmp'
        'Content-Type': 'image/png'
        'Content-Type': 'image/tiff'
    },
*/
export async function fetchImgFile(filePath, fileType='tiff') {
    try {
        let options = {
            'Content-type': `image/${fileType}`
            }
        let res = await fetch(filePath, options);
        console.log(`fetchImgFile(${filePath}) RESULT:`, res);
        if (res.status > 299) {return res;}
        let text = await res.text();
        console.log(`fetchImgFile(${filePath}) RESULT:`, text);
        return text;
    } catch (err) {
        console.error(`fetchImgFile(${filePath}) ERROR:`, err);
        //return Promise.reject(err);
        throw err;
    }
}
//create a download element on the fly, then execute the download
export function createHtmlDownloadData(dataStr, expName) {
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", expName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
//convert json array of objects to csv
export function jsonToCsv(json) {
    const replacer = (key, value) => value === null ? '' : value; // specify how you want to handle null values here
    const header = Object.keys(json[0]);  // the first row defines the header
    const csv = [
      header.join(','), // header row first
      ...json.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(',')) //iterate over header keys, extract row data by key
    ].join('\r\n');
  
    return csv;
  }
//example function to assemble data and execute a download
function wrapDataDownload(type=0) {
    let jsonArray = [{field11:'value11',field12:'value12'},{field21:'value21',field22:'value22'}];
    if (type) { //json-download
      var data = {name: jsonArray}; console.log('JSON Download:', data);
      var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
      createHtmlDownloadData(dataStr, "datafilename.json") ;
    } else { //csv-download
      var data = jsonToCsv(jsonArray);
      var dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(data);
      createHtmlDownloadData(dataStr, "datafilename.csv") ;
    }
  }
//return string date
export function dateNow() {
    var dateUtc = new Date();
    var offset = dateUtc.getTimezoneOffset() * 60000;
    var dateLoc = new Date(dateUtc.getTime() - offset);
    var nowDate = dateLoc.toISOString().substring(0,10);
    console.log('dateNow()', nowDate);
    return nowDate;
}
//return string time
export function timeNow(addHours=0) {
    var dateUtc = new Date();
    var offset = dateUtc.getTimezoneOffset() * 60000;
    var dateLoc = new Date(dateUtc.getTime() - offset + addHours*60*60*1000);
    var nowTime = dateLoc.toISOString().substring(11,16);
    console.log('timeNow()', nowTime);
    return nowTime;
}
//return string timeStamp
export function timeStamp() {
    let timeStamp = new Date(Date.now()).toISOString(); //.replace('T',' ').replace('Z','');
    console.log('timeStamp()', timeStamp);
    return timeStamp;
}
