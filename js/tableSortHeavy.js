/*
 * Configure jQuery dataTable for column sorting. Note that this was called on completed Occ Counts. That's
 * because dataTables can't sort on columns without values. We remove from sorting other columns whose data
 * we don't wait for, like wikipedia images.
 * 
 * Inputs:
 *  tableId - text id of html element
 *  orderColumnId - numeric column ID to sort-by, initially
 *  excludeColumnIds - array of numeric column IDs to exclude from sort
 *  columnDefs - 'asc' or 'desc' for inital sort-by direction on first click of column by columnId
 *      columnDefs: [
        { orderSequence: ['asc'], targets: [1] },
        { orderSequence: ['desc', 'asc', 'asc'], targets: [2] },
        { orderSequence: ['desc'], targets: [3] }
    ]
 *  example of how excludeColumnIds is used:
      [
        { orderable: false, targets: columnIds['childTaxa'] }, //childTaxa
        { orderable: false, targets: columnIds['iconImage'] }, //iconImage
        { orderable: false, targets: columnIds['images'] }  //images (imageCount)
      ]
    example of how lengthMenu is configured:
      lengthMenu: [
        [10, 20, 50, 100, 500, -1],
        [10, 20, 50, 100, 500, 'All'],
      ],
      pageLength: limit
 */
function setDataTable(tableId='species-table', orderColumn=[0, 'asc'], excludeColumnIds=[], columnDefs=[], limit=10, responsive=false, paging=false, searching=false, info=false) {
    console.log('setDataTable | orderColumn:', orderColumn);
    console.log(`setDataTable | excludeColumnIds`, excludeColumnIds);
    for (const idx of excludeColumnIds) {
        columnDefs.push({ orderable: false, targets: excludeColumnIds[idx] });
    }
    console.log('setDataTable | columnDefs:', columnDefs);
    responsive = ('true' == String(responsive).toLowerCase() || Number(responsive) > 0);
    paging = ('true' == String(paging).toLowerCase() || Number(paging) > 0);
    searching = ('true' == String(searching).toLowerCase() || Number(searching) > 0);
    info = ('true' == String(info).toLowerCase() || Number(info) > 0);
    console.log('setDataTable flags | responsive:', responsive, '| paging:', paging, '| searching:', searching, '| info:', info);
    let tableSort = $(`#${tableId}`).DataTable({
      autoWidth: false, // <<-- IMPORTANT setting this flag to false is what allows the table to resize to the container
      responsive: responsive,
      //order: orderColumnId ? [orderColumnId] : [], //sets the initial sort-by column
      order: orderColumn && orderColumn.length ? [orderColumn] : [], //sets the initial sort-by column and direction
      paging: paging, //hides the pagination logic
      searching: searching, //hides the search box
      info: info, //hides the 1 to 20 of 20
      columnDefs: columnDefs,
      pageLength: limit, //initial records per page
      lengthMenu: [
        [10, 25, 50, 100, 500, -1],
        [10, 25, 50, 100, 500, 'All'],
      ]
    });
    return tableSort; //return the dataTable object so the caller can use it
  }
  
export function tableSortHeavy(tableId='species-table', orderColumnId=false, excludeColumnIds=[],  columnDefs=[], limit=10, responsive=false, paging=false, searching=false, info=false) {
  let orderColumn = orderColumnId ? 'order': [orderColumnId, 'asc'];
  return setDataTable(tableId, orderColumn, excludeColumnIds, columnDefs, limit, responsive, paging, searching, info);
}

  
export function tableSortHeavyNew(tableId='species-table', orderColumn=[], excludeColumnIds=[],  columnDefs=[], limit=10, responsive=false, paging=false, searching=false, info=false) {
  return setDataTable(tableId, orderColumn, excludeColumnIds, columnDefs, limit, responsive, paging, searching, info);
}
