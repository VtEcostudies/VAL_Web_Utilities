import { gbifCountsByWeek, gbifCountsByWeekByTaxonKey, gbifCountsByWeekByTaxonName } from './gbifCountsByWeek.js';
import { datasetKeys } from "./fetchGbifSpecies.js";
import { getGbifSpeciesDataset, getGbifSpeciesByTaxonKey } from './fetchGbifSpecies.js';
import { getGbifTaxonObjFromName } from './commonUtilities.js';
import { tableSortHeavy } from './tableSortHeavy.js'
import './extendDate.js'; //import getWeek() and toUtc()

const objUrlParams = new URLSearchParams(window.location.search);
const taxonNameA = objUrlParams.getAll('taxonName'); //Array of taxon names?
const taxonKeyA = objUrlParams.getAll('taxonKey'); //Array of taxon keys
const butterflies = objUrlParams.get('butterflies'); //Single query param
const columnA = objUrlParams.getAll('column'); //Array of additional columns to show
var showTitle = objUrlParams.get('showTitle'); //Single query param
showTitle = (String(showTitle).toLowerCase() != 'false' && Number(showTitle) != 0)
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

let monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
//head row of month names every 4ish weeks
async function addWeekHead() {
    let colIdx = -1;
    let objHed = eleTbl.createTHead();
    let hedRow = objHed.insertRow(0);
    //eleTbl.append(hedRow); //doing this orders table rows properly, but causes dataTable to fail
    let colObj;
    columnA.forEach(column => {
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
            colObj.setAttribute('id', `head-${column}`); //store the className applied to column cells for highlighting
            colObj.classList.add(`head-${column}`); //so it highlights itself on click
            colObj.classList.add('lightCell');
            colObj.addEventListener("click", (e) => {
                clearAllWeeks();
                console.log('id:', e.target.id);
                highlightWeek(e.target.id);
            });
        }
    })
    let month = 0; //necessary. iterated below as counter.
    for (var week=1; week<54; week++) {
        colObj = await hedRow.insertCell(colIdx + week);
        colObj.innerHTML = `<div id="week${week}" class="weekHeaderNumber">${week}</div>`;
        let weeksPerMonth = 31/7;
        if (week/weeksPerMonth > month) {
            month++;
            colObj.innerHTML += `<div id="week${week}" class="monthHeaderName">${monthName[month-1]}</div>`;
            colObj.classList.add('no-stretch-cell');
        } else {
            colObj.innerHTML += `<div id="week${week}" class="monthHeaderName">&nbsp</div>`; //nbsp is required placeholder
        }
        if (todayWeek == week) {
            colObj.classList.add('phenoCellToday');
        }
        colObj.classList.add('phenoCell');
        colObj.classList.add('lightCell');
        colObj.classList.add(`week${week}`);
        colObj.setAttribute('id', `week${week}`);
        colObj.addEventListener("click", (e) => {
            clearAllWeeks();
            console.log('id:', e.target.id);
            highlightWeek(e.target.id);
        });
    }
}
function clearAllWeeks() {
    let wObjs = document.getElementsByClassName('lightCell');
    Object.keys(wObjs).forEach(key => {
        wObjs[key].removeAttribute('style');
    })
}

