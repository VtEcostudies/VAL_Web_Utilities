import {
    gbifPhenologyByDataSetKey,
    gbifPhenologyBySpeciesListName,
    gbifPhenologyByTaxonKeys,
    gbifPhenologyByTaxonNames
} from './gbifPhenologyModule.js';

const objUrlParams = new URLSearchParams(window.location.search);
const taxonNameA = objUrlParams.getAll('taxonName'); //Array of taxon names?
const taxonKeyA = objUrlParams.getAll('taxonKey'); //Array of taxon keys
const columnA = objUrlParams.getAll('column'); //Array of additional columns to show
const listName = objUrlParams.get('list'); //Single query param
var datasetKey = objUrlParams.get('datasetKey'); //5b3274a2-f577-412a-9e17-57a89e0a41fb
const geometry = objUrlParams.get('geometry'); //POLYGON ((-72.66357 47.30605, -67.52197 47.39537, -67.47803 46.40453, -66.7749 44.806, -67.87354 44.14753, -69.71924 43.29, -69.104 41.66963, -70.81787 40.27617, -72.48779 40.67731, -74.64111 41.07604, -77.05811 41.60394, -77.93701 42.32281, -77.62939 43.41782, -76.35498 44.61863, -74.99268 45.82574, -72.66357 47.30605))
const gadm_gid = objUrlParams.get('gadmGid'); //gadmGid=USA.46_1
const province = objUrlParams.get('stateProvince'); //stateProvince=vermont&stateProvince=vermont (State)
var geoSearchA = [];
if (geometry) {geoSearchA.push(`geometry=${geometry}`);}
if (gadm_gid) {geoSearchA.push(`gadmGid=${gadm_gid}`);}
if (province) {geoSearchA.push(`stateProvince=${province}`);} //this needs to be an array of values concatenated into an http &-separated list
var sort = objUrlParams.get('sort'); sort = sort ? Number(sort) : 1;
var responsive = objUrlParams.get('responsive'); responsive = responsive ? Number(responsive) : 0;
var paging = objUrlParams.get('paging'); paging = paging ? Number(paging) : 1;
var searching = objUrlParams.get('searching'); searching = searching ? Number(searching) : 1;
var sortInfo = objUrlParams.get('sortInfo'); sortInfo = sortInfo ? Number(sortInfo) : 1;
var showTitle = objUrlParams.get('showTitle'); showTitle = showTitle ? Number(showTitle) : 0;
var titleText = objUrlParams.get('titleText'); //Single query param
var offset = Number(objUrlParams.get('offset')); offset = offset ? offset : 0;
var limit = Number(objUrlParams.get('limit')); limit = limit ? limit : 300;
console.log('Query Param(s) taxonNames:', taxonNameA);
console.log('Query Param(s) taxonKeys:', taxonKeyA);
console.log('Query Param(s) columns:', columnA);
console.log('offset', offset, 'limit', limit);

let objHtmlIds = {tblId:'phenologyTable', ttlId:'phenologyTitle'};
let objSort = {sort:sort, responsive:responsive, paging:paging, searching:searching, sortInfo:sortInfo}
let objTitle = {show:showTitle, text:titleText};
if (taxonNameA.length) {
    if (1==taxonNameA.length) {
        objSort = {sort:0, responsive:0, paging:0, searching:0, sortInfo:0}
        objTitle = {show:1, text:`${taxonNameA[0]} Phenology`}
    } else {
        objTitle = {show:1, text:`${taxonNameA.join(', ')} Phenology`}
    }
    gbifPhenologyByTaxonNames(taxonNameA, columnA, geoSearchA, objHtmlIds, objSort, objTitle);
} else if (taxonKeyA.length) {
    if (1==taxonKeyA.length) {
        objSort = {sort:0, responsive:0, paging:0, searching:0, sortInfo:0}
    }
    gbifPhenologyByTaxonKeys(taxonKeyA, columnA, geoSearchA, objHtmlIds, objSort, objTitle);
} else if (listName) {
    gbifPhenologyBySpeciesListName(listName, columnA, geoSearchA, objHtmlIds, objSort, objTitle, offset, limit);
} else if (datasetKey) {
    gbifPhenologyByDataSetKey(datasetKey, columnA, geoSearchA, objHtmlIds, objSort, objTitle, offset, limit);
} else {
    showHelp();
}

