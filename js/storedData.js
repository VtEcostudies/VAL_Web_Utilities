var Storage = window.sessionStorage ? sessionStorage : false;

//wrap data retrieval this async function to return a promise, which elsewhere waits for data
export async function getSetStoredData(dataType, searchTerm, geoSearchA, fetchFunction) {
    let storeName = `${dataType}-${searchTerm}`;
    if (geoSearchA) {storeName = storeName + '-' + JSON.stringify(geoSearchA);}
    console.log(`storedData=>getSetStoredData | session storage name: ${storeName} | searchTerm: ${searchTerm} | geoSearch:`, geoSearchA);
    let storeData = Storage ? Storage.getItem(storeName) : false;
    if (storeData && '{}' != storeData) {
        storeData = JSON.parse(Storage.getItem(storeName));
        console.log(`storedData=>getSetStoredData=>Storage.getItem(${storeName}) returned`, storeData);
    } else {
        storeData = fetchFunction(searchTerm, geoSearchA); //returns a promise. handle that downstream with occs.then(occs => {}).
        //console.log(`${fetchFunction}(${searchTerm}) returned`, storeData); //this returns 'Promise { <state>: "pending" }'
        storeData.then(data => { //convert promise to data object...
            Storage.setItem(storeName, JSON.stringify(data));
        });
    }
    return storeData; //return a JSON data object from async function wraps the object in a promise. the caller should await or .then() it.
}
export async function getStoredData(dataType, searchTerm, geoSearchA) {
    let storeName = `${dataType}-${searchTerm}`;
    if (geoSearchA) {storeName = storeName + '-' + JSON.stringify(geoSearchA);}
    console.log(`storedData=>getSetStoredData | session storage name: ${storeName} | searchTerm: ${searchTerm} | geoSearch:`, geoSearchA);
    let storeData = Storage ? Storage.getItem(storeName) : false;
    console.log('gbifcountsByData=>getStoredData | storeData:', storeData);
    if (storeData && '{}' != storeData && '[]' != storeData) {
        storeData = JSON.parse(Storage.getItem(storeName));
        console.log(`storedData=>getSetStoredData=>Storage.getItem(${storeName}) returned`, storeData);
    }
    return storeData;
}
export async function setStoredData(dataType, searchTerm, geoSearchA, data) {
    if (Storage) {
        let storeName = `${dataType}-${searchTerm}`;
        if (geoSearchA) {storeName = storeName + '-' + JSON.stringify(geoSearchA);}
        console.log(`storedData=>setStoredData | session storage name: ${storeName} | searchTerm: ${searchTerm} | geoSearch:`, geoSearchA);
        Storage.setItem(storeName, JSON.stringify(data));
    } else {
        console.log(`storedData=>setStoredData | Storage NOT available.`);
    }
}
