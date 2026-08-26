var CONFIG_SHEET = "FormConfig";
var TARGET_SHEET = "Complents";
var ROWS_PER_PAGE = 10;
var DATE_FORMAT = "dd/MM/yyyy";
var SCRIPT_TIMEZONE = Session.getScriptTimeZone();

function formatCell(cell) {
  if (cell instanceof Date) {
    try { return Utilities.formatDate(cell, SCRIPT_TIMEZONE, DATE_FORMAT); }
    catch (e) {
      var d = cell;
      return (d.getDate()<10?'0':'')+d.getDate()+'/'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'/'+d.getFullYear();
    }
  }
  if (cell === null || cell === undefined) return "";
  return cell;
}

function formatRow(row) { return row.map(function(c){return formatCell(c);}); }

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate().setTitle('IOC Complent Software')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ═══════════════════════════════════════════════
// DYNAMIC COMPLAINT FORM STRUCTURE
// ═══════════════════════════════════════════════
function getFormStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TARGET_SHEET);
  if (!sheet) return { error: "Complents sheet not found!" };
  
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { error: "No headers found in Complents sheet." };
  
  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var cleanHeaders = rawHeaders.map(function(h){return h ? String(h).trim() : "";});
  
  var headIdx = -1;
  for (var i = 0; i < cleanHeaders.length; i++) {
    var hl = cleanHeaders[i].toLowerCase();
    if (hl === "head" || hl === "#" || hl === "row") {
      var sample = [];
      for (var j = 1; j < Math.min(4, sheet.getLastRow()); j++) { sample.push(sheet.getRange(j+1, i+1).getValue()); }
      if (sample.every(function(v){return v !== "" && v !== null && !isNaN(v);})) { 
        if (hl === "head") headIdx = i; 
      }
    }
  }

  var srNoColIdx = findColumnIndex(cleanHeaders, "Sr No");
  if (srNoColIdx === -1) srNoColIdx = findColumnIndex(cleanHeaders, "Sr. No");
  if (srNoColIdx === -1) srNoColIdx = findColumnIndex(cleanHeaders, "Sr Number");
  if (srNoColIdx === -1) srNoColIdx = findColumnIndex(cleanHeaders, "Serial No");
  
  var nextSrNo = 1;
  if (srNoColIdx !== -1 && sheet.getLastRow() > 1) {
    var srData = sheet.getRange(2, srNoColIdx + 1, sheet.getLastRow() - 1, 1).getValues().flat();
    var nums = srData.filter(function(v){ return v !== "" && v !== null && !isNaN(v); }).map(Number);
    if (nums.length > 0) {
      nextSrNo = Math.max.apply(null, nums) + 1;
    }
  }

  var dealerSheet = ss.getSheetByName("Dealers Contact");
  var outletNames = [];
  var roCodeMapping = {};
  
  if (dealerSheet && dealerSheet.getLastRow() > 1) {
    var lastDealerRow = dealerSheet.getLastRow();
    var dealerData = dealerSheet.getRange(2, 2, lastDealerRow - 1, 2).getValues(); 
    
    dealerData.forEach(function(row) {
      var roCode = row[0] ? String(row[0]).trim() : "";
      var outletName = row[1] ? String(row[1]).trim() : "";
      
      if (outletName && outletName !== "*") {
        outletNames.push(outletName);
        if (roCode) {
          roCodeMapping[outletName] = [roCode];
        }
      }
    });
  }

  var fields = [];
  var ddSheet = ss.getSheetByName("DropdownData");
  var ddData = {};
  if (ddSheet && ddSheet.getLastRow() > 1 && ddSheet.getLastColumn() > 0) {
    var ddLastCol = ddSheet.getLastColumn();
    var ddRawHeaders = ddSheet.getRange(1, 1, 1, ddLastCol).getValues()[0];
    var ddLastRow = ddSheet.getLastRow();
    for(var c=0; c<ddLastCol; c++) {
      var ddH = ddRawHeaders[c] ? String(ddRawHeaders[c]).trim() : "";
      if (ddH === "" || ddH === "*") continue;
      var colData = ddSheet.getRange(2, c+1, ddLastRow-1, 1).getValues().flat();
      ddData[ddH.toLowerCase()] = colData.filter(function(v){ return v !== "" && v !== null && String(v).trim() !== "*"; }).map(function(v){ return String(v).trim(); });
    }
  }

  rawHeaders.forEach(function(h, idx) {
    var cleanH = h ? String(h).trim() : "";
    if (cleanH === "" || cleanH === "*") return; 
    if (idx === headIdx) return;
    
    var hl = cleanH.toLowerCase();
    var type = "text";
    var required = false;
    var options = [];
    var defaultVal = "";
    var parent = "";
    var mapping = {};

    if (hl === "date" || hl === "user id" || hl === "password") return;

    if (idx === srNoColIdx) {
      type = "srno";
      defaultVal = nextSrNo;
      fields.push({ name: cleanH, label: cleanH, type: type, required: false, options: [], default: defaultVal, group: "General", parent: "", mapping: {} });
      return; 
    }
    
    if (hl === "retail outlet name" || hl === "outlet name") {
      type = "select";
      options = outletNames;
      required = true;
      fields.push({ name: cleanH, label: cleanH, type: type, required: required, options: options, default: "", group: "Outlet Info", parent: "", mapping: {} });
      return; 
    }

    if (hl === "ro code" || hl === "rocode" || hl === "ro no") {
      type = "autofill";
      parent = "Retail Outlet Name";
      mapping = roCodeMapping;
      fields.push({ name: cleanH, label: cleanH, type: type, required: false, options: [], default: "", group: "Outlet Info", parent: parent, mapping: mapping });
      return; 
    }

    if (hl.indexOf("detail") > -1 || hl.indexOf("remark") > -1 || hl.indexOf("complent") > -1) {
      type = "textarea";
    } else if (hl.indexOf("mobile") > -1 || hl.indexOf("phone") > -1) {
      type = "tel";
    } else if (hl.indexOf("email") > -1) {
      type = "email";
    } else if (hl === "dealer" || hl === "type" || hl === "category") {
      type = "radio";
      options = ["Dealer", "Partner"];
    }
    
    if (ddData[hl] && ddData[hl].length > 0) {
      type = "select";
      options = ddData[hl];
    }
    
    if (hl === "status") {
      type = "select";
      options = options.length > 0 ? options : ["Open", "In Progress", "Resolved", "Closed"];
    }

    if (hl === "du complent detail" || hl === "status" || hl === "dealer") {
      required = true;
    }
    
    fields.push({ 
      name: cleanH, 
      label: cleanH, 
      type: type, 
      required: required, 
      options: options, 
      default: "", 
      group: determineGroup(cleanH, type) 
    });
  });
  
  return fields;
}

function determineGroup(label, type) {
  var l = String(label).toLowerCase();
  if (l.indexOf("ro code")>-1||l.indexOf("retail outlet")>-1) return "Outlet Info";
  if (l.indexOf("user id")>-1||l.indexOf("password")>-1) return "Login Info";
  if (l.indexOf("complent")>-1||l.indexOf("detail")>-1||l.indexOf("vendor")>-1) return "Complaint Info";
  if (l.indexOf("date")>-1||l.indexOf("sr")>-1||l.indexOf("status")>-1) return "General";
  if (type==='msgbox') return "Notice";
  return "Other Info";
}

function getDataFromRange(ss, rangeString) {
  if (!rangeString) return [];
  try {
    var parts = rangeString.split(/[|!]/);
    if (parts.length < 2) return [];
    var sheet = ss.getSheetByName(parts[0].trim());
    if (!sheet) return [];
    var rawData = sheet.getRange(parts[1].trim()).getValues();
    return rawData.flat().filter(function(v){return v!==""&&v!==null&&String(v).trim()!="*";});
  } catch (e) { return []; }
}

function findColumnIndex(headers, target) {
  if (!target) return -1;
  var t = String(target).trim(), tl = t.toLowerCase();
  for (var i=0;i<headers.length;i++) { if (String(headers[i]).trim()===t) return i; }
  for (var i=0;i<headers.length;i++) { if (String(headers[i]).trim().toLowerCase()===tl) return i; }
  for (var i=0;i<headers.length;i++) { var h=String(headers[i]).trim().toLowerCase(); if (h.indexOf(tl)>-1||tl.indexOf(h)>-1) return i; }
  return -1;
}

function getDependentMapping(parentLabel, childLabel) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetsToSearch = ["DropdownData", "Dealers Contact"];
  var mapping = {};
  sheetsToSearch.forEach(function(sheetName) {
    var dataSheet = ss.getSheetByName(sheetName);
    if (!dataSheet) return;
    var lastRow = dataSheet.getLastRow(), lastCol = dataSheet.getLastColumn();
    if (lastRow < 2) return;
    var allData = dataSheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = allData[0].map(function(h){return h ? String(h).trim() : "";});
    var parentColIndex = findColumnIndex(headers, parentLabel);
    var childColIndex = findColumnIndex(headers, childLabel);
    if (parentColIndex === -1 || childColIndex === -1) return;
    for (var i = 1; i < lastRow; i++) {
      var pVal = allData[i][parentColIndex], cVal = allData[i][childColIndex];
      if (pVal && cVal && String(pVal).trim() !== "" && String(cVal).trim() !== "") {
        var key = String(pVal).trim();
        if (!mapping[key]) mapping[key] = [];
        var cStr = String(cVal).trim();
        if (mapping[key].indexOf(cStr) === -1) mapping[key].push(cStr);
      }
    }
  });
  return mapping;
}

