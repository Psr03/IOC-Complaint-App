// ⬇️ Yahan apna NAYA Web App URL paste karein (jisme /exec ho)
const API_URL = "https://script.google.com/macros/s/AKfycby4KI5aRpxSaHfAH_55_BEyV21yNdtgRvxmfZd2o60xurNF_SzKtzG7u0UlvgE0yHkd/exec"; 

// ✨ API Wrapper Functions
function apiGet(action, params = {}) {
  let url = API_URL + "?action=" + action;
  for (let key in params) { if (params[key] !== undefined) url += "&" + key + "=" + encodeURIComponent(params[key]); }
  return fetch(url).then(res => res.json());
}
function apiPost(action, data = {}) {
  return fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: action, ...data }),
    // CORS fix: text/plain use kiya hai
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  }).then(res => res.json());
}

var globalFields=[],currentPage=1,currentEditRow=null,currentViewRowNum=null;
var currentViewHeaders=[],dashboardData={},rowDataMap={},isDarkMode=false;
var trendCI=null,statusCI=null,allOutletsForMap=[];
var currentRowsPerPage=10;
var isEditingDealer = false;
var currentDealerViewRow = null;

 $(document).ready(function(){
  loadFormConfig(); loadDashboard(); loadListData(1);
  $('#mainForm').on('submit',function(e){e.preventDefault();submitForm();});
  $('#dealerForm').on('submit',function(e){e.preventDefault();submitDealerForm();});
  apiGet('getAllOutletsForMapSearch').then(function(list){ allOutletsForMap = list || []; });
});

function toggleSidebar(){ $('#sidebar').toggleClass('show'); $('#overlay').toggleClass('show'); }
function toggleSubMenu(el) {
  $(el).next('.sidebar-submenu').toggleClass('show');
  $(el).find('.bi-chevron-down').toggleClass('bi-chevron-up');
}
function switchSection(id, title, el){
  $('.section-panel').removeClass('active');
  $('#section'+id.charAt(0).toUpperCase()+id.slice(1)).addClass('active');
  $('.sidebar-link').removeClass('active');
  if(el) $(el).addClass('active');
  $('#pageTitle').text(title);
  if(window.innerWidth <= 992) { $('#sidebar').removeClass('show'); $('#overlay').removeClass('show'); }
  if(id==='dashboard') loadDashboard();
  if(id==='list') loadListData(currentPage);
  if(id==='dealerForm' && !isEditingDealer) loadDealerForm(); 
  if(id==='dealers') loadDealersData(); 
}

