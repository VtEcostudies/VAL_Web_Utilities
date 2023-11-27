import { gbifCountsByWeekByTaxonKey, gbifCountsByWeekByTaxonName } from './gbifCountsByWeek.js';
import { datasetKeys } from "./fetchGbifSpecies.js";
import { getGbifSpeciesByDataset, getGbifSpeciesByTaxonKey } from './fetchGbifSpecies.js';
import { getGbifTaxonObjFromName } from './commonUtilities.js';
import { tableSortHeavy } from './tableSortHeavy.js'
import './extendDate.js'; //import getWeek() and toUtc()

var eleTbl = document.getElementById("phenologyTable");
var eleTtl = document.getElementById("phenologyTitle");
var divWait = document.getElementById("pageWait");
var objWait;

var todayDate = new Date().toUtc(); //today's date shifted to UTC
var todayWeek = todayDate.getWeek()+1; // the week we're in today, 1-based
var todayWeekColumnId = 0; //the columnId in the table of this week in the year, to (hopefully) auto-sort by that phenology
var firstWeekColumnId = 0;
var occurrenceColumnId = -1;

async function addPageWait() {
    if (divWait) {    
        objWait = document.createElement('i');
        console.log('addPageWait', objWait);
        divWait.append(objWait);
        objWait.style = 'text-align: center;';
        divWait.style = 'text-align: center;';
        objWait.innerHTML = `<i class="fa fa-spinner fa-spin" style="font-size:60px;"></i>`;
    } else {
        console.log('addPageWait | Element ID pageWait not found')
    }
}

async function delPageWait() {
    if (objWait) {objWait.remove();}
}

let monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let monthSize = [31,28,31,30,31,30,31,31,30,31,30,31];
let MonthDays = [1,32,60,91,121,152,182,213,244,274,305,335];
//head row of month names every 4ish weeks
async function addWeekHead(columnA=[]) {
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
    for (var week=1; week<54; week++) {
        colObj = await hedRow.insertCell(colIdx + week);
        colObj.innerHTML = `<div id="week${week}" class="weekHeaderNumber">${week}</div>`;
        let days = 7 * week; //days at end of this week
        let diff = days - MonthDays[month]; //how far off we are from month boundary using weeks as a counter
        //console.log('Calculate Header Month position', 'month', month, 'week', week, 'days', days, 'diff', diff);
        if (days > MonthDays[month] && diff > 2) {
            colObj.innerHTML += `<div id="week${week}" class="monthHeaderName">${monthName[month]}</div>`;
            colObj.classList.add('no-stretch-cell');
            month++;
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

async function addTaxonRow(columnA=[], pheno=false, taxon=false, rowIdx=0) {
    let colIdx = -1;
    let objRow = eleTbl.insertRow(rowIdx); //To-do: try insertRow(-1) which has worked elsewhere
    //eleTbl.append(objRow); //doing this orders table rows properly, but causes dataTable to fail
    let colObj;
    let ancTag;

    console.log('addTaxonRow | eleTbl:', eleTbl, 'objRow:', objRow);

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

function setTitleText(objTitle, taxonNameA=[], taxonKeyA=[], butterflies=false, offset=false, limit=false) {
    if (objTitle.show) {
        objTitle.text = objTitle.text ? objTitle.text : 'Phenology';//'Vermont Butterfly Flight Times';
        if (eleTtl) {eleTtl.innerText = objTitle.text;}
    }
}

async function loadDataset(datasetKey=false, columnA=[], geoSearchA=[], offset, limit) {
    let rowIdx = 0;
    let spcs = await getGbifSpeciesByDataset(datasetKey, offset, limit, 'rank=SPECIES'); //the default checklist is VT Butterflies. Prolly should make that explicit, here.
    console.log(`vbaFlightTimes=>getGbifSpeciesByDataset`, spcs);
    offset = offset < spcs.results.length ? offset : spcs.results.length - 1;
    limit = (offset+limit) < spcs.results.length ? limit : spcs.results.length - offset;
    for (var i=offset; i<(offset+limit); i++) {
        let taxon = spcs.results[i];
        if (('SPECIES' == taxon.rank.toUpperCase() || 'SUBSPECIES' == taxon.rank.toUpperCase()) && 'ACCEPTED' == taxon.taxonomicStatus.toUpperCase()) {
            let pheno = await gbifCountsByWeekByTaxonName(taxon.canonicalName, geoSearchA);
            //let pheno = await gbifCountsByWeekByTaxonKey(taxon.nubKey, geoSearchA);
            addTaxonRow(columnA, pheno, taxon, rowIdx++);
        }
    }
}
function beforeTaxonRows(objHtmlIds, objTitle={show:0, text:''}) {
    if (objHtmlIds.tblId) {eleTbl = document.getElementById(objHtmlIds.tblId);}
    if (objHtmlIds.ttlId) {eleTtl = document.getElementById(objHtmlIds.ttlId);}
    setTitleText(objTitle);
    addPageWait();
}
function afterTaxonRows(columnA=[], objHtmlIds, objSort, objTitle={show:0, text:''}) {
    //setTitleText(objTitle);
    addWeekHead(columnA);
    sortColumns(objHtmlIds.tblId, objSort);
    delPageWait();
}
/*
    geoSearch [`gadmGid=USA_46.1`,`geometry={WKT}`,`stateProvince='Vermont'`]
*/
export async function gbifPhenologyBySpeciesListName(listName, columnA=[], geoSearchA=[], objHtmlIds={tblId:false, ttlId:false}, objSort, objTitle, offset, limit) {
    if ('butterflies' ==  listName) {
        gbifPhenologyByDataSetKey(datasetKeys['chkVtb1'], columnA, geoSearchA, objHtmlIds, objSort, objTitle, offset, limit); //Note: MUST await, here, else dataTables fires early with disastrous results
    } else {
        console.log(`Species-list named ${listName} NOT found.`);
    }
}
export async function gbifPhenologyByDataSetKey(datasetKey, columnA=[], geoSearchA=[], objHtmlIds={tblId:false, ttlId:false}, objSort, objTitle, offset, limit) {
    beforeTaxonRows(objHtmlIds, objTitle);
    await loadDataset(datasetKey, columnA, geoSearchA, offset, limit); //Note: MUST await, here, else dataTables fires early with disastrous results
    afterTaxonRows(columnA, objHtmlIds, objSort);
}
export async function gbifPhenologyByTaxonKeys(taxonKeyA=[], columnA=[], geoSearchA=[], objHtmlIds={tblId:false, ttlId:false}, objSort, objTitle) {
    beforeTaxonRows(objHtmlIds, objTitle);
    for (var i=0; i<taxonKeyA.length; i++) {
        let taxonKey = taxonKeyA[i];
        let taxon = await getGbifSpeciesByTaxonKey(taxonKey);
        console.log(`vbaFlightTimes=>getGbifSpeciesByTaxonKey(${taxon.canonicalName})`, taxon);
        let pheno = await gbifCountsByWeekByTaxonKey(taxonKey, geoSearchA);
        console.log(`vbaFlightTimes=>gbifCountsByWeekByTaxonKey(${taxonKey})`, pheno);
        addTaxonRow(columnA, pheno, taxon, i);
    }
    afterTaxonRows(columnA, objHtmlIds, objSort);
}
export async function gbifPhenologyByTaxonNames(taxonNameA=[], columnA=[], geoSearchA=[], objHtmlIds={tblId:false, ttlId:false}, objSort, objTitle) {
    beforeTaxonRows(objHtmlIds, objTitle);
    for (var i=0; i<taxonNameA.length; i++) {
        let taxonName = taxonNameA[i];
        let match = await getGbifTaxonObjFromName(taxonName); 
        console.log(`vbaFlightTimes=>getGbifTaxonObjFromName(${taxonName})`, match);
        let taxon = await getGbifSpeciesByTaxonKey(match.usageKey);
        console.log(`vbaFlightTimes=>getGbifSpeciesByTaxonKey(${taxon.canonicalName})`, taxon);
        let pheno = await gbifCountsByWeekByTaxonName(taxon.canonicalName, geoSearchA);
        console.log(`vbaFlightTimes=>gbifCountsByWeek(${taxon.canonicalName})`, pheno);
        addTaxonRow(columnA, pheno, taxon, i);
    }
    afterTaxonRows(columnA, objHtmlIds, objSort);
} 
function sortColumns(tableId='phenologyTable', objSort={sort:0, responsive:0, paging:0, searching:0, sortInfo:0}) {
    if (objSort.sort) {
        $(`#${tableId}`).ready(() => {
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
                tableSortHeavy(tableId, todayWeekColumnId, [], columnDefs, 10, objSort.responsive, objSort.paging, objSort.searching, objSort.sortInfo);
        });
    }
}