// ═══════════════════════════════════════════════
// SAVE COMPLAINT DATA
// ═══════════════════════════════════════════════
function saveData(formData, editRowNumber) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TARGET_SHEET);
  if (!sheet) return { success: false, message: "Sheet not found" };
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (!formData["Date"]) formData["Date"] = getTodayDateStr();
  var skipCols = ["User ID", "Password"];
  var rowData = [];
  if (editRowNumber) {
    var existingValues = sheet.getRange(editRowNumber, 1, 1, lastCol).getValues()[0];
    rowData = headers.map(function(header, idx) {
      var cleanH = header ? String(header).trim() : "";
      if (cleanH === "Sr. No.") return existingValues[idx];
      if (skipCols.indexOf(cleanH) > -1) return existingValues[idx];
      var newVal = formData[cleanH] || "";
      if (String(cleanH).toLowerCase().indexOf("date") > -1 && newVal) newVal = parseDateString(newVal);
      if (!newVal && newVal !== 0) return existingValues[idx];
      return newVal;
    });
    sheet.getRange(editRowNumber, 1, 1, lastCol).setValues([rowData]);
  } else {
    var srNoCol = findColumnIndex(headers.map(function(h){return h?String(h).trim():"";}), "Sr. No.");
    var nextSrNo = 1;
    if (srNoCol !== -1 && sheet.getLastRow() > 1) {
      var srNos = sheet.getRange(2, srNoCol+1, sheet.getLastRow()-1, 1).getValues().flat();
      var maxSr = Math.max.apply(null, srNos.filter(function(v){return v&&!isNaN(v);}));
      nextSrNo = (maxSr||0)+1;
    }
    rowData = headers.map(function(header) {
      var cleanH = header ? String(header).trim() : "";
      if (cleanH === "Sr. No.") return nextSrNo;
      if (skipCols.indexOf(cleanH) > -1) return "";
      var val = formData[cleanH] || "";
      if (String(cleanH).toLowerCase().indexOf("date") > -1 && val) val = parseDateString(val);
      return val;
    });
    sheet.appendRow(rowData);
  }
  if (formData["User ID"] || formData["Password"]) updateDealerDetails(formData);
  return { success: true, message: "Data saved successfully!", srNo: rowData[findColumnIndex(headers.map(function(h){return h?String(h).trim():"";}), "Sr. No.")] || "" };
}

function getTodayDateStr() {
  var d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function parseDateString(dateStr) {
  if (!dateStr) return "";
  dateStr = String(dateStr).trim();
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) { var p=dateStr.split("-"); return new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2])); }
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) { var p=dateStr.split("/"); return new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0])); }
  return dateStr;
}

function updateDealerDetails(formData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dealerSheet = ss.getSheetByName("Dealers Contact");
  if (!dealerSheet) return;
  var lastRow = dealerSheet.getLastRow();
  if (lastRow < 2) return;
  var lastCol = dealerSheet.getLastColumn();
  var headers = dealerSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var cleanH = headers.map(function(h){return h?String(h).trim():"";});
  var data = dealerSheet.getRange(2, 1, lastRow-1, lastCol).getValues();
  var outletName = formData["Retail Outlet Name"];
  if (!outletName) return;
  var outletColIdx = findColumnIndex(cleanH, "Retail Outlet Name");
  var userIdColIdx = findColumnIndex(cleanH, "User ID");
  var passColIdx = findColumnIndex(cleanH, "Password");
  for (var i=0;i<data.length;i++) {
    if (String(data[i][outletColIdx]).trim() === String(outletName).trim()) {
      var rowNum = i+2;
      if (userIdColIdx!==-1 && formData["User ID"]) dealerSheet.getRange(rowNum, userIdColIdx+1).setValue(formData["User ID"]);
      if (passColIdx!==-1 && formData["Password"]) dealerSheet.getRange(rowNum, passColIdx+1).setValue(formData["Password"]);
      break;
    }
  }
}