function toggleDarkMode(){isDarkMode=!isDarkMode;document.documentElement.setAttribute('data-theme',isDarkMode?'dark':'light');$('#darkModeBtn').html(isDarkMode?'<i class="bi bi-sun-fill"></i>':'<i class="bi bi-moon-stars-fill"></i>');showToast(isDarkMode?'Dark mode ON':'Light mode ON','info');if(dashboardData.trend)renderCharts(dashboardData);}
function showToast(m,t){t=t||'info';var ic={success:'<i class="bi bi-check-circle-fill text-success"></i>',error:'<i class="bi bi-exclamation-circle-fill text-danger"></i>',info:'<i class="bi bi-info-circle-fill text-info"></i>'};var e=$('<div class="ioc-toast '+t+'"><span class="toast-icon">'+ic[t]+'</span><span class="toast-msg">'+m+'</span></div>');$('#toastContainer').append(e);setTimeout(function(){e.fadeOut(300,function(){$(this).remove();});},3500);}
function refreshAllData(){showToast('Refreshing...','info');loadDashboard();loadListData(currentPage);}
function fHI(headers,target){if(!target)return-1;var t=String(target).trim(),tl=t.toLowerCase();for(var i=0;i<headers.length;i++)if(String(headers[i]).trim()===t)return i;for(var i=0;i<headers.length;i++)if(String(headers[i]).trim().toLowerCase()===tl)return i;for(var i=0;i<headers.length;i++){var h=String(headers[i]).trim().toLowerCase();if(h.indexOf(tl)>-1||tl.indexOf(h)>-1)return i;}return-1;}
function dt2inp(s){if(!s)return'';s=String(s).trim();if(s.match(/^\d{4}-\d{2}-\d{2}$/))return s;if(s.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)){var p=s.split('/');return p[2]+'-'+(p[1].length<2?'0'+p[1]:p[1])+'-'+(p[0].length<2?'0'+p[0]:p[0]);}try{var d=new Date(s);if(d&&!isNaN(d))return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}catch(e){}return s;}
function getTodayDate(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function togglePwd(id,b){var i=document.getElementById(id),ic=$(b).find('i');if(i.type==='password'){i.type='text';ic.removeClass('bi-eye').addClass('bi-eye-slash');}else{i.type='password';ic.removeClass('bi-eye-slash').addClass('bi-eye');}}
function getGrpIcon(g){return{'Outlet Info':'bi-shop','Login Info':'bi-key-fill','Complaint Info':'bi-chat-left-text-fill','General':'bi-calendar3','Notice':'bi-bell','Other Info':'bi-three-dots'}[g]||'bi-three-dots';}
function getSC(s){var l=String(s).toLowerCase().trim();if(l==='open')return'open';if(l==='in progress')return'in-progress';if(l==='resolved')return'resolved';if(l==='closed')return'closed';return'default';}
function getSCol(s){var l=String(s).toLowerCase().trim();if(l==='open')return'#dc3545';if(l==='in progress')return'#ffc107';if(l==='resolved')return'#28a745';if(l==='closed')return'#6c757d';return'#003399';}

function loadFormConfig(){
  apiGet('getFormStructure').then(function(fields){
    if(fields.error){showToast(fields.error,'error');return;}
    globalFields=fields;
    renderForm(fields);
  }).catch(function(err){
    showToast('Form error: '+err.message,'error');
  });
}

function renderForm(fields){
  var c=$('#formFieldsContainer');c.empty();
  var groups={},go=[];
  fields.forEach(function(f){var g=f.group||'Other Info';if(!groups[g]){groups[g]=[];go.push(g);}groups[g].push(f);});
  go.forEach(function(grp){
    var h='<div class="form-section"><div class="section-title"><i class="bi '+getGrpIcon(grp)+'"></i> '+grp+'</div>';
    groups[grp].forEach(function(f){
      if(f.type==='hidden')return;
      if(f.type==='msgbox'){h+='<div class="alert alert-info" style="border-radius:10px"><i class="bi bi-info-circle"></i> '+f.message+'</div>';return;}
      var req=f.required?'required':'',star=f.required?'<span class="text-danger">*</span>':'';
      var sid=f.name.replace(/[^a-zA-Z0-9]/g,'_'),dv=f.default||'';
      if(f.type==='date'&&(dv==='TODAY()'||dv==='today'))dv=getTodayDate();
      if(dv==='*')dv='';
      h+='<div class="mb-3"><label class="form-label fw-semibold">'+f.label+' '+star+'</label>';
      if(f.type==='autofill'){
        if(f.label.toLowerCase().indexOf('password')>-1){
          h+='<div class="input-group"><input type="password" class="form-control" id="inp_'+sid+'" name="'+f.name+'" '+req+'><button class="btn btn-outline-secondary" type="button" onclick="togglePwd(\'inp_'+sid+'\',this)"><i class="bi bi-eye"></i></button></div>';
        } else {
          h+='<input type="text" class="form-control readonly-field" id="inp_'+sid+'" name="'+f.name+'" readonly '+req+'>';
        }
      }
      else if(f.type==='srno'){h+='<input type="text" class="form-control readonly-field" id="inp_'+sid+'" name="'+f.name+'" value="'+dv+'" readonly>';}
      else if(f.type==='date'){h+='<input type="date" class="form-control" id="inp_'+sid+'" name="'+f.name+'" value="'+dv+'" '+req+'>';}
      else if(f.type==='password'){h+='<div class="input-group"><input type="password" class="form-control" id="inp_'+sid+'" name="'+f.name+'" '+req+'><button class="btn btn-outline-secondary" type="button" onclick="togglePwd(\'inp_'+sid+'\',this)"><i class="bi bi-eye"></i></button></div>';}
      else if(f.type==='dependent'){h+='<select class="form-select" id="inp_'+sid+'" name="'+f.name+'" disabled '+req+'><option value="">Select '+f.parent+' first</option></select>';}
      else if(f.type==='select'){h+='<select class="form-select" id="inp_'+sid+'" name="'+f.name+'" '+req+'><option value="">Select</option>';f.options.forEach(function(o){h+='<option value="'+o+'">'+o+'</option>';});h+='</select>';}
      else if(f.type==='textarea'){h+='<textarea class="form-control" id="inp_'+sid+'" name="'+f.name+'" rows="3" '+req+'>'+dv+'</textarea>';}
      else if(f.type==='radio'){ 
        h+='<div class="d-flex gap-4 mt-2">';
        f.options.forEach(function(opt, idx){
          var rid='inp_'+sid+'_'+idx;
          var checked=(idx===0)?'checked':'';
          h+='<div class="form-check"><input class="form-check-input" type="radio" id="'+rid+'" name="'+f.name+'" value="'+opt+'" '+checked+' '+req+'><label class="form-check-label" for="'+rid+'">'+opt+'</label></div>';
        });
        h+='</div>';
      }
      else{h+='<input type="text" class="form-control" id="inp_'+sid+'" name="'+f.name+'" value="'+dv+'" '+req+'>';}
      h+='</div>';
    });
    h+='</div>';c.append(h);
  });
  fields.forEach(function(f){var sid=f.name.replace(/[^a-zA-Z0-9]/g,'_');if(f.type==='autofill')setupAF(f,sid);if(f.type==='dependent')setupDP(f,sid);});
}

function setupAF(f,sid){var pid=f.parent.replace(/[^a-zA-Z0-9]/g,'_'),inp=$('#inp_'+sid),map=f.mapping||{};$(document).on('change','#inp_'+pid,function(){var sel=$(this).val();inp.val('');if(sel&&map[sel]){inp.val(map[sel][0]);}});}
function setupDP(f,sid){var pid=f.parent.replace(/[^a-zA-Z0-9]/g,'_'),sel=$('#inp_'+sid),map=f.mapping||{};$(document).on('change','#inp_'+pid,function(){var pv=$(this).val();sel.empty().append('<option value="">Select</option>');if(pv&&map[pv]){sel.prop('disabled',false);map[pv].forEach(function(o){sel.append('<option value="'+o+'">'+o+'</option>');});}else{sel.prop('disabled',true);}});}

function submitForm(){
  var fd={},hasErr=false;
  globalFields.forEach(function(f){
    if(f.type==='hidden'||f.type==='msgbox')return;
    var sid=f.name.replace(/[^a-zA-Z0-9]/g,'_');
    if(f.type==='radio'){
      var checked=$('input[name="'+f.name+'"]:checked').val();
      if(f.required&&!checked){hasErr=true;}
      fd[f.name]=checked||'';
      return;
    }
    var el=$('#inp_'+sid),val=(el.val()||'').trim();
    if(f.required&&!val){el.addClass('is-invalid');hasErr=true;return;}
    el.removeClass('is-invalid');fd[f.name]=val;
  });
  if(hasErr){showToast('Please fill all required fields!','error');return;}
  var btn=$('#submitBtn');
  btn.prop('disabled',true).html('<span class="spinner-border spinner-border-sm"></span> Saving...'); 
  apiPost('saveData', {formData: fd, editRowNumber: currentEditRow}).then(function(r){
    btn.prop('disabled',false).html('<i class="bi bi-check-circle"></i> Submit');
    if(r.success){
      showToast(r.message,'success');
      currentEditRow = null;
      $('#editBadge').hide();
      $('#formTitle').text('Submit New Complaint');
      var complaintLink = Array.from(document.querySelectorAll('.sidebar-link')).find(el => el.textContent.includes('Complaints'));
      if(complaintLink) complaintLink.click();
      loadDashboard(); 
      loadListData(1);
    } else { showToast(r.message,'error'); }
  }).catch(function(err){
    btn.prop('disabled',false).html('<i class="bi bi-check-circle"></i> Submit');
    showToast('Error: '+err.message,'error');
  });
}

function resetForm(){currentEditRow=null;$('#editBadge').hide();$('#formTitle').text('Submit New Complaint');globalFields.forEach(function(f){if(f.type==='hidden'||f.type==='msgbox')return;var sid=f.name.replace(/[^a-zA-Z0-9]/g,'_'),dv=f.default||'';if(dv==='*')dv='';if(f.type==='date'&&(dv==='TODAY()'||dv==='today'))dv=getTodayDate();if(f.type==='select'||f.type==='dependent'){$('#inp_'+sid).val('');}else if(f.type==='radio'){$('input[name="'+f.name+'"]').prop('checked',false);if(f.options&&f.options.length>0)$('input[name="'+f.name+'"][value="'+f.options[0]+'"]').prop('checked',true);}else{$('#inp_'+sid).val(dv);}$('#inp_'+sid).removeClass('is-invalid');});}

function editRow(rowNum){
  var item=rowDataMap[rowNum];if(!item){showToast('Data not found','warning');return;}
  currentEditRow=rowNum;$('#editBadge').show().find('span').text(rowNum);$('#formTitle').text('Edit Complaint (Row '+rowNum+')');
  var headers=currentViewHeaders,row=item.rowData;
  globalFields.forEach(function(f){
    var sid=f.name.replace(/[^a-zA-Z0-9]/g,'_');
    var hi=fHI(headers,f.name),val=(hi>-1)?(row[hi]||''):'';
    if(f.type==='radio'){
      $('input[name="'+f.name+'"]').prop('checked',false);
      $('input[name="'+f.name+'"][value="'+val+'"]').prop('checked',true);
    } else {
      var el=$('#inp_'+sid);if(!el.length)return;
      if(f.type==='date')el.val(dt2inp(val));else el.val(val);
    }
  });
  $('.sidebar-link[onclick*="form"]').click();
}

function deleteRow(rn){if(confirm('Delete this complaint?')){apiPost('deleteComplaint', {rowNumber: rn}).then(function(r){if(r.success){showToast(r.message,'success');loadDashboard();loadListData(currentPage);}else showToast(r.message,'error');}).catch(function(e){showToast('Error: '+e.message,'error');});}}

function loadDashboard(){apiGet('getDashboardData').then(function(d){if(d.error){showToast(d.error,'error');return;}dashboardData=d;renderStats(d);$('#dashLastUpdated').text('Last updated: '+d.lastUpdated);}).catch(function(e){showToast(e.message,'error');});}
function renderStats(d){animateCount('statTotal',d.total||0);animateCount('statToday',d.today||0);animateCount('statActive',d.activeComplaints||0);animateCount('statOutlets',d.uniqueOutlets||0);$('#statWeekInfo').text('7 days: '+d.week);var ch=d.todayChange||0;if(ch>0)$('#statTodayChange').html('<i class="bi bi-arrow-up"></i> '+ch+'%').css('color','#28a745');else if(ch<0)$('#statTodayChange').html('<i class="bi bi-arrow-down"></i> '+ch+'%').css('color','#dc3545');else $('#statTodayChange').html('<i class="bi bi-dash"></i> 0%').css('color','#6c757d');$('#statResolvedInfo').text('Resolved: '+d.resolvedComplaints);}
function animateCount(id,t){var e=document.getElementById(id),s=parseInt(e.textContent)||0,d=500,st=null;function step(ts){if(!st)st=ts;var p=Math.min((ts-st)/d,1);e.textContent=Math.floor(s+(t-s)*p);if(p<1)requestAnimationFrame(step);else e.textContent=t;}requestAnimationFrame(step);}

function searchOutletOnMap() {
  var query = $('#mapSearchInput').val().trim();
  if(!query) { showToast('Please enter RO Name or RO Code', 'warning'); return; }
  var finalQuery = query;
  var matched = allOutletsForMap.find(function(item) { return item.ro.toLowerCase() === query.toLowerCase(); });
  if(matched) { finalQuery = matched.name; }
  var mapSrc = "https://maps.google.com/maps?q=" + encodeURIComponent(finalQuery) + "&output=embed";
  $('#outletMap').attr('src', mapSrc);
  showToast('Showing map for: ' + finalQuery, 'info');
}

function loadListData(page){
  currentPage=page||1;
  var search=$('#searchInput').val()||'',status=$('#statusFilter').val()||'All';
  $('#tableBody').html('<tr><td colspan="10" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>');
  apiPost('loadComplaints', {pageNumber: currentPage, searchTerm: search, statusFilter: status, rowsPerPage: currentRowsPerPage}).then(function(r){
    if(r.error){showToast(r.error,'error');return;}
    currentViewHeaders=r.headers||[];
    var sf=$('#statusFilter');sf.empty().append('<option value="All">All Status</option>');
    (r.statusOptions||[]).forEach(function(s){sf.append('<option value="'+s+'"'+(status===s?' selected':'')+'>'+s+'</option>');});
    $('#recordCountBadge').text(r.totalRecords||0);
    var th=$('#tableHeaders');th.empty();currentViewHeaders.forEach(function(h){th.append('<th>'+h+'</th>');});th.append('<th>Actions</th>');
    var tb=$('#tableBody');tb.empty();
    if(!r.data||r.data.length===0){tb.html('<tr><td colspan="'+(currentViewHeaders.length+1)+'" class="text-center text-muted py-4">No complaints found</td></tr>');return;}
    r.data.forEach(function(item){
      rowDataMap[item.rowNum]=item;
      var tr='<tr>';
      currentViewHeaders.forEach(function(h,idx){var v=item.rowData[idx]||'';if(h==='Status'&&v)tr+='<td><span class="status-badge '+getSC(v)+'">'+v+'</span></td>';else tr+='<td>'+v+'</td>';});
      tr+='<td><div class="action-btns"><button class="btn btn-view" onclick="viewRow('+item.rowNum+')" title="View"><i class="bi bi-eye"></i></button><button class="btn btn-edit" onclick="editRow('+item.rowNum+')" title="Edit"><i class="bi bi-pencil"></i></button><button class="btn btn-del" onclick="deleteRow('+item.rowNum+')" title="Delete"><i class="bi bi-trash"></i></button></div></td></tr>';
      tb.append(tr);
    });
    renderPagination(r.totalPages,r.currentPage,r.totalRecords);
  }).catch(function(e){showToast('Load error: '+e.message,'error');});
}

function renderPagination(tp,cp,tr){
  var pc=$('#paginationControls');pc.empty();
  if(tp<=0)return;
  pc.append('<button class="page-btn" '+(cp<=1?'disabled':'')+' onclick="loadListData('+(cp-1)+')">‹</button>');
  for(var i=1;i<=tp;i++){
    if(i===1||i===tp||(i>=cp-2&&i<=cp+2)){
      pc.append('<button class="page-btn '+(i===cp?'active-page':'')+'" onclick="loadListData('+i+')">'+i+'</button>');
    } else if(i===cp-3||i===cp+3) {
      pc.append('<button class="page-btn disabled">...</button>');
    }
  }
  pc.append('<button class="page-btn" '+(cp>=tp?'disabled':'')+' onclick="loadListData('+(cp+1)+')">›</button>');
  pc.append('<div class="d-flex align-items-center gap-2 ms-3" style="border-left:2px solid var(--ioc-border);padding-left:12px"><span style="font-size:.78rem;color:var(--ioc-muted);white-space:nowrap">Rows:</span><input type="number" id="rowsPerPageInput" class="form-control form-control-sm" style="width:55px;text-align:center;border-radius:8px;padding:4px 6px;font-size:.82rem" min="1" max="200" value="'+currentRowsPerPage+'" placeholder="'+currentRowsPerPage+'"></div>');
  $('#rowsPerPageInput').off('keydown change').on('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); applyRowsPerPage(); }
  }).on('change', function() { applyRowsPerPage(); });
  $('#pageInfo').text('Page '+cp+' of '+tp+' ('+tr+' records)');
}

