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
 */
function setDataTable(tableId='species-table', orderColumnId=0, excludeColumnIds=[], columnDefs=[]) {
    console.log(`setDataTable | exclude columnIds`, excludeColumnIds);
    for (const idx of excludeColumnIds) {
        columnDefs.push({ orderable: false, targets: excludeColumnIds[idx] });
    }
    console.log('setDataTable | exclude columnDefs:', columnDefs);
    //console.log('setDataTable | orderColumnId:', orderColumnId, 'orderDirection:', orderDir);
    $(`#${tableId}`).DataTable({
      autoWidth: false, // <<-- IMPORTANT setting this flag to false is what allows the table to resize to the container
      responsive: true,
      order: orderColumnId ? [orderColumnId] : [],
      paging: false, //hides the pagination logic
      searching: false, //hides the dt search box
      info: false, //hides the 1 to 20 of 20
      columnDefs: columnDefs
/*
      [
        { orderable: false, targets: columnIds['childTaxa'] }, //childTaxa
        { orderable: false, targets: columnIds['iconImage'] }, //iconImage
        { orderable: false, targets: columnIds['images'] }  //images (imageCount)
      ]
*/
/*
      lengthMenu: [
        [10, 20, 50, 100, 500, -1],
        [10, 20, 50, 100, 500, 'All'],
      ],
      pageLength: limit
*/
    });
  }
  
export function tableSortHeavy(tableId='species-table', orderColumnId='', excludeColumnIds=[],  columnDefs=[]) {
  setDataTable(tableId, orderColumnId, excludeColumnIds, columnDefs);
}