// ═══════════════════════════════════════════════
// LOAD COMPLAINTS LIST
// ═══════════════════════════════════════════════
function loadComplaints(pageNumber, searchTerm, statusFilter, rowsPerPage) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TARGET_SHEET);
  if (!sheet) return { error: "Sheet not found" };
  var lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { headers:[], data:[], totalPages:0, currentPage:1, totalRecords:0, statusOptions:[], rowsPerPage:10 };
  if (!rowsPerPage || rowsPerPage < 1 || rowsPerPage > 200) rowsPerPage = 10;
  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var cleanHeaders = rawHeaders.map(function(h){ if (!h) return ""; var s = String(h).trim(); if (s === "*" || s.toLowerCase() === "head") return ""; return s; });
  var rawAllData = sheet.getRange(2, 1, lastRow-1, lastCol).getValues();
  var headIdx = -1;
  for (var i=0;i<rawHeaders.length;i++) {
    var h = String(rawHeaders[i]).trim().toLowerCase();
    if (h==="head"||h==="sr no"||h==="#") { var sample = rawAllData.slice(0,3).map(function(r){return r[i];}); if (sample.every(function(v){return v!==""&&!isNaN(v);})) { headIdx=i; break; } }
  }
  var finalHeaders = [], finalData = [];
  for (var i=0;i<cleanHeaders.length;i++) { if (i===headIdx || cleanHeaders[i]=== "") continue; finalHeaders.push(cleanHeaders[i]); }
  rawAllData.forEach(function(row){ var filteredRow = []; for (var i=0;i<row.length;i++) { if (i===headIdx) continue; if (cleanHeaders[i]=== "") continue; filteredRow.push(row[i]); } finalData.push(filteredRow); });
  var formattedData = finalData.map(function(row){return formatRow(row);});
  var mappedData = formattedData.map(function(row, index){return {rowData:row, rowNum:index+2};});
  var statusColIndex = findColumnIndex(finalHeaders, "Status");
  var filteredData = mappedData.filter(function(item){ return item.rowData.some(function(cell){return cell&&String(cell).trim()!=="";}); });
  if (searchTerm && searchTerm.trim()!== "") { var lowerTerm = searchTerm.toLowerCase().trim(); filteredData = filteredData.filter(function(item){ for (var c=0;c<item.rowData.length;c++){ if (item.rowData[c]&&String(item.rowData[c]).toLowerCase().indexOf(lowerTerm)>-1) return true; } return false; }); }
  if (statusFilter && statusFilter!=="All" && statusColIndex!==-1) { filteredData = filteredData.filter(function(item){ var cs = item.rowData[statusColIndex]?String(item.rowData[statusColIndex]).trim():""; return cs===statusFilter; }); }
  var totalDataRows = filteredData.length;
  var totalPages = Math.ceil(totalDataRows / rowsPerPage);
  if (!pageNumber||pageNumber<1) pageNumber=1;
  if (totalPages>0&&pageNumber>totalPages) pageNumber=totalPages;
  var startIndex=(pageNumber-1)*rowsPerPage;
  var endIndex=Math.min(startIndex+rowsPerPage, totalDataRows);
  var pageData=[];
  for (var i=startIndex;i<endIndex;i++) pageData.push({rowData:filteredData[i].rowData, rowNum:filteredData[i].rowNum});
  return { headers: finalHeaders, data: pageData, totalPages: totalPages, currentPage: pageNumber, totalRecords: totalDataRows, statusOptions: getUniqueStatuses(finalData, statusColIndex), rowsPerPage: rowsPerPage };
}

function getUniqueStatuses(allData, statusColIndex) {
  if (statusColIndex===-1) return [];
  var statuses=[];
  allData.forEach(function(row){ if(row[statusColIndex]){ var s=String(row[statusColIndex]).trim(); if(s&&s!=="*"&&statuses.indexOf(s)===-1) statuses.push(s); } });
  return statuses;
}

function deleteComplaint(rowNumber) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TARGET_SHEET);
  if (!sheet) return {success:false, message:"Sheet not found"};
  if (!rowNumber || isNaN(rowNumber)) return {success:false, message:"Invalid Row"};
  sheet.deleteRow(rowNumber);
  return {success:true, message:"Complaint deleted successfully!"};
}

// ═══════════════════════════════════════════════
// GET DEALER DETAILS (For Modal)
// ═══════════════════════════════════════════════
function getDealerDetails(outletName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return {error:"Sheet not found"};
  var lastRow = sheet.getLastRow();
  if (lastRow<2) return {error:"Sheet empty"};
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var cleanH = headers.map(function(h){return h?String(h).trim():"";});
  var data = sheet.getRange(2, 1, lastRow-1, lastCol).getValues();
  var outletColIdx = findColumnIndex(cleanH, "Retail Outlet Name");
  for (var i=0;i<data.length;i++) {
    if (data[i][outletColIdx]&&String(data[i][outletColIdx]).trim()===String(outletName).trim()) {
      return {headers:headers, data:formatRow(data[i])};
    }
  }
  return {error:"Dealer not found"};
}

