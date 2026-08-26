// ⬇️ Yahan apna NAYA Web App URL paste karein
const API_URL = "YAHAN_NAYA_URL_PASTE_KAREIN";

document.addEventListener('DOMContentLoaded', function() {
    loadComplaints();
    
    // Form Submit Logic
    const form = document.getElementById('complaintForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerText = "Saving...";
        submitBtn.disabled = true;
        
        // Data collect karein
        const formData = {
            "Retail Outlet Name": document.getElementById('outletName').value,
            "DU Complent Detail": document.getElementById('complaintDetail').value,
            "Status": document.getElementById('status').value
        };
        
        // Google Sheet mein bhejein
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(formData),
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(result => {
            if(result.status === 'success') {
                alert("Complaint added successfully!");
                form.reset(); // Form khali karein
                loadComplaints(); // List refresh karein
            } else {
                alert("Error: " + result.message);
            }
            submitBtn.innerText = "Submit Complaint";
            submitBtn.disabled = false;
        })
        .catch(error => {
            alert("Connection failed!");
            submitBtn.innerText = "Submit Complaint";
            submitBtn.disabled = false;
        });
    });
});

// Complaints Load karne ka function
function loadComplaints() {
    const listContainer = document.getElementById('complaint-list');
    listContainer.innerText = "Loading complaints...";
    
    fetch(API_URL)
      .then(response => response.json())
      .then(result => {
          if (result.data && result.data.length > 0) {
              let html = '';
              // Headers ka index dhoondhein
              let hIdx = {}, hLower = result.headers.map(h => String(h).trim().toLowerCase());
              hLower.forEach((h, i) => hIdx[h] = i);
              
              let idxOutlet = hIdx['retail outlet name'] !== undefined ? hIdx['retail outlet name'] : 1;
              let idxDetail = hIdx['du complent detail'] !== undefined ? hIdx['du complent detail'] : 3;
              let idxStatus = hIdx['status'] !== undefined ? hIdx['status'] : 4;
              let idxDate = hIdx['date'] !== undefined ? hIdx['date'] : 0;
              
              result.data.slice(-5).reverse().forEach(function(row) {
                  let date = row[idxDate] ? new Date(row[idxDate]).toLocaleDateString() : 'N/A';
                  let outlet = row[idxOutlet] || 'Unknown';
                  let detail = row[idxDetail] || 'No details';
                  let status = row[idxStatus] || 'Open';
                  
                  html += `
                    <div class="complaint-item">
                      <strong>${outlet}</strong><br>
                      <small>${date}</small><br>
                      ${detail}<br>
                      <span class="complaint-status">${status}</span>
                    </div>
                  `;
              });
              listContainer.innerHTML = html;
          } else {
              listContainer.innerHTML = "<p>No complaints found.</p>";
          }
      })
      .catch(error => {
          listContainer.innerText = "Connection failed!";
      });
}
