import { gbifCountsByWeek, gbifCountsByWeekByTaxonKey, gbifCountsByWeekByTaxonName } from './gbifCountsByWeek.js';
import { datasetKeys } from "./fetchGbifSpecies.js";
import { getGbifSpeciesDataset, getGbifSpeciesByTaxonKey } from './fetchGbifSpecies.js';
import { getGbifTaxonObjFromName } from './commonUtilities.js';
import { tableSortHeavy } from './tableSortHeavy.js'
import './extendDate.js'; //import getWeek() and toUtc()

const objUrlParams = new URLSearchParams(window.location.search);
const taxonNameA = objUrlParams.getAll('taxonName'); //Array of taxon names?
const taxonKeyA = objUrlParams.getAll('taxonKey'); //Array of taxon keys
const columnA = objUrlParams.getAll('column'); //Array of additional columns to show
const list = objUrlParams.get('list'); //Single query param
var datasetKey = objUrlParams.get('datasetKey'); //5b3274a2-f577-412a-9e17-57a89e0a41fb
const geometry = objUrlParams.get('geometry'); //POLYGON ((-72.66357 47.30605, -67.52197 47.39537, -67.47803 46.40453, -66.7749 44.806, -67.87354 44.14753, -69.71924 43.29, -69.104 41.66963, -70.81787 40.27617, -72.48779 40.67731, -74.64111 41.07604, -77.05811 41.60394, -77.93701 42.32281, -77.62939 43.41782, -76.35498 44.61863, -74.99268 45.82574, -72.66357 47.30605))
const gadm_gid = objUrlParams.get('gadmGid'); //gadmGid=USA.46_1
const province = objUrlParams.get('stateProvince'); //stateProvince=vermont&stateProvince=vermont (State)
var geoSearch = [];
var sort = objUrlParams.get('sort'); sort = sort ? Number(sort) : 1;
var responsive = objUrlParams.get('responsive'); responsive = responsive ? Number(responsive) : 0;
var paging = objUrlParams.get('paging'); paging = paging ? Number(paging) : 1;
var searching = objUrlParams.get('searching'); searching = searching ? Number(searching) : 1;
var sortInfo = objUrlParams.get('sortInfo'); sortInfo = sortInfo ? Number(sortInfo) : 1;
var showTitle = objUrlParams.get('showTitle'); showTitle = Number(showTitle);
var titleText = objUrlParams.get('titleText'); //Single query param
console.log('Query Param(s) taxonNames:', taxonNameA);
console.log('Query Param(s) taxonKeys:', taxonKeyA);
console.log('Query Param(s) columns:', columnA);
var offset = 0, limit = 300;
let off = Number(objUrlParams.get('offset'));
let lim = Number(objUrlParams.get('limit'));
offset = off ? off : offset;
limit = lim ? lim : limit;
console.log('offset', offset, 'limit', limit, 'off', off, 'lim', lim);
const butterflyKeys = 'taxonKey=6953&taxonKey=5473&taxonKey=7017&taxonKey=9417&taxonKey=5481&taxonKey=1933999';
const eleTbl = document.getElementById("phenologyTable");
const eleTtl = document.getElementById("phenologyTitle");

var todayDate = new Date().toUtc(); //today's date shifted to UTC
var todayWeek = todayDate.getWeek()+1; // the week we're in today, 1-based
var todayWeekColumnId = 0; //the columnId in the table of this week in the year, to (hopefully) auto-sort by that phenology
var firstWeekColumnId = 0;
var occurrenceColumnId = -1;

const waitDiv = document.getElementById("pageWait");
var waitObj;
async function addPageWait() {
    if (waitDiv) {    
        waitObj = document.createElement('i');
        console.log('addPageWait', waitObj);
        waitDiv.append(waitObj);
        waitObj.style = 'text-align: center;';
        waitDiv.style = 'text-align: center;';
        waitObj.innerHTML = `<i class="fa fa-spinner fa-spin" style="font-size:60px;"></i>`;
    } else {
        console.log('addPageWait | Element ID pageWait not found')
    }
}

async function delPageWait() {
    if (waitObj) {waitObj.remove();}
}

let monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let monthSize = [31,28,31,30,31,30,31,31,30,31,30,31];
let MonthDays = [1,32,60,91,121,152,182,213,244,274,305,335];
//head row of month names every 4ish weeks
async function addWeekHead() {
    let colIdx = -1;
    let objHed = eleTbl.createTHead();
    let hedRow = objHed.insertRow(0);
    //eleTbl.append(hedRow); //doing this orders table rows properly, but causes dataTable to fail
    let colObj;
    columnA.forEach(column => {
        //console.log(`addWeekHead | columnA:`, columnA, 'column:', column);
        colObj = false;
        if ('scientific' == column.toLowerCase() || 'accepted' == column.toLowerCase()) {
            colObj = hedRow.insertCell(++colIdx);
            colObj.innerText = column;
        }
        else if ('common' == column.toLowerCase() || 'vernacular' == column.toLowerCase()) {
            colObj = hedRow.insertCell(++colIdx);
            colObj.innerText = column;
        }
        else if ('occurrences' == column.toLowerCase() || 'observations' == column.toLowerCase()) {
            colObj = hedRow.insertCell(++colIdx);
            colObj.innerText = column;
        } else {
            colObj = hedRow.insertCell(++colIdx); 
            colObj.innerText = column;
        }
        if (colObj) {
            colObj.setAttribute('id', `${column}`); //store the className applied to column cells for highlighting
            colObj.classList.add('infoHeaderCell'); //this only applied to sortInfo header cells
            colObj.classList.add(`${column}Header`); //so it highlights itself on click
            colObj.classList.add('lightCell');
            colObj.addEventListener("click", (e) => {
                console.log('id:', e.target.id);
                if (!e.shiftKey) clearAllColumns();
                highlightHeader(e.target.id);
                //highlightColumn(e.target.id);
            });
        }
    })
    let month = 0; //necessary. iterated below as counter.
    let days = 0;
    for (var week=1; week<54; week++) {
        days += 7;
        colObj = await hedRow.insertCell(colIdx + week);
        colObj.innerHTML = `<div id="week${week}" class="weekHeaderNumber">${week}</div>`;
        let weeksPerMonth = 31/7;
        //if (week/weeksPerMonth > month) {
        if (days > MonthDays[month]) {
            month++;
            colObj.innerHTML += `<div id="week${week}" class="monthHeaderName">${monthName[month-1]}</div>`;
            colObj.classList.add('no-stretch-cell');
        } else {
            colObj.innerHTML += `<div id="week${week}" class="monthHeaderName">&nbsp</div>`; //nbsp is required placeholder
        }
        if (todayWeek == week) {
            colObj.classList.add('phenoCellToday');
            console.log('addWeekHead | todayWeek:', todayWeek, '| week:', week, '| todayWeekHeadId:', todayWeek == week);
        }
        
        colObj.classList.add('weekHeaderCell'); //this only applied to ALL week header cells
        colObj.classList.add('phenoCell');
        colObj.classList.add('lightCell');
        colObj.classList.add(`week${week}`);
        colObj.classList.add(`week${week}Header`); //class unique to this cell
        colObj.setAttribute('id', `week${week}`);
        
        colObj.addEventListener("click", (e) => {
            console.log('id:', e.target.id);
            if (!e.shiftKey) clearAllColumns();
            highlightHeader(e.target.id);
            //highlightColumn(e.target.id);
        });
        
    }
}
function clearAllColumns() {
    let wObjs = document.getElementsByClassName('lightCell');
    Object.keys(wObjs).forEach(key => {
        wObjs[key].removeAttribute('style');
    })
}

function highlightHeader(columnClass=false) {
    if (columnClass) {
        let wObjs = document.getElementsByClassName(`${columnClass}Header`);
        Object.keys(wObjs).forEach(key => {
            wObjs[key].style.backgroundColor = 'gold';
        })
    }
}

function highlightColumn(columnClass=false) {
    if (columnClass) {
        let wObjs = document.getElementsByClassName(columnClass);
        Object.keys(wObjs).forEach(key => {
            wObjs[key].style.backgroundColor = 'gold';
        })
    }
}