// ═══════════════════════════════════════════════
// DASHBOARD DATA
// ═══════════════════════════════════════════════
function getDashboardData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TARGET_SHEET);
  if (!sheet) return {error:"Sheet not found"};
  var lastRow=sheet.getLastRow(), lastCol=sheet.getLastColumn();
  var emptyResult = { total:0,today:0,yesterday:0,week:0,todayChange:0, uniqueOutlets:0,activeComplaints:0,resolvedComplaints:0, statusCounts:{},outletCounts:{},recentData:[],trend:{}, statusOptions:["Open","In Progress","Resolved","Closed"], headers:[], lastUpdated:Utilities.formatDate(new Date(),SCRIPT_TIMEZONE,"dd/MM/yyyy hh:mm:ss a") };
  if (lastRow<2) return emptyResult;
  var rawHeaders = sheet.getRange(1,1,1,lastCol).getValues()[0];
  var rawAllData = sheet.getRange(2,1,lastRow-1,lastCol).getValues();
  var headIdx=-1;
  for(var i=0;i<rawHeaders.length;i++){ var h=String(rawHeaders[i]).trim().toLowerCase(); if(h==="head"||h==="sr no"||h==="#"){ var sample=rawAllData.slice(0,3).map(function(r){return r[i];}); if(sample.every(function(v){return v!==""&&!isNaN(v);})){headIdx=i;break;} } }
  var headers=[], allData=[];
  for(var i=0;i<rawHeaders.length;i++){ if(i===headIdx) continue; var ch=rawHeaders[i]?String(rawHeaders[i]).trim():""; if(ch==="*"||ch==="") continue; headers.push(ch); }
  rawAllData.forEach(function(row){ var fr=[]; for(var i=0;i<row.length;i++){if(i===headIdx) continue; fr.push(row[i]);} allData.push(fr); });
  var dateCol=-1,outletCol=-1,statusCol=-1;
  headers.forEach(function(h,i){ var hl=h.toLowerCase(); if(hl==="date")dateCol=i; if(hl==="retail outlet name")outletCol=i; if(hl==="status")statusCol=i; });
  var today=new Date(),todayStr=Utilities.formatDate(today,SCRIPT_TIMEZONE,"yyyy-MM-dd");
  var yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
  var yesterdayStr=Utilities.formatDate(yesterday,SCRIPT_TIMEZONE,"yyyy-MM-dd");
  var validData=allData.filter(function(row){return row.some(function(c){return c&&String(c).trim()!=="";});});
  var total=validData.length,todayCount=0,yesterdayCount=0,weekCount=0;
  var statusCounts={},outletCounts={},activeCount=0,resolvedCount=0;
  var activeS=["open","pending","in progress","new"],resolvedS=["resolved","closed","completed"];
  var weekAgo=new Date(today);weekAgo.setDate(weekAgo.getDate()-6);
  var weekAgoStr=Utilities.formatDate(weekAgo,SCRIPT_TIMEZONE,"yyyy-MM-dd");
  
  validData.forEach(function(row){
    if(dateCol!==-1&&row[dateCol]){ 
      var dVal = row[dateCol];
      var dObj = (dVal instanceof Date) ? dVal : new Date(dVal);
      var rds = "";
      if (dObj && !isNaN(dObj)) {
        rds = Utilities.formatDate(dObj, SCRIPT_TIMEZONE, "yyyy-MM-dd");
        if(rds===todayStr)todayCount++;
        if(rds===yesterdayStr)yesterdayCount++;
        if(rds>=weekAgoStr)weekCount++;
      }
    }
    if(statusCol!==-1&&row[statusCol]){ var s=String(row[statusCol]).trim(); if(s&&s!=="*"){statusCounts[s]=(statusCounts[s]||0)+1; if(activeS.indexOf(s.toLowerCase())>-1)activeCount++; if(resolvedS.indexOf(s.toLowerCase())>-1)resolvedCount++; } }
    if(outletCol!==-1&&row[outletCol]){ var o=String(row[outletCol]).trim(); if(o&&o!=="*")outletCounts[o]=(outletCounts[o]||0)+1; }
  });
  if(statusCol===-1){activeCount=total;statusCounts={"No Status":total};}
  var recentData=[];
  validData.slice(-10).reverse().forEach(function(row){ var oi=allData.indexOf(row),fr=formatRow(row),obj={rowNum:oi+2}; headers.forEach(function(h,i){if(h)obj[h]=fr[i]||"";}); recentData.push(obj); });
  var trend={};
  for(var d=6;d>=0;d--){ var dateObj=new Date(today);dateObj.setDate(dateObj.getDate()-d); var dsKey=Utilities.formatDate(dateObj,SCRIPT_TIMEZONE,"yyyy-MM-dd"); var dayLabel=Utilities.formatDate(dateObj,SCRIPT_TIMEZONE,"dd MMM"); var count=0; validData.forEach(function(row){ if(dateCol!==-1 && row[dateCol]){ var dVal2=row[dateCol]; var dObj2=(dVal2 instanceof Date)?dVal2:new Date(dVal2); if(dObj2&&!isNaN(dObj2)){ if(Utilities.formatDate(dObj2,SCRIPT_TIMEZONE,"yyyy-MM-dd")===dsKey) count++; } } }); trend[dayLabel]=count; }
  var uniqueOutlets=Object.keys(outletCounts).length;
  var statusOptions=statusCol!==-1?Object.keys(statusCounts):["Open","In Progress","Resolved","Closed"];
  var topOutlets={};
  Object.keys(outletCounts).sort(function(a,b){return outletCounts[b]-outletCounts[a];}).slice(0,8).forEach(function(k){topOutlets[k]=outletCounts[k];});
  var todayChange=yesterdayCount>0?Math.round(((todayCount-yesterdayCount)/yesterdayCount)*100):0;
  return { total:total,today:todayCount,yesterday:yesterdayCount,todayChange:todayChange,week:weekCount, uniqueOutlets:uniqueOutlets,activeComplaints:activeCount,resolvedComplaints:resolvedCount, statusCounts:statusCounts,outletCounts:topOutlets,recentData:recentData,trend:trend, statusOptions:statusOptions,headers:headers, lastUpdated:Utilities.formatDate(new Date(),SCRIPT_TIMEZONE,"dd/MM/yyyy hh:mm:ss a") };
}