function applyRowsPerPage() {
  var input = $('#rowsPerPageInput'); var val = parseInt(input.val());
  if (!val || isNaN(val) || val < 1) { showToast('Min 1 row per page!', 'warning'); input.val(1); val = 1; } 
  else if (val > 200) { showToast('Max 200 rows per page!', 'warning'); input.val(200); val = 200; }
  currentRowsPerPage = val; currentPage = 1;
  showToast('Showing ' + val + ' rows per page', 'info'); loadListData(1);
}

var currentDealerPage = 1; var currentDealerRowsPerPage = 10; var dealerSearchTerm = ""; var dealerSearchTimer = null;

function onDealerSearch(val) {
  dealerSearchTerm = val || ""; clearTimeout(dealerSearchTimer);
  dealerSearchTimer = setTimeout(function() { currentDealerPage = 1; loadDealersData(1); }, 350);
}
function clearDealerSearch() { $('#dealerSearchInput').val(''); dealerSearchTerm = ""; currentDealerPage = 1; loadDealersData(1); }
function openAddDealerForm() {
  isEditingDealer = false; switchSection('dealerForm', 'Add New Dealer', $('.sidebar-link[onclick*="dealerForm"]')[0]);
  $('#dealerFormTitle').text('Add New Dealer'); $('#dealerSubmitBtn').html('<i class="bi bi-check-circle"></i> Save Dealer'); loadDealerForm();
}

