/*
 * Configure jQuery dataTable for column sorting. Note that this was called on completed Occ Counts. That's
 * because dataTables can't sort on columns without values. We remove from sorting other columns whose data
 * we don't wait for, like wikipedia images.
 * 
 * Inputs:
 *  tableId - text id of html element
 *  orderColumnId - numeric column ID to sort-by, initially. Now that value is put into 'orderColumn' format, below.
 *  orderColumn - how the initial sort-by column must be defined, eg. Pass a 1D array, like [0, 'asc'].
 *    order: [[0, 'asc']]
 *  excludeColumnIds - array of numeric column IDs to exclude from sort
 *  columnDefs - 'asc' or 'desc' for inital sort-by direction on first click of column by columnId
 *      columnDefs: [
        { orderSequence: ['asc'], targets: [1] },
        { orderSequence: ['desc', 'asc', 'asc'], targets: [2] },
        { orderSequence: ['desc'], targets: [3] }
    ]
 *  example of excludeColumnIds usage:
      [
        { orderable: false, targets: columnIds['childTaxa'] }, //childTaxa
        { orderable: false, targets: columnIds['iconImage'] }, //iconImage
        { orderable: false, targets: columnIds['images'] }  //images (imageCount)
      ]
    example of lengthMenu configuration:
      lengthMenu: [
        [10, 20, 50, 100, 500, -1],
        [10, 20, 50, 100, 500, 'All'],
      ],
      pageLength: pageLength
 */
function setDataTable(
  tableId='species-table', 
  orderColumn=[0, 'asc'], 
  excludeColumnIds=[], 
  columnDefs=[], 
  pageLength=10, 
  responsive=false, 
  paging=false, 
  searching=false, 
  info=false,
  fixedHeader=false
) {
    console.log('setDataTable | orderColumn:', orderColumn);
    console.log(`setDataTable | excludeColumnIds`, excludeColumnIds);
    for (const idx of excludeColumnIds) {
        columnDefs.push({ orderable: false, targets: idx });
    }
    console.log('setDataTable | columnDefs:', columnDefs);
    responsive = ('true' == String(responsive).toLowerCase() || Number(responsive) > 0);
    paging = ('true' == String(paging).toLowerCase() || Number(paging) > 0);
    searching = ('true' == String(searching).toLowerCase() || Number(searching) > 0);
    info = ('true' == String(info).toLowerCase() || Number(info) > 0);
    console.log('setDataTable flags | responsive:', responsive, '| paging:', paging, '| searching:', searching, '| info:', info);
    let tableSort = $(`#${tableId}`).DataTable({
      autoWidth: false, // <<-- IMPORTANT setting this flag to false is what allows the table to resize to the container
      fixedHeader: fixedHeader, //sticky header - on scroll, table column headers visible
      responsive: responsive,
      order: orderColumn && orderColumn.length ? [orderColumn] : [], //sets the initial sort-by column and direction
      paging: paging, //hides the pagination logic
      searching: searching, //hides the search box
      info: info, //hides the 1 to 20 of 20
      columnDefs: columnDefs,
      pageLength: pageLength, //initial records per page
      lengthMenu: [
        [10, 25, 50, 100, 500, -1],
        [10, 25, 50, 100, 500, 'All'],
      ]
    });
    return tableSort; //return the dataTable object so the caller can use it
  }
  
export function tableSortHeavy_DEPRECATED(tableId='species-table', orderColumnId=false, excludeColumnIds=[],  columnDefs=[], pageLength=10, responsive=false, paging=false, searching=false, info=false) {
  let orderColumn = orderColumnId ? [orderColumnId, 'asc'] : [0, 'asc'];
  return setDataTable(tableId, orderColumn, excludeColumnIds, columnDefs, pageLength, responsive, paging, searching, info);
}

export function tableSortHeavy(tableId='species-table', orderColumn=[], excludeColumnIds=[],  columnDefs=[], pageLength=10, responsive=false, paging=false, searching=false, info=false, fixedHeader=true) {
  return setDataTable(tableId, orderColumn, excludeColumnIds, columnDefs, pageLength, responsive, paging, searching, info, fixedHeader);
}