function updateComplaintStatus(rowNumber, newStatus) {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sheet=ss.getSheetByName(TARGET_SHEET);
  if(!sheet) return {success:false,message:"Sheet not found"};
  var lastCol=sheet.getLastColumn();
  var headers=sheet.getRange(1,1,1,lastCol).getValues()[0];
  var cleanH=headers.map(function(h){return h?String(h).trim():"";});
  var statusCol=findColumnIndex(cleanH,"Status");
  if(statusCol===-1) return {success:false,message:"No 'Status' column found!"};
  sheet.getRange(rowNumber,statusCol+1).setValue(newStatus);
  return {success:true,message:"Status updated to: "+newStatus};
}

function getSmartOptions(ss, rangeString, fieldLabel) {
  var options = getDataFromRange(ss, rangeString);
  if (options.length > 0) {
    var allNumbers = options.every(function(v){ return !isNaN(v) && v !== ""; });
    if (allNumbers) {
      var parts = rangeString.split(/[|!]/);
      if (parts.length >= 2) {
        var sheetName = parts[0].trim();
        var dataSheet = ss.getSheetByName(sheetName);
        if (dataSheet) {
          var lastRow = dataSheet.getLastRow(), lastCol = dataSheet.getLastColumn();
          if (lastRow > 1 && lastCol > 0) {
            var headers = dataSheet.getRange(1, 1, 1, lastCol).getValues()[0];
            var cleanHeaders = headers.map(function(h){ return h ? String(h).trim() : ""; });
            var colIdx = findColumnIndex(cleanHeaders, fieldLabel);
            if (colIdx !== -1) { options = dataSheet.getRange(2, colIdx+1, lastRow-1, 1).getValues().flat().filter(function(v){ return v !== "" && v !== null && String(v).trim() !== "" && String(v).trim() !== "*"; }); }
          }
        }
      }
    }
  }
  if (options.length === 0) {
    var dataSheet = ss.getSheetByName("DropdownData");
    if (dataSheet && dataSheet.getLastRow() > 1) {
      var lastRow = dataSheet.getLastRow(), lastCol = dataSheet.getLastColumn();
      var headers = dataSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var cleanHeaders = headers.map(function(h){ return h ? String(h).trim() : ""; });
      var colIdx = findColumnIndex(cleanHeaders, fieldLabel);
      if (colIdx !== -1) { options = dataSheet.getRange(2, colIdx+1, lastRow-1, 1).getValues().flat().filter(function(v){ return v !== "" && v !== null && String(v).trim() !== "" && String(v).trim() !== "*"; }); }
    }
  }
  return options;
}

function exportAllComplaints() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TARGET_SHEET);
  if (!sheet) return { error: "Sheet not found" };
  var lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { headers: [], data: [], totalRecords: 0 };
  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headIdx = -1;
  var rawAllData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < rawHeaders.length; i++) {
    var h = String(rawHeaders[i]).trim().toLowerCase();
    if (h === "head" || h === "sr no" || h === "#" || h === "row") { var sample = rawAllData.slice(0, 3).map(function(r) { return r[i]; }); if (sample.every(function(v) { return v !== "" && !isNaN(v); })) { headIdx = i; break; } }
  }
  var cleanHeaders = [], keepIndices = [];
  for (var i = 0; i < rawHeaders.length; i++) {
    var ch = rawHeaders[i] ? String(rawHeaders[i]).trim() : "";
    if (i === headIdx || ch === "" || ch === "*" || ch.toLowerCase() === "head") continue;
    if (ch === "User ID" || ch === "Password") continue;
    cleanHeaders.push(ch); keepIndices.push(i);
  }
  var allData = [];
  for (var r = 0; r < rawAllData.length; r++) {
    var row = rawAllData[r], filteredRow = [], hasData = false;
    for (var c = 0; c < row.length; c++) {
      if (c === headIdx || keepIndices.indexOf(c) === -1) continue;
      var cellVal = row[c];
      if (cellVal !== "" && cellVal !== null && String(cellVal).trim() !== "" && String(cellVal).trim() !== "*") hasData = true;
      filteredRow.push(formatCell(cellVal));
    }
    if (hasData) allData.push(filteredRow);
  }
  return { headers: cleanHeaders, data: allData, totalRecords: allData.length };
}