function loadDealersData(page) {
  currentDealerPage = page || 1;
  $('#dealerTableBody').html('<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>');
  apiPost('getDealersListData', {pageNumber: currentDealerPage, rowsPerPage: currentDealerRowsPerPage, searchTerm: dealerSearchTerm}).then(function(r) {
    if (r.error) { showToast(r.error, 'error'); return; }
    $('#dealerCountBadge').text(r.totalRecords); currentDealerRowsPerPage = r.rowsPerPage;
    var th = $('#dealerTableHeaders'); th.empty(); r.headers.forEach(function(h) { th.append('<th>'+h+'</th>'); }); th.append('<th>Action</th>');
    var tb = $('#dealerTableBody'); tb.empty();
    if (!r.data || r.data.length === 0) {
      var msg = dealerSearchTerm ? 'No dealers match your search' : 'No dealers found';
      tb.html('<tr><td colspan="7" class="text-center text-muted py-4">'+msg+'</td></tr>'); $('#dealerPaginationControls').empty(); $('#dealerPageInfo').text(''); return;
    }
    r.data.forEach(function(item) {
      var tr = '<tr>'; item.rowData.forEach(function(val) { tr += '<td>'+val+'</td>'; });
      tr += '<td><div class="action-btns"><button class="btn btn-view" onclick="viewDealer('+item.rowNum+')" title="View"><i class="bi bi-eye"></i></button><button class="btn btn-edit" onclick="editDealerDirect('+item.rowNum+')" title="Edit"><i class="bi bi-pencil"></i></button><button class="btn btn-del" onclick="deleteDealerRow('+item.rowNum+')" title="Delete"><i class="bi bi-trash"></i></button></div></td></tr>';
      tb.append(tr);
    });
    renderDealerPagination(r.totalPages, r.currentPage, r.totalRecords);
  }).catch(function(e) { showToast('Load error: '+e.message, 'error'); });
}

