export function tableSortSimple(tableId='table-sortable') {

    //default
    var config = {
        tableId: tableId,
        cssAsc: "order-asc",
        cssDesc: "order-desc",
        cssBoth: "order-both",
        cssBg: "sortable",
        selectorHeaders: "thead th"
    };
    console.log('tableSortSimple.js | config', config);

    /**
     * setEventToAllObject
     *
     * @param {HTMLElement} elem
     * @param {String} e
     * @param {Function} f
     * @return
     */
    function setEventToAllObject(elem, e, f) {
        [...elem].map((v)=> {
            v.addEventListener(e, f, false);
        });
    }

    /**
     * getTableElement
     *
     * @param {HTMLElement} elem
     * @return {HTMLElement} table
     */
    function getTableElement(elem) {
        var f = th => {
            return th.tagName.toUpperCase() === "TABLE" ? th : f(th.parentNode);
        };
        return f(elem.parentNode);
    }

    /**
     * getTableData
     *
     * @param {HTMLElement} tableElem
     * @return {Array} data - tableElem
     */
    function getTableData(tableElem) {
        var data = [];
        for (var i = 1, l = tableElem.length; i < l; i++) {
            for (var j = 0, m = tableElem[i].cells.length; j < m; j++) {
                if (typeof data[i] === "undefined") {
                    data[i] = {};
                    data[i]["key"] = i;
                }
                data[i][j] = tableElem[i].cells[j].innerText;
            }
        }
        return data;
    }

    /**
     * sortTableData
     *
     * @param {Array} tableData - tableElem
     * @param {Int} colNo
     * @param {Int} sortOrder
     * @return {Array} tableData
     */
    function sortTableData(tableData, colNo, sortOrder) {
        return tableData.sort((a, b) => {
            let x = parseInt(a[colNo].replace(/,/g, ''))
            let y = parseInt(b[colNo].replace(/,/g, ''))
            x = x ? x : a[colNo].toUpperCase();
            y = y ? y : b[colNo].toUpperCase();
            //console.log('sortTableData', `${a[colNo]} | ${x}`, `${b[colNo]} | ${y}`);
            if (x < y) {
                return -1 * sortOrder;
            }            
            if (x > y) {
                return sortOrder;
            }
            return 0;
        });
    }

    /**
     * rewriteTableHTML
     *
     * @param {HTMLElement} table
     * @param {Array} tableData - tableElem
     * @return
     */
    function rewriteTableHTML(table, tableData) {
        var html = "";
        tableData.forEach(function(x) {
            html += table.querySelectorAll("tr")[x["key"]].outerHTML;
        });
        table.querySelector("tbody").innerHTML = html;
    }

    /**
     * removeTHClass
     *
     * @param {HTMLElement} table
     * @param {Int} sortOrder
     * @return
     */
    function removeTHClass(table, tableData) {
        var tableElem = table.querySelectorAll(config.selectorHeaders);
        Object.keys(tableElem).forEach(function(key) {
            tableElem[key].classList.remove(config.cssDesc);
            tableElem[key].classList.remove(config.cssAsc);
            tableElem[key].classList.add(config.cssBoth);
        });
    }

    /**
     * setTHClass
     *
     * @param {HTMLElement} elem
     * @param {Int} sortOrder
     * @return
     */
    function setTHClass(elem, sortOrder) {
        if (sortOrder === 1) {
            elem.classList.add(config.cssAsc);
        }else {
            elem.classList.add(config.cssDesc);
        }
        elem.classList.remove(config.cssBoth);
    }

    /**
     * sortEvent
     *
     * @param {HTMLElement} elem
     * @return {boolean} true
     */
    function sortEvent(elem) {

        var table = getTableElement(elem);
        if (!table) {
            return;
        }

        var tableData = getTableData(table.querySelectorAll("tr"));

        var sortOrder = !elem.classList.contains(config.cssAsc) ? 1 : -1;

        tableData = sortTableData(tableData, elem.cellIndex, sortOrder);

        rewriteTableHTML(table, tableData);

        removeTHClass(table, tableData);
        setTHClass(elem, sortOrder);
    }

    var eleTbl = document.getElementById(config.tableId);
    console.log('tableSortSimple.js | table element:', eleTbl)
    var eleHed = eleTbl.querySelectorAll(config.selectorHeaders);
    console.log('tableSortSimple.js | header elements:', eleHed)
    eleTbl.classList.add(config.cssBg);
    setEventToAllObject(eleHed, "click", function(e) {sortEvent(e.target); });

    return this;
};
