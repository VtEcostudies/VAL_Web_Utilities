//This adapted from https://www.w3schools.com/howto/howto_js_sort_table.asp
export function tableSortTrivial(tableId) {

    var selHed = "thead th";
    var ascClass = "sort-asc";
    var desClass = "sort-des";
    var sorClass = "sortable";
    var eleTbl = document.getElementById(tableId);
    var eleHed = eleTbl.querySelectorAll(selHed);
    console.log('tableSortTrivial | Header Elements:', eleHed);
    setEventToAllObject(eleHed, "click", function(e) {sortClick(e.target); });
    eleTbl.classList.add(sorClass);

    function setEventToAllObject(elem, e, f) {
        [...elem].map((v)=> {
            v.addEventListener(e, f, false);
        });
    }

    function sortClick(elem) {
        var sorDir = !elem.classList.contains(ascClass) ? 1 : 0;
        var colIdx = getHedColIndex(elem);

        sortTable(colIdx, sorDir);
        remThClass();
        addThClass(elem, sorDir);
    }

    function getHedColIndex(eleCol)  {
        //console.log('tableSortTrivial::getHedColIndex | clicked element:', eleCol, 'header elements:', eleHed);
        let colIdx = 0;
        for (const key in eleHed) {
            //console.log('tableSortTrivial::getHedColIndex | compare clicked-element to header element:', eleCol.innerText, eleHed[key].innerText);
            if (eleCol.innerText == eleHed[key].innerText) {
                console.log(`*************************FOUND CLICKED ELEMENT, INDEX:`, eleHed[key], key);
                colIdx = Number(key);
            }
        }
        return colIdx;
    }

    function remThClass() {
        Object.keys(eleHed).forEach(function(key) {
            eleHed[key].classList.remove(desClass);
            eleHed[key].classList.remove(ascClass);
        });
    }

    function addThClass(elem, sorDir) {
        if (sorDir) {
            elem.classList.add(ascClass);
        } else {
            elem.classList.add(desClass);
        }
    }

    function sortTable(colIdx=0, sorDir=1) { //sortDir=1=Asc, sortDir=0=Desc
        console.log('tableSortTrivial::sortTable | column index:', colIdx, 'sort direction:', sorDir);
        var rows, switching, i, j=0, shouldSwitch;
        switching = true;
        /* Loop until no switching was done */
        while (switching) {
            switching = false; //initialize switch flag
            rows = eleTbl.rows;
            /* Loop through table rows (except the first, which is header row) */
            for (i = 1; i < (rows.length - 1); i++) {
                // Start by saying there should be no switching:
                shouldSwitch = false;
                /* Get two elements to compare, current row and next row. */
                let xS = rows[i].getElementsByTagName("TD")[colIdx].innerText;
                let yS = rows[i + 1].getElementsByTagName("TD")[colIdx].innerText;
                let xN = parseInt(xS.replace(/,/g, '')); //remove commas from putative numbers
                let yN = parseInt(yS.replace(/,/g, '')); //remove commas from putative numbers
                let x = xN ? xN : xS.toUpperCase();
                let y = yN ? yN : yS.toUpperCase();
                //console.log('tableSortTrivial::sortTable | ', `${xS}|${xN}|${x}`, `${yS}|${yN}|${y}`);
                console.log('row loop:', i)
                if (sorDir && x > y) {
                    shouldSwitch = true; break;
                }            
                if (!sorDir && x < y) {
                    shouldSwitch = true; break;
                }    
            }
            if (shouldSwitch) {
                /* If a switch was marked, make the switch and mark that a switch was done. */
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
            }
            j++;
            console.log('while loop:', j)
        }
    }
}