function renderDealerPagination(tp, cp, tr) {
  var pc = $('#dealerPaginationControls'); pc.empty(); if (tp <= 0) return;
  pc.append('<button class="page-btn" '+(cp<=1?'disabled':'')+' onclick="loadDealersData('+(cp-1)+')">‹</button>');
  for (var i = 1; i <= tp; i++) {
    if (i === 1 || i === tp || (i >= cp - 2 && i <= cp + 2)) { pc.append('<button class="page-btn '+(i===cp?'active-page':'')+'" onclick="loadDealersData('+i+')">'+i+'</button>'); } 
    else if (i === cp - 3 || i === cp + 3) { pc.append('<button class="page-btn disabled">...</button>'); }
  }
  pc.append('<button class="page-btn" '+(cp>=tp?'disabled':'')+' onclick="loadDealersData('+(cp+1)+')">›</button>');
  pc.append('<div class="d-flex align-items-center gap-2 ms-3 dealer-rows-box"><span style="font-size:.78rem;color:var(--ioc-muted);white-space:nowrap">Rows:</span><input type="number" id="dealerRowsPerPageInput" class="form-control form-control-sm" style="width:55px;text-align:center;border-radius:8px;padding:4px 6px;font-size:.82rem" min="1" max="500" value="'+currentDealerRowsPerPage+'" placeholder="'+currentDealerRowsPerPage+'"></div>');
  $('#dealerRowsPerPageInput').off('keydown change').on('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); applyDealerRowsPerPage(); } }).on('change', function() { applyDealerRowsPerPage(); });
  $('#dealerPageInfo').text('Page ' + cp + ' of ' + tp + ' (' + tr + ' records)');
}

function applyDealerRowsPerPage() {
  var input = $('#dealerRowsPerPageInput'); var val = parseInt(input.val());
  if (!val || isNaN(val) || val < 1) { showToast('Min 1 row per page!', 'warning'); input.val(1); val = 1; }
  else if (val > 500) { showToast('Max 500 rows per page!', 'warning'); input.val(500); val = 500; }
  currentDealerRowsPerPage = val; currentDealerPage = 1; showToast('Showing ' + val + ' rows per page', 'info'); loadDealersData(1);
}

function viewDealer(rowNum) {
  currentDealerViewRow = rowNum; $('#dealerModalBody').html('<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>');
  var modalEl = document.getElementById('dealerViewModal');
  var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl); modal.show();
  apiGet('getDealerByRow', {rowNum: rowNum}).then(function(res) {
    if (res.error) { $('#dealerModalBody').html('<div class="alert alert-danger">'+res.error+'</div>'); return; }
    var html = '<div style="border-radius:12px;border:1px solid var(--ioc-border);overflow:hidden">';
    res.headers.forEach(function(h, idx) {
      var val = res.data[idx] || ''; if (val === "" || val === "*") return;
      html += '<div style="display:flex;padding:8px 14px;border-bottom:1px solid var(--ioc-border)"><div style="width:40%;font-weight:600;color:var(--ioc-blue);font-size:.82rem">'+String(h).trim()+'</div><div style="width:60%;color:var(--ioc-text);font-size:.82rem">'+val+'</div></div>';
    });
    html += '</div>'; $('#dealerModalBody').html(html);
  }).catch(function(e) { $('#dealerModalBody').html('<div class="alert alert-danger">Error: '+e.message+'</div>'); });
}

