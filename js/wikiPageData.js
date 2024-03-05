//https://en.wikipedia.org/api/rest_v1/page/summary/ambystoma_jeffersonianum

const wikiApiSummary = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const wikiApiPageHtml = 'https://en.wikipedia.org/api/rest_v1/page/html/';

//wrap original name in a more appropriate name
export async function getWikiSummary(searchTerm=false) {
    return await getWikiPage(searchTerm);
}

//get wikipedia page summary for search term
export async function getWikiPage(searchTerm=false) {

    if (!searchTerm) {console.log(`getWikiPage(${searchTerm}). Search Term is empty.`); return {};}

    let reqHost = wikiApiSummary;
    let reqRoute = searchTerm;
    let url = reqHost+reqRoute;
    let enc = encodeURI(url);

    //console.log(`getWikiPage(${searchTerm})`, enc);

    try {
        let res = await fetch(enc);
        //console.log(`getWikiPage(${searchTerm}) RAW RESULT:`, res);
        if (res.status < 300) {
            let json = await res.json();
            json.query = enc;
            //console.log(`getWikiPage(${searchTerm}) JSON RESULT:`, json);
            return json;
        } else {
            console.log(`getWikiPage(${searchTerm}) BAD RESULT:`, res.status);
            return new Error(res);
        }
    } catch (err) {
        err.query = enc;
        console.log(`getWikiPage(${searchTerm}) ERROR:`, err);
        throw new Error(err)
    }
}

//get wikipedia full page result for search term
export async function getWikiHtmlPage(searchTerm=false) {

    if (!searchTerm) {console.log(`getWikiHtmlPage(${searchTerm}). Search Term is empty.`); return {};}

    let reqHost = wikiApiPageHtml;
    let reqRoute = searchTerm;
    let url = reqHost+reqRoute;
    let enc = encodeURI(url);

    //console.log(`getWikiHtmlPage(${searchTerm})`, enc);

    try {
        let res = await fetch(enc);
        //console.log(`getWikiHtmlPage(${searchTerm}) RAW RESULT:`, res);
        if (res.status < 300) {
            let text = await res.text();
            //console.log(`getWikiHtmlPage(${searchTerm}) Text RESULT:`, text);
            let html = DOMPurify.sanitize(text);
            //console.log(`getWikiHtmlPage(${searchTerm}) HTML RESULT:`, html);
            return html;
        } else {
            console.log(`getWikiHtmlPage(${searchTerm}) BAD RESULT:`, res.status, res.ok, res);
            return new Error(res); //this triggers promise.catch(err)
        }
    } catch (err) {
        err.query = enc;
        console.log(`getWikiHtmlPage(${searchTerm}) ERROR:`, err);
        throw new Error(err) //this triggers promise.catch(err)
    }
}