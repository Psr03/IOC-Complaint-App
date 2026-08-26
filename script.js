// ⬇️ Yahan apni Google Sheet ka Web App URL paste karein
const API_URL = "https://script.google.com/macros/s/AKfycbwT-ZNwM0gl65DYdNtvq8iSzkOGi7eZcWEdNX1KMYaQsj49PL9P5KGNBSFMeUGyVEU7jA/exec"; 

document.addEventListener('DOMContentLoaded', function() {
    fetch(API_URL)
      .then(response => response.json())
      .then(result => {
          const listContainer = document.getElementById('complaint-list');
          
          if (result.data && result.data.length > 0) {
              let html = '';
              // Hum sirf pehli 10 complaints dikhayenge taaki page heavy na ho
              result.data.slice(0, 10).forEach(function(row) {
                  // Maan ke row[0] Date hai, row[1] Outlet Name hai, row[3] Detail aur row[4] Status hai
                  let date = row[0] ? new Date(row[0]).toLocaleDateString() : 'N/A';
                  let outlet = row[1] || 'Unknown Outlet';
                  let detail = row[3] || 'No details';
                  let status = row[4] || 'Open';
                  
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
          document.getElementById('complaint-list').innerText = "Connection failed!";
          console.error("Error:", error);
      });
});