function editDealerDirect(rowNum) {
  currentDealerViewRow = rowNum; switchSection('dealerForm', 'Edit Dealer Info', $('.sidebar-link[onclick*="dealerForm"]')[0]); isEditingDealer = true;
  $('#dealerFormFields').html('<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Loading dealer data...</p></div>');
  apiGet('getDealerByRow', {rowNum: rowNum}).then(function(res) {
    if (res.error) { $('#dealerFormFields').html('<div class="alert alert-danger">'+res.error+'</div>'); return; }
    var outletName = ""; var oIdx = fHI(res.headers, "Retail Outlet Name"); if (oIdx > -1) outletName = res.data[oIdx] || "";
    $('#dealerFormTitle').text('Edit Dealer Info: ' + outletName); $('#dealerSubmitBtn').html('<i class="bi bi-check-circle"></i> Update Dealer');
    apiGet('getDealerFormStructure').then(function(formRes) {
      if (formRes.error) { $('#dealerFormFields').html('<div class="alert alert-danger">'+formRes.error+'</div>'); return; }
      var html = '';
      formRes.fields.forEach(function(f) {
        var sid = 'c_' + f.colIdx; var req = f.required ? 'required' : ''; var star = f.required ? '<span class="text-danger">*</span>' : '';
        var fieldLower = f.name.toLowerCase(); var isLocked = (f.type === 'srno' || fieldLower === 'retail outlet name' || fieldLower === 'ro code' || fieldLower === 'rocode' || fieldLower === 'ro no');
        var readonlyAttr = isLocked ? 'readonly' : ''; var readonlyClass = isLocked ? 'readonly-field' : '';
        html += '<div class="mb-3"><label class="form-label fw-semibold">' + f.label + ' ' + star + '</label>';
        if (f.type === 'srno') { html += '<input type="text" class="form-control readonly-field" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" value="' + f.default + '" readonly>'; } 
        else if (f.type === 'radio') {
          html += '<div class="d-flex gap-4 mt-2">'; f.options.forEach(function(opt, idx) {
            var rid = 'dinp_' + sid + '_' + idx; html += '<div class="form-check"><input class="form-check-input" type="radio" id="' + rid + '" name="' + f.name + '__' + f.colIdx + '" value="' + opt + '" ' + req + '><label class="form-check-label" for="' + rid + '">' + opt + '</label></div>';
          }); html += '</div>';
        } else if (f.type === 'password') { html += '<div class="input-group"><input type="password" class="form-control ' + readonlyClass + '" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + ' ' + readonlyAttr + '><button class="btn btn-outline-secondary" type="button" onclick="togglePwd(\'dinp_' + sid + '\', this)"><i class="bi bi-eye"></i></button></div>'; } 
        else if (f.type === 'date') { html += '<input type="date" class="form-control ' + readonlyClass + '" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + ' ' + readonlyAttr + '>'; } 
        else { html += '<input type="text" class="form-control ' + readonlyClass + '" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + ' ' + readonlyAttr + '>'; }
        html += '</div>';
      });
      $('#dealerFormFields').html(html);
      
      formRes.fields.forEach(function(f) {
        var sid = 'c_' + f.colIdx;
        var val = (res.data[f.colIdx] !== undefined && res.data[f.colIdx] !== null) ? res.data[f.colIdx] : ''; 
        var el = $('#dinp_' + sid);
        if (el.length) {
          if (el.attr('type') === 'date' && val) { el.val(dt2inp(val)); } 
          else { el.val(val); }
        } 
        else { 
          var radioEl = $('input[name="' + f.name + '__' + f.colIdx + '"][value="' + val + '"]'); 
          if (radioEl.length) { radioEl.prop('checked', true); } 
        }
      });
    }).catch(function(e) { $('#dealerFormFields').html('<div class="alert alert-danger">Error: '+e.message+'</div>'); });
  }).catch(function(e) { $('#dealerFormFields').html('<div class="alert alert-danger">Error: '+e.message+'</div>'); });
}

function editDealerRowFromModal() {
  if (!currentDealerViewRow) return;
  var dealerModal = bootstrap.Modal.getInstance(document.getElementById('dealerViewModal')); if (dealerModal) dealerModal.hide();
  editDealerDirect(currentDealerViewRow);
}

function deleteDealerRow(rowNum) {
  if (confirm('Are you sure you want to delete this Dealer?')) {
    apiPost('deleteDealerRow', {rowNum: rowNum}).then(function(r) {
      if (r.success) { showToast(r.message, 'success'); loadDealersData(currentDealerPage); } else { showToast(r.message, 'error'); }
    }).catch(function(e) { showToast('Error: '+e.message, 'error'); });
  }
}

function viewRow(rowNum){
  var item=rowDataMap[rowNum]; if(!item){showToast('Data not found','warning');return;}
  currentViewRowNum=rowNum; var headers=currentViewHeaders,row=item.rowData;
  var mb=$('#modalBody'); mb.empty();
  headers.forEach(function(h,idx){
    var v=row[idx]||''; if(h==='User ID'||h==='Password')return;
    var valHtml = (h==='Status' && v) ? '<span class="status-badge '+getSC(v)+'">'+v+'</span>' : v;
    mb.append('<div style="display:flex;padding:8px 14px;border-bottom:1px solid var(--ioc-border)"><div style="width:40%;font-weight:600;color:var(--ioc-blue);font-size:.82rem">'+h+'</div><div style="width:60%;color:var(--ioc-text);font-size:.82rem">'+valHtml+'</div></div>');
  });
  var sIdx=fHI(headers,'Status'),sVal=(sIdx>-1)?(row[sIdx]||''):'';
  $('#modalStatusBadge').attr('class','status-badge '+getSC(sVal)).text(sVal||'No Status');
  var sus=$('#statusUpdateSelect'); sus.empty().append('<option value="">Change Status</option>');
  (dashboardData.statusOptions||['Open','In Progress','Resolved','Closed']).forEach(function(s){sus.append('<option value="'+s+'">'+s+'</option>');});
  var outletName='',complentDetail='';
  var oIdx=fHI(headers,'Retail Outlet Name'),dIdx=fHI(headers,'DU Complent Detail');
  if(oIdx>-1)outletName=row[oIdx]||''; if(dIdx>-1)complentDetail=row[dIdx]||'';
  var waMsg='IOC Complaint Update:\nOutlet: '+outletName+'\n';
  if(complentDetail)waMsg+='Detail: '+complentDetail+'\n'; if(sVal)waMsg+='Status: '+sVal;
  $('#whatsappMsg').val(waMsg);
  if(outletName){
    $('#modalDealerBody').html('<div class="text-center py-3 text-muted"><div class="spinner-border spinner-border-sm"></div> Loading...</div>');
    apiGet('getDealerDetails', {outletName: outletName}).then(function(dd){
      if(dd.error){$('#modalDealerBody').html('<div class="text-center py-3 text-muted">'+dd.error+'</div>');return;}
      var db=$('#modalDealerBody'); db.empty();
      dd.headers.forEach(function(h,idx){
        var v=dd.data[idx]||'';
        db.append('<div style="display:flex;padding:8px 14px;border-bottom:1px solid var(--ioc-border)"><div style="width:40%;font-weight:600;color:var(--ioc-blue);font-size:.82rem">'+String(h).trim()+'</div><div style="width:60%;color:var(--ioc-text);font-size:.82rem">'+v+'</div></div>');
      });
      var phoneIdx=fHI(dd.headers.map(function(h){return h?String(h).trim():'';}),'Mobile');
      if(phoneIdx>-1&&dd.data[phoneIdx]){var mob=String(dd.data[phoneIdx]).replace(/\D/g,'');if(mob.length>=10)$('#whatsappMobile').val(mob.slice(-10));}
      checkWABtn();
    }).catch(function(e){$('#modalDealerBody').html('<div class="text-center text-danger">Error: '+e.message+'</div>');});
  }else{$('#modalDealerBody').html('<div class="text-center py-3 text-muted">No outlet name found</div>');}
  var modalEl = document.getElementById('viewModal');
  var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.show();
}

function checkWABtn(){var mob=$('#whatsappMobile').val()||'',clean=mob.replace(/\D/g,'');$('#btnSendWhatsApp').prop('disabled',clean.length!==10);}
function sendWhatsApp(){var mob=$('#whatsappMobile').val().replace(/\D/g,''),msg=$('#whatsappMsg').val()||'';if(mob.length!==10){showToast('Enter valid 10-digit number','warning');return;}window.open('https://wa.me/91'+mob+'?text='+encodeURIComponent(msg),'_blank');showToast('WhatsApp opened!','success');}
function updateStatusFromModal(){var newStatus=$('#statusUpdateSelect').val();if(!newStatus||!currentViewRowNum){showToast('Select a status first','warning');return;}apiPost('updateComplaintStatus', {rowNumber: currentViewRowNum, newStatus: newStatus}).then(function(r){if(r.success){showToast(r.message,'success');closeModal();loadDashboard();loadListData(currentPage);}else showToast(r.message,'error');}).catch(function(e){showToast('Error: '+e.message,'error');});}
function editFromModal(){if(currentViewRowNum){closeModal();editRow(currentViewRowNum);}}
function editComplaintFromModal() { if(currentViewRowNum) { closeModal(); editRow(currentViewRowNum); } }

function editDealerFromModal() {
  if(!currentViewRowNum) return; var item = rowDataMap[currentViewRowNum]; if(!item) return;
  var oIdx = fHI(currentViewHeaders, 'Retail Outlet Name');
  if(oIdx === -1) { showToast('Outlet Name not found in data', 'error'); return; }
  var outletName = item.rowData[oIdx]; closeModal();
  switchSection('dealerForm', 'Edit Dealer Info', $('.sidebar-link[onclick*="dealerForm"]')[0]);
  isEditingDealer = true; $('#dealerFormTitle').text('Edit Dealer Info: ' + outletName); $('#dealerSubmitBtn').html('<i class="bi bi-check-circle"></i> Update Dealer');
  $('#dealerFormFields').html('<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Loading dealer data...</p></div>');
  apiGet('getDealerDetails', {outletName: outletName}).then(function(res) {
    if(res.error) { $('#dealerFormFields').html('<div class="alert alert-danger">'+res.error+'</div>'); return; }
    apiGet('getDealerFormStructure').then(function(formRes) {
      if(formRes.error) { $('#dealerFormFields').html('<div class="alert alert-danger">'+formRes.error+'</div>'); return; }
      var html = '';
      formRes.fields.forEach(function(f) {
        var sid = 'c_' + f.colIdx; var req = f.required ? 'required' : ''; var star = f.required ? '<span class="text-danger">*</span>' : '';
        var fieldLower = f.name.toLowerCase(); var isLocked = (f.type === 'srno' || fieldLower === 'retail outlet name' || fieldLower === 'ro code' || fieldLower === 'rocode' || fieldLower === 'ro no');
        var readonlyAttr = isLocked ? 'readonly' : ''; var readonlyClass = isLocked ? 'readonly-field' : '';
        html += '<div class="mb-3"><label class="form-label fw-semibold">' + f.label + ' ' + star + '</label>';
        if (f.type === 'srno') { html += '<input type="text" class="form-control readonly-field" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" value="' + f.default + '" readonly>'; } 
        else if (f.type === 'radio') {
          html += '<div class="d-flex gap-4 mt-2">'; f.options.forEach(function(opt, idx) {
            var rid = 'dinp_' + sid + '_' + idx; html += '<div class="form-check"><input class="form-check-input" type="radio" id="' + rid + '" name="' + f.name + '__' + f.colIdx + '" value="' + opt + '" ' + req + '><label class="form-check-label" for="' + rid + '">' + opt + '</label></div>';
          }); html += '</div>';
        } else if (f.type === 'password') { html += '<div class="input-group"><input type="password" class="form-control ' + readonlyClass + '" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + ' ' + readonlyAttr + '><button class="btn btn-outline-secondary" type="button" onclick="togglePwd(\'dinp_' + sid + '\', this)"><i class="bi bi-eye"></i></button></div>'; } 
        else if (f.type === 'date') { html += '<input type="date" class="form-control ' + readonlyClass + '" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + ' ' + readonlyAttr + '>'; } 
        else { html += '<input type="text" class="form-control ' + readonlyClass + '" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + ' ' + readonlyAttr + '>'; }
        html += '</div>';
      });
      $('#dealerFormFields').html(html);
      
      formRes.fields.forEach(function(f) {
        var sid = 'c_' + f.colIdx;
        var val = (res.data[f.colIdx] !== undefined && res.data[f.colIdx] !== null) ? res.data[f.colIdx] : ''; 
        var el = $('#dinp_' + sid);
        if(el.length) {
          if (el.attr('type') === 'date' && val) { el.val(dt2inp(val)); } 
          else { el.val(val); }
        } 
        else { 
          var radioEl = $('input[name="' + f.name + '__' + f.colIdx + '"][value="' + val + '"]'); 
          if (radioEl.length) { radioEl.prop('checked', true); } 
        }
      });
    }).catch(function(e) { $('#dealerFormFields').html('<div class="alert alert-danger">Error: '+e.message+'</div>'); });
  }).catch(function(e) { $('#dealerFormFields').html('<div class="alert alert-danger">Error: '+e.message+'</div>'); });
}

function deleteFromModal(){if(currentViewRowNum){closeModal();deleteRow(currentViewRowNum);}}
function closeModal(){var m=document.getElementById('viewModal'),b=bootstrap.Modal.getInstance(m);if(b)b.hide();}
function applyFilters(){loadListData(1);}

function loadDealerForm() {
  $('#dealerFormFields').html('<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Loading form...</p></div>');
  apiGet('getDealerFormStructure').then(function(res) {
    if (res.error) { $('#dealerFormFields').html('<div class="alert alert-danger">'+res.error+'</div>'); return; }
    var html = '';
    res.fields.forEach(function(f) {
      var sid = 'c_' + f.colIdx; var req = f.required ? 'required' : ''; var star = f.required ? '<span class="text-danger">*</span>' : '';
      html += '<div class="mb-3"><label class="form-label fw-semibold">' + f.label + ' ' + star + '</label>';
      if (f.type === 'srno') { html += '<input type="text" class="form-control readonly-field" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" value="' + (f.default || '') + '" readonly>'; } 
      else if (f.type === 'radio') {
        html += '<div class="d-flex gap-4 mt-2">'; f.options.forEach(function(opt, idx) {
          var rid = 'dinp_' + sid + '_' + idx; var checked = (idx === 0) ? 'checked' : '';
          html += '<div class="form-check"><input class="form-check-input" type="radio" id="' + rid + '" name="' + f.name + '__' + f.colIdx + '" value="' + opt + '" ' + checked + ' ' + req + '><label class="form-check-label" for="' + rid + '">' + opt + '</label></div>';
        }); html += '</div>';
      } else if (f.type === 'password') { html += '<div class="input-group"><input type="password" class="form-control" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + '><button class="btn btn-outline-secondary" type="button" onclick="togglePwd(\'dinp_' + sid + '\', this)"><i class="bi bi-eye"></i></button></div>'; } 
      else { html += '<input type="' + f.type + '" class="form-control" id="dinp_' + sid + '" name="' + f.name + '__' + f.colIdx + '" ' + req + '>'; }
      html += '</div>';
    });
    $('#dealerFormFields').html(html);
  }).catch(function(e) { $('#dealerFormFields').html('<div class="alert alert-danger">Error: ' + e.message + '</div>'); });
}

function submitDealerForm() {
  var fd = {}; var hasErr = false;
  $('#dealerForm input').each(function() {
    var el = $(this), name = el.attr('name'); if (!name) return;
    var type = el.attr('type');
    if (type === 'radio') {
      if (el.is(':checked')) { fd[name] = el.val(); }
    } else {
      var val = el.val() ? el.val().trim() : '';
      if (el.prop('required') && !val) { el.addClass('is-invalid'); hasErr = true; } 
      else { el.removeClass('is-invalid'); }
      fd[name] = val;
    }
  });
  var radioReq = {};
  $('#dealerForm input[type="radio"][required]').each(function() { radioReq[$(this).attr('name')] = true; });
  for (var name in radioReq) { if (!fd[name]) { hasErr = true; break; } }
  
  if (hasErr) { showToast('Please fill all required fields!', 'error'); return; }
  var btn = $('#dealerSubmitBtn'); btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Saving...');

  var redirectToDealers = function() {
    isEditingDealer = false;
    var dealerLink = Array.from(document.querySelectorAll('.sidebar-link')).find(el => el.textContent.trim() === 'Dealers');
    if(dealerLink) dealerLink.click();
  };

  if (isEditingDealer) {
    apiPost('updateDealerInfo', {dealerData: fd}).then(function(r) {
      btn.prop('disabled', false).html('<i class="bi bi-check-circle"></i> Update Dealer');
      if (r.success) {
        showToast(r.message, 'success'); 
        $('#dealerStatusMsg').removeClass('d-none alert-danger').addClass('alert-success').html('<i class="bi bi-check-circle-fill"></i> ' + r.message); 
        redirectToDealers();
      } else { 
        showToast(r.message, 'error'); 
        $('#dealerStatusMsg').removeClass('d-none alert-success').addClass('alert-danger').html('<i class="bi bi-exclamation-circle-fill"></i> ' + r.message); 
      }
    }).catch(function(err) { 
      btn.prop('disabled', false).html('<i class="bi bi-check-circle"></i> Update Dealer'); 
      showToast('Error: ' + err.message, 'error'); 
    });
  } else {
    apiPost('addNewDealer', {dealerData: fd}).then(function(r) {
      btn.prop('disabled', false).html('<i class="bi bi-check-circle"></i> Save Dealer');
      if (r.success) {
        showToast(r.message, 'success'); 
        $('#dealerStatusMsg').removeClass('d-none alert-danger').addClass('alert-success').html('<i class="bi bi-check-circle-fill"></i> ' + r.message); 
        redirectToDealers();
      } else { 
        showToast(r.message, 'error'); 
        $('#dealerStatusMsg').removeClass('d-none alert-success').addClass('alert-danger').html('<i class="bi bi-exclamation-circle-fill"></i> ' + r.message); 
      }
    }).catch(function(err) { 
      btn.prop('disabled', false).html('<i class="bi bi-check-circle"></i> Save Dealer'); 
      showToast('Error: ' + err.message, 'error'); 
    });
  }
}

function resetDealerForm() {
  isEditingDealer = false; $('#dealerStatusMsg').addClass('d-none'); $('#dealerFormTitle').text('Add New Dealer'); $('#pageTitle').text('Add New Dealer'); $('#dealerSubmitBtn').html('<i class="bi bi-check-circle"></i> Save Dealer'); loadDealerForm(); 
}

function exportTableCSV(){
  apiGet('exportAllComplaints').then(function(r){
    if(!r.data||!r.data.length){showToast('No data to export','warning');return;}
    var csv=r.headers.map(function(h){return '"'+String(h).replace(/"/g,'""')+'"';}).join(',')+'\n';
    r.data.forEach(function(row){csv+=row.map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"';}).join(',')+'\n';});
    var blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='IOC_Complaints.csv';a.click();URL.revokeObjectURL(url);
    showToast('CSV exported!','success');
  }).catch(function(e){
    showToast('Export Error: '+e.message, 'error');
  });
}