async function addTaxonRow(pheno=false, taxon=false, rowIdx=0) {
    let colIdx = -1;
    let objRow = eleTbl.insertRow(rowIdx);
    //eleTbl.append(objRow); //doing this orders table rows properly, but causes dataTable to fail
    let colObj;
    let ancTag;

    columnA.forEach(column => {
        colObj = false;
        if ('scientific' == column.toLowerCase() || 'accepted' == column.toLowerCase()) {
            colObj = objRow.insertCell(++colIdx);
            let ancTag = `<a title="VAL Species Profile: ${taxon.canonicalName}" href="https://val.vtecostudies.org/species-profile?taxonName=${taxon.canonicalName}">${taxon.canonicalName}</a>`
            colObj.innerHTML = ancTag;
        }
        else if ('common' == column.toLowerCase() || 'vernacular' == column.toLowerCase()) {
            let verna = taxon.vernacularNames ? (taxon.vernacularNames.length ? taxon.vernacularNames[0].vernacularName : '') : '';
            verna = verna ? verna : (taxon.vernacularName ? taxon.vernacularName : '');
            colObj = objRow.insertCell(++colIdx); 
            colObj.innerText = verna;
        }
        else if ('occurrences' == column.toLowerCase() || 'observations' == column.toLowerCase()) {
            colObj = objRow.insertCell(++colIdx); 
            ancTag = `<a title="VAL Data Explorer: ${taxon.canonicalName}" href="https://val.vtecostudies.org/gbif-explorer?taxonKey=${taxon.nubKey}&view=MAP">${pheno.total}</a>`
            colObj.innerHTML = ancTag;
            occurrenceColumnId = colIdx; //needed to set up dataTables initial sort-direction to desc for numeric column-data
        } else {
            colObj = objRow.insertCell(++colIdx);
            colObj.innerText = taxon[column.toLowerCase()];
        }
        if (colObj) {
            colObj.classList.add('taxonInfo');
            colObj.classList.add('lightCell');
            colObj.classList.add(`head-${column}`);
        }
    })

    firstWeekColumnId = colIdx+1; //needed to set up dataTables initial sort-direction to desc for numeric column-data
    let month = 0;
    for (var week=1; week<54; week++) {
        let wCount = pheno.weekSum[week] ? pheno.weekSum[week] : 0;
        let wFreq = Math.ceil(wCount/pheno.total*100); //looks bad for small total counts
        wFreq = Math.ceil(wCount / Math.sqrt(wCount)); //looks OK for all data, includes single-values
        colObj = objRow.insertCell(colIdx + week);
        //if (pheno.weekToday == week) {
        if (todayWeek == week) {
            colObj.classList.add('phenoCellToday');
            todayWeekColumnId = colIdx + week;
            console.log('addTaxonRow | todayWeek:', todayWeek, '| week:', week, '| pheno.weekToday:', pheno.weekToday, '| todayWeekColumnId:', todayWeekColumnId);
        }

        colObj.innerHTML += `<div class="phenoBarWeek" style="height:${wFreq}px;"></div>`;
        colObj.setAttribute('data-sort', `${wCount}`); //to sort by phenoWeek, must add the dataTables sort attribute to colObj, not inner div
        colObj.setAttribute('title',  `${wCount}=>${wFreq}`);
        colObj.classList.add('phenoCell');
        colObj.classList.add('lightCell');
        colObj.classList.add(`week${week}`);
    }
}

function setTitleText(text=false, taxonNameA=[], taxonKeyA=[], butteflies=false, offset=false, limit=false) {
    if (eleTtl && text) {
        eleTtl.innerText = text;
    }
}

async function loadDataset(datasetKey=false, geoSearch=[]) {
    let rowIdx = 0;
    addPageWait();
    let butts = await getGbifSpeciesDataset(datasetKey, offset, limit, 'rank=SPECIES'); //the default checklist is VT Butterflies. Prolly should make that explicit, here.
    console.log(`vbaFlightTimes=>getGbifSpeciesDataset`, butts);
    offset = offset < butts.results.length ? offset : butts.results.length - 1;
    limit = (offset+limit) < butts.results.length ? limit : butts.results.length - offset;
    for (var i=offset; i<(offset+limit); i++) {
        let taxon = butts.results[i];
        if (('SPECIES' == taxon.rank.toUpperCase() || 'SUBSPECIES' == taxon.rank.toUpperCase()) && 'ACCEPTED' == taxon.taxonomicStatus.toUpperCase()) {
            let pheno = await gbifCountsByWeekByTaxonName(taxon.canonicalName, geoSearch);
            //let pheno = await gbifCountsByWeekByTaxonKey(taxon).nubKey);
            addTaxonRow(pheno, taxon, rowIdx++);
        }
    }
    if (showTitle) {
        titleText = titleText ? titleText : 'Vermont Butterfly Flight Times';
        setTitleText(titleText, taxonNameA, taxonKeyA);
    }
    addWeekHead();
    delPageWait();
}