function showHelp() {
    let eleDiv = document.getElementById("phenologyDiv");
    let eleInf = document.getElementById("phenologyParamsInfo");
    let url = new URL(window.location);
    if (eleDiv) {eleDiv.style.display = 'none';}
    if (eleInf) {eleInf.innerHTML = 
    `
    <p>Control the VAL phenology chart with query parameters:</p>
        <li><a href="${url.href.split('?')[0]}?list=butterflies&column=Scientific&column=Vernacular&limit=5">
        ?list=butterflies
        </a> 
        to show VT Butterflies.
        </li>
        <li>
        <a href="${url.href.split('?')[0]}?datasetKey=5b3274a2-f577-412a-9e17-57a89e0a41fb&column=Scientific&column=Vernacular&showTitle=1&titleText=Crickets and Katydids of VT">
        ?datasetKey=5b3274a2-f577-412a-9e17-57a89e0a41fb
        </a> 
        to show Crickets and Katydids.
        </li>
    <br>
    <p>To show specific taxa:</p>
        <li><a href="${url.href.split('?')[0]}?taxonName=Danaus plexippus&showTitle=1&titleText=Monarch Phenology&sort=0">?taxonName=Danaus plexippus</a></li>
        <li><a href="${url.href.split('?')[0]}?taxonKey=1918395&column=Scientific&column=Vernacular&sort=0">?taxonKey=5133088</a></li>
    <br>
    <p>To show mulitple taxa:</p>
        <li>
            <a href="${url.href.split('?')[0]}?taxonName=Danaus plexippus&taxonName=Cercyonis pegala&column=Scientific&column=Vernacular&column=Observations&sort=0">
            Two Butterfly Species
            </a>
        </li>
        <li>
            <a href="${url.href.split('?')[0]}?taxonKey=6953&taxonKey=5473&taxonKey=7017&taxonKey=9417&taxonKey=5481&taxonKey=1933999&column=Scientific&column=Vernacular&column=Family&column=Occurrences&paging=0&searching=0">
            Six Butterfly Families
            </a>
        </li>
        <li>
            <a href="${url.href.split('?')[0]}?taxonName=Catharus%20guttatus&taxonName=Catharus%20bicknelli&taxonName=Catharus%20fuscescens&taxonName=Catharus%20fuscescens%20fuscescens&taxonName=Catharus%20ustulatus&taxonName=Catharus%20minimus&taxonName=Catharus%20guttatus%20faxoni&column=Scientific&column=Vernacular&column=Observations&showTitle=1&titleText=Catharus of VT&paging=0&searching=0">
            VT Catharus taxa
            </a>
        </li>
    <br>
    <p>The default search region is VT (by gadmGid and stateProvince). You may search different regions:</p>
        <li>&gadmGid=USA.46_1</li>
        <li>&stateProvince=vermont&stateProvince=vermont (State)</li>
        <li>&geometry=POLYGON ((-72.66357 47.30605, -67.52197 47.39537, -67.47803 46.40453, -66.7749 44.806, -67.87354 44.14753, -69.71924 43.29, -69.104 41.66963, -70.81787 40.27617, -72.48779 40.67731, -74.64111 41.07604, -77.05811 41.60394, -77.93701 42.32281, -77.62939 43.41782, -76.35498 44.61863, -74.99268 45.82574, -72.66357 47.30605))</li>
        <li><a href="${url.href.split('?')[0]}?taxonName=Sterna%20hirundo&gadmGid=USA.22.4_1">Martha's Vineyard Common Terns</a></li>
    <br>
    <p>To show taxon information columns:</p>
        <li>&column=Scientific (or Accepted)</li>
        <li>&column=Vernacular (or Common)</li>
        <li>&column=Observations (or Occurrences)</li>
        <li>&column=Family</li>
    <br>
    <p>You may include columns returned from the GBIF Species API.</p>
    <p>Sorting is turned ON by default. To turn sorting off:</p>
        <li>&sort=0</li>
    <br>
    <p>NOTE: You can print to PDF for a hard copy of a list. Use &sort=0 for a printer-friendly list.</p>
    <p>All sorting features are turned ON by default. To turn sorting features OFF:</p>
        <li>&paging=0</li>
        <li>&searching=0</li>
        <li>&sortInfo=0</li>
    `
    }
}
