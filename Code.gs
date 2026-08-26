// ═══════════════════════════════════════════════
// REST API FOR GITHUB APP
// ═══════════════════════════════════════════════
function doGet(e) {
  e = e || {}; // Safe check
  e.parameter = e.parameter || {};
  
  var action = e.parameter.action;
  var p = e.parameter;
  var result = {};
  try {
    if (action === 'getFormStructure') result = getFormStructure();
    else if (action === 'getDashboardData') result = getDashboardData();
    else if (action === 'getDealerDetails') result = getDealerDetails(p.outletName);
    else if (action === 'getDealerFormStructure') result = getDealerFormStructure();
    else if (action === 'getDealerByRow') result = getDealerByRow(parseInt(p.rowNum));
    else if (action === 'getAllOutletsForMapSearch') result = getAllOutletsForMapSearch();
    else if (action === 'exportAllComplaints') result = exportAllComplaints();
    else result = { error: "Invalid GET action or missing parameters. Action received: " + action };
  } catch (err) { result = { error: err.toString() }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  var action = data.action;
  var result = {};
  try {
    if (action === 'saveData') result = saveData(data.formData, data.editRowNumber);
    else if (action === 'loadComplaints') result = loadComplaints(data.pageNumber, data.searchTerm, data.statusFilter, data.rowsPerPage);
    else if (action === 'deleteComplaint') result = deleteComplaint(data.rowNumber);
    else if (action === 'updateComplaintStatus') result = updateComplaintStatus(data.rowNumber, data.newStatus);
    else if (action === 'updateDealerInfo') result = updateDealerInfo(data.dealerData);
    else if (action === 'addNewDealer') result = addNewDealer(data.dealerData);
    else if (action === 'getDealersListData') result = getDealersListData(data.pageNumber, data.rowsPerPage, data.searchTerm);
    else if (action === 'deleteDealerRow') result = deleteDealerRow(data.rowNum);
    else result = { error: "Invalid POST action" };
  } catch (err) { result = { error: err.toString() }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