// ═══════════════════════════════════════════════
// ✨ DYNAMIC ADD NEW DEALER
// ═══════════════════════════════════════════════
function getDealerFormStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return { error: "Dealers Contact sheet not found!" };
  
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { error: "No headers found in Dealers Contact sheet." };
  
  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var cleanHeaders = rawHeaders.map(function(h){return h ? String(h).trim() : "";});
  
  var srNoColIdx = findColumnIndex(cleanHeaders, "Sr No");
  if (srNoColIdx === -1) srNoColIdx = findColumnIndex(cleanHeaders, "Sr. No");
  if (srNoColIdx === -1) srNoColIdx = findColumnIndex(cleanHeaders, "Sr Number");
  if (srNoColIdx === -1) srNoColIdx = findColumnIndex(cleanHeaders, "Serial No");
  
  var nextSrNo = 1;
  if (srNoColIdx !== -1 && sheet.getLastRow() > 1) {
    var srData = sheet.getRange(2, srNoColIdx + 1, sheet.getLastRow() - 1, 1).getValues().flat();
    var nums = srData.filter(function(v){ return v !== "" && v !== null && !isNaN(v); }).map(Number);
    if (nums.length > 0) {
      nextSrNo = Math.max.apply(null, nums) + 1;
    }
  }
  
  var fields = [];
  rawHeaders.forEach(function(h, idx) {
    var cleanH = h ? String(h).trim() : "";
    if (cleanH === "" || cleanH === "*") return;
    
    var hl = cleanH.toLowerCase();
    var type = "text";
    var required = false;
    var defaultVal = "";
    var options = [];
    
    if (idx === srNoColIdx) {
      type = "srno";
      defaultVal = nextSrNo;
    } 
    else if (hl.indexOf("password") > -1) {
      type = "password";
    } 
    else if (hl.indexOf("mobile") > -1 || hl.indexOf("phone") > -1) {
      type = "tel";
    } 
    else if (hl.indexOf("email") > -1) {
      type = "email";
    }
    else if (hl === "dealer" || hl === "type" || hl === "category") {
      type = "radio";
      options = ["Dealer", "Partner"];
    }
    
    if (hl === "retail outlet name" || hl === "dealer" || hl === "type") {
      required = true;
    }
    
    // ✨ colIdx add kiya hai duplicate columns ko handle karne ke liye
    fields.push({ name: cleanH, label: cleanH, type: type, required: required, default: defaultVal, options: options, colIdx: idx });
  });
  
  return { fields: fields };
}

function addNewDealer(dealerData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return { success: false, message: "Dealers Contact sheet not found!" };
  
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return { success: false, message: "No headers found." };
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h ? String(h).trim() : ""; });
  var outletColIdx = findColumnIndex(headers, "Retail Outlet Name");
  
  if (outletColIdx === -1) return { success: false, message: "Retail Outlet Name column missing." };
  
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var outletNames = sheet.getRange(2, outletColIdx + 1, lastRow - 1, 1).getValues().flat();
    for (var i = 0; i < outletNames.length; i++) {
      if (String(outletNames[i]).trim() === String(dealerData[headers[outletColIdx] + "__" + outletColIdx]).trim()) {
        return { success: false, message: "Dealer already exists for this Retail Outlet!" };
      }
    }
  }
  
  var rowData = [];
  for (var c = 0; c < headers.length; c++) {
    var key = headers[c] + "__" + c;
    if (dealerData[key] !== undefined) {
      rowData.push(dealerData[key]);
    } else {
      rowData.push("");
    }
  }
  sheet.appendRow(rowData);
  
  return { success: true, message: "New Dealer added successfully!" };
}

// ═══════════════════════════════════════════════
// ✨ UPDATE DEALER INFO
// ═══════════════════════════════════════════════
function updateDealerInfo(dealerData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return { success: false, message: "Dealers Contact sheet not found!" };
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { success: false, message: "No dealers found to update." };
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){return h?String(h).trim():"";});
  var outletColIdx = findColumnIndex(headers, "Retail Outlet Name");
  
  if (outletColIdx === -1) return { success: false, message: "Retail Outlet Name column missing." };
  
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][outletColIdx]).trim() === String(dealerData[headers[outletColIdx] + "__" + outletColIdx]).trim()) {
      var rowNum = i + 2;
      var existingRow = data[i];
      
      var rowData = [];
      for (var c = 0; c < headers.length; c++) {
        var h = headers[c];
        var hl = h.toLowerCase();
        var key = h + "__" + c;
        var newVal = dealerData[key] !== undefined ? dealerData[key] : "";
        
        if (hl === "sr no" || hl === "sr. no" || hl === "ro code" || hl === "rocode" || hl === "ro no" || hl === "retail outlet name") {
          rowData.push(newVal !== "" ? newVal : existingRow[c]);
        } else {
          rowData.push(newVal);
        }
      }
      
      sheet.getRange(rowNum, 1, 1, lastCol).setValues([rowData]);
      return { success: true, message: "Dealer Info updated successfully!" };
    }
  }
  return { success: false, message: "Dealer not found for update." };
}

