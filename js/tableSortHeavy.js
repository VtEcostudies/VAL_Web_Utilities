/*
 * Configure jQuery dataTable for column sorting. Note that this was called on completed Occ Counts. That's
 * because dataTables can't sort on columns without values. We remove from sorting other columns whose data
 * we don't wait for, like wikipedia images.
 */
function setDataTable(tableId='species-table', orderColumnId='', excludeColumnIds=[]) {
    console.log(`setDataTable | exclude columnIds`, excludeColumnIds);
    let colDefs = [];
    for (const idx of excludeColumnIds) {
        colDefs.push({ orderable: false, targets: excludeColumnIds[idx] });
    }
    console.log('setDataTable | exclude columnDefs:', colDefs);
    $(`#${tableId}`).DataTable({
      responsive: false,
      order: [orderColumnId, 'desc'],
      paging: false, //hides the pagination logic
      searching: false, //hides the dt search box
      info: false, //hides the 1 to 20 of 20
      columnDefs: colDefs
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
  
  export function tableSortHeavy(tableId='species-table', orderColumnId='', excludeColumnIds=[]) {
    setDataTable(tableId, orderColumnId, excludeColumnIds);
  }