function highlightWeek(columnClass=false) {
    if (columnClass) {
        let wObjs = document.getElementsByClassName(columnClass);
        Object.keys(wObjs).forEach(key => {
            wObjs[key].style.backgroundColor = 'greenyellow';
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

    firstWeekColumnId = colIdx+1; //needed to set up dataTables sort direction
    let month = 0;
    for (var week=1; week<54; week++) {
        let wCount = pheno.weekSum[week] ? pheno.weekSum[week] : 0;
        let wFreq = Math.ceil(wCount/pheno.total*100); //looks bad for small total counts
        wFreq = Math.ceil(wCount / Math.sqrt(wCount)); //looks OK for all data, includes single-values
        colObj = objRow.insertCell(colIdx + week);
        if (pheno.weekToday == week) {
            colObj.classList.add('phenoCellToday');
            todayWeekColumnId = colIdx + week;
        }
        colObj.innerHTML += `<div class="phenoBarWeek" style="height:${wFreq}px;"></div>`;
        colObj.setAttribute('data-sort', `${wCount}`); //to sort by phenoWeek, must add the dataTables sort attribute to colObj, not inner div
        //colObj.setAttribute('data-order', `${wCount}`); //to sort by phenoWeek, must add the dataTables sort attribute to colObj, not inner div
        colObj.setAttribute('title',  `${wCount}=>${wFreq}`);
        colObj.classList.add('phenoCell');
        colObj.classList.add('lightCell');
        colObj.classList.add(`week${week}`)
    }
}

function setTitleText(text=false, taxonNameA=[], taxonKeyA=[], butteflies=false, offset=false, limit=false) {
    if (eleTtl && text) {
        eleTtl.innerText = text;
    }
}

if (butterflies) {
    let rowIdx = 0;
    addPageWait();
    let butts = await getGbifSpeciesDataset(datasetKeys['chkVtb1'],0,1000,'rank=SPECIES'); //the default checklist is VT Butterflies. Prolly should make that explicit, here.
    console.log(`vbaFlightTimes=>getGbifSpeciesDataset`, butts);
    offset = offset < butts.results.length ? offset : butts.results.length - 1;
    limit = (offset+limit) < butts.results.length ? limit : butts.results.length - offset;
    for (var i=offset; i<(offset+limit); i++) {
        let taxon = butts.results[i];
        if (('SPECIES' == taxon.rank.toUpperCase() || 'SUBSPECIES' == taxon.rank.toUpperCase()) && 'ACCEPTED' == taxon.taxonomicStatus.toUpperCase()) {
            let pheno = await gbifCountsByWeekByTaxonName(taxon.canonicalName);
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
else if (taxonNameA.length || taxonKeyA.length) {
    addPageWait();
    for (var i=0; i<taxonNameA.length; i++) {
        let taxonName = taxonNameA[i];
        let match = await getGbifTaxonObjFromName(taxonName); 
        console.log(`vbaFlightTimes=>getGbifTaxonObjFromName(${taxonName})`, match);
        let taxon = await getGbifSpeciesByTaxonKey(match.usageKey);
        console.log(`vbaFlightTimes=>getGbifSpeciesByTaxonKey(${taxon.canonicalName})`, taxon);
        let pheno = await gbifCountsByWeek(taxon.canonicalName);
        console.log(`vbaFlightTimes=>gbifCountsByWeek(${taxon.canonicalName})`, pheno);
        addTaxonRow(pheno, taxon, i);
    }
    for (var i=0; i<taxonKeyA.length; i++) {
        let taxonKey = taxonKeyA[i];
        let taxon = await getGbifSpeciesByTaxonKey(taxonKey);
        console.log(`vbaFlightTimes=>getGbifSpeciesByTaxonKey(${taxon.canonicalName})`, taxon);
        let pheno = await gbifCountsByWeekByTaxonKey(taxonKey);
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
    let eleInf = document.getElementById("phenologyParamsInfo");
    let url = new URL(window.location);
    if (eleInf) {
        eleInf.innerHTML = 
    `
    <p>Control the VAL phenology chart with query parameters:</p>
        <li><a href="${url.href}?butterflies=true&column=Scientific&column=Vernacular&limit=5">?butterflies=true</a> to show VT Butterflies.</li>
    <br>
    <p>To show specific taxa:</p>
        <li><a href="${url.href}?taxonName=Danaus plexippus&showTitle=true&titleText=Monarch Phenology">?taxonName=Danaus plexippus</a></li>
        <li><a href="${url.href}?taxonKey=1918395&column=Scientific&column=Vernacular">?taxonKey=5133088</a></li>
    <br>
    <p>To show mulitple taxa:</p>
        <li>
            <a href="${url.href}?taxonName=Danaus plexippus&taxonName=Cercyonis pegala&column=Scientific&column=Vernacular&column=Observations">
            ?taxonName=Danaus plexippus&taxonName=Cercyonis pegala
            </a>
        </li>
        <li>
            <a href="${url.href}?taxonKey=6953&taxonKey=5473&taxonKey=7017&taxonKey=9417&taxonKey=5481&taxonKey=1933999&column=Scientific&column=Vernacular&column=Family&column=Occurrences">
            ?taxonKey=6953&taxonKey=5473&taxonKey=7017&taxonKey=9417&taxonKey=5481&taxonKey=1933999
            </a>
        </li>
    <br>
    <p>To show taxon information columns:</p>
        <li>&column=Scientific</li>
        <li>&column=Vernacular</li>
        <li>&Column=Observations</li>
        <li>&Column=Family</li>
    <br>
    <p>
    You may include columns returned from the GBIF Species API.
    </p>
    `
    }
}

$('#phenologyTable').ready(() => {
    let infoColumnIds = []; let weekColumnIds = [];
    for (var i=0; i<firstWeekColumnId; i++) {infoColumnIds.push(i);} console.log('dataTables setup infoColumnIds:', firstWeekColumnId, infoColumnIds);
    for (var i=firstWeekColumnId; i<firstWeekColumnId+53; i++) {weekColumnIds.push(i);} console.log('dataTables setup weekColumnIds:', firstWeekColumnId, weekColumnIds);
    let columnDefs =  [
        { "orderSequence": [ "asc", "desc" ], "targets": infoColumnIds },
        { "orderSequence": [ "desc", "asc" ], "targets": weekColumnIds }
    ];
    tableSortHeavy('phenologyTable', todayWeekColumnId, [], columnDefs); //columnId 2 is VT Obs count
});