// ═══════════════════════════════════════════════
// ✨ DEALERS LIST DATA
// ═══════════════════════════════════════════════
function getDealersListData(pageNumber, rowsPerPage, searchTerm) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return { error: "Dealers Contact sheet not found" };
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = ["Sr No.", "RO Code", "Retail Outlet Name", "Dealer Name", "Dealer", "Mobile no."];
  
  if (lastRow < 2) return { headers: headers, data: [], totalRecords: 0, totalPages: 0, currentPage: 1, rowsPerPage: rowsPerPage };
  
  var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){return h?String(h).trim():"";});
  
  var idxSrNo = findColumnIndex(rawHeaders, "Sr No");
  var idxROCode = findColumnIndex(rawHeaders, "RO Code");
  var idxOutlet = findColumnIndex(rawHeaders, "Retail Outlet Name");
  var idxDealerName = findColumnIndex(rawHeaders, "Dealer Name");
  var idxDealerType = findColumnIndex(rawHeaders, "Dealer");
  var idxMobile = findColumnIndex(rawHeaders, "Mobile");
  
  var allData = [];
  var rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  var term = (searchTerm && String(searchTerm).trim() !== "") ? String(searchTerm).toLowerCase().trim() : "";
  
  rawData.forEach(function(row, i) {
    var rowNum = i + 2;
    var outletName = idxOutlet !== -1 ? String(row[idxOutlet] || "").trim() : "";
    if (outletName === "" || outletName === "*") return;
    
    var roCode = idxROCode !== -1 ? String(formatCell(row[idxROCode]) || "").trim() : "";
    var dealerName = idxDealerName !== -1 ? String(formatCell(row[idxDealerName]) || "").trim() : "";
    var mobile = idxMobile !== -1 ? String(formatCell(row[idxMobile]) || "").trim() : "";
    
    if (term !== "") {
      var matchOutlet = outletName.toLowerCase().indexOf(term) > -1;
      var matchROCode = roCode.toLowerCase().indexOf(term) > -1;
      var matchDealerName = dealerName.toLowerCase().indexOf(term) > -1;
      var matchMobile = mobile.toLowerCase().indexOf(term) > -1;
      if (!matchOutlet && !matchROCode && !matchDealerName && !matchMobile) return;
    }
    
    allData.push({
      rowNum: rowNum,
      rowData: [
        idxSrNo !== -1 ? formatCell(row[idxSrNo]) : "",
        roCode,
        outletName,
        dealerName,
        idxDealerType !== -1 ? formatCell(row[idxDealerType]) : "",
        mobile
      ]
    });
  });
  
  if (!rowsPerPage || rowsPerPage < 1 || rowsPerPage > 500) rowsPerPage = 10;
  var totalRecords = allData.length;
  var totalPages = Math.ceil(totalRecords / rowsPerPage);
  if (!pageNumber || pageNumber < 1) pageNumber = 1;
  if (totalPages > 0 && pageNumber > totalPages) pageNumber = totalPages;
  
  var startIndex = (pageNumber - 1) * rowsPerPage;
  var endIndex = Math.min(startIndex + rowsPerPage, totalRecords);
  var pageData = allData.slice(startIndex, endIndex);
  
  return { 
    headers: headers, 
    data: pageData, 
    totalRecords: totalRecords, 
    totalPages: totalPages, 
    currentPage: pageNumber, 
    rowsPerPage: rowsPerPage 
  };
}

function getDealerByRow(rowNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return {error:"Sheet not found"};
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getRange(rowNum, 1, 1, lastCol).getValues()[0];
  return { headers: headers, data: formatRow(data) };
}

function deleteDealerRow(rowNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return {success:false, message:"Sheet not found"};
  if (!rowNum || isNaN(rowNum)) return {success:false, message:"Invalid Row"};
  
  sheet.deleteRow(rowNum);
  return {success:true, message:"Dealer deleted successfully!"};
}

// ✨ NEW: Get All Outlets for Map Search
function getAllOutletsForMapSearch() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Dealers Contact");
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){return h ? String(h).trim().toLowerCase() : "";});
  
  var roIdx = headers.indexOf("ro code"); 
  if(roIdx === -1) roIdx = headers.indexOf("rocode");
  if(roIdx === -1) roIdx = headers.indexOf("ro no");
  
  var oIdx = headers.indexOf("retail outlet name");
  if(oIdx === -1) oIdx = headers.indexOf("outlet name");
  
  if(oIdx === -1) return [];
  
  var data = sheet.getRange(2, 1, lastRow-1, lastCol).getValues();
  var list = [];
  data.forEach(function(row){
    var name = String(row[oIdx]||"").trim();
    if(name && name !== "*") {
      var roCode = roIdx !== -1 ? String(row[roIdx]||"").trim() : "";
      list.push({ro: roCode, name: name});
    }
  });
  return list;
}