if (geometry) {geoSearch.push(`geometry=${geometry}`);}
if (gadm_gid) {geoSearch.push(`gadmGid=${gadm_gid}`);}
if (province) {geoSearch.push(`stateProvince=${province}`);} //this needs to be an array of values concatenated into an http &-seprated list
if ('butterflies' ==  list) {
    await loadDataset(datasetKeys['chkVtb1'], geoSearch); //Note: MUST await, here, else dataTables fires early with disastrous results
} 
else if (datasetKey) {
    await loadDataset(datasetKey, geoSearch); //Note: MUST await, here, else dataTables fires early with disastrous results
}
else if (taxonNameA.length || taxonKeyA.length) {
    addPageWait();
    for (var i=0; i<taxonNameA.length; i++) {
        let taxonName = taxonNameA[i];
        let match = await getGbifTaxonObjFromName(taxonName); 
        console.log(`vbaFlightTimes=>getGbifTaxonObjFromName(${taxonName})`, match);
        let taxon = await getGbifSpeciesByTaxonKey(match.usageKey);
        console.log(`vbaFlightTimes=>getGbifSpeciesByTaxonKey(${taxon.canonicalName})`, taxon);
        let pheno = await gbifCountsByWeek(taxon.canonicalName, geoSearch);
        console.log(`vbaFlightTimes=>gbifCountsByWeek(${taxon.canonicalName})`, pheno);
        addTaxonRow(pheno, taxon, i);
    }
    for (var i=0; i<taxonKeyA.length; i++) {
        let taxonKey = taxonKeyA[i];
        let taxon = await getGbifSpeciesByTaxonKey(taxonKey);
        console.log(`vbaFlightTimes=>getGbifSpeciesByTaxonKey(${taxon.canonicalName})`, taxon);
        let pheno = await gbifCountsByWeekByTaxonKey(taxonKey, geoSearch);
        console.log(`vbaFlightTimes=>gbifCountsByWeekByTaxonKey(${taxonKey})`, pheno);
        addTaxonRow(pheno, taxon, i);
    }
    if (showTitle) {
        titleText = titleText ? titleText : 'Vermont Atlas of Life GBIF Phenology';
        setTitleText(titleText, taxonNameA, taxonKeyA);
    }
    addWeekHead();
    delPageWait();
} 
else 
{
    showHelp();
}

function showHelp() {
    let eleDiv = document.getElementById("phenologyDiv");
    let eleInf = document.getElementById("phenologyParamsInfo");
    let url = new URL(window.location);
    eleDiv.style.display = 'none';
    if (eleInf) {
        eleInf.innerHTML = 
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
    <br>
    <p>To show taxon information columns:</p>
        <li>&column=Scientific (or Accepted)</li>
        <li>&column=Vernacular (or Common)</li>
        <li>&Column=Observations (or Occurrences)</li>
        <li>&Column=Family</li>
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

$('#phenologyTable').ready(() => {
    if (sort) {
        let infoColumnIds = []; let weekColumnIds = [];
        for (var i=0; i<firstWeekColumnId; i++) {if (i != occurrenceColumnId) infoColumnIds.push(i);} 
        console.log('dataTables setup firstWeekColumnId:', firstWeekColumnId, 'infoColumnIds:', infoColumnIds);
        for (var i=firstWeekColumnId; i<firstWeekColumnId+53; i++) {weekColumnIds.push(i);}
        console.log('dataTables setup  firstWeekColumnId:', firstWeekColumnId, 'weekColumnIds:', weekColumnIds);
        let columnDefs =  [
            { "orderSequence": [ "asc", "desc" ], "targets": infoColumnIds },
            { "orderSequence": [ "desc", "asc" ], "targets": weekColumnIds }
        ];
        if (occurrenceColumnId >=0 ) {
            columnDefs.push({ "orderSequence": [ "desc", "asc" ], "targets": occurrenceColumnId })
        }
        tableSortHeavy('phenologyTable', todayWeekColumnId, [], columnDefs, 10, responsive, paging, searching, sortInfo);
    }
});