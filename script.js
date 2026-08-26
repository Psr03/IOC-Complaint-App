// ⬇️ Yahan apni Google Sheet ka Web App URL paste karein
const API_URL = "https://script.google.com/macros/s/AKfycbwT-ZNwM0gl65DYdNtvq8iSzkOGi7eZcWEdNX1KMYaQsj49PL9P5KGNBSFMeUGyVEU7jA/exec"; 

document.addEventListener('DOMContentLoaded', function() {
    console.log("App Loaded Successfully!");
    
    // Google Sheet se data lana
    fetch(API_URL)
      .then(response => response.json())
      .then(result => {
          const card = document.querySelector('.card p');
          if (result.data && result.data.length > 0) {
              card.innerText = "Google Sheet Connected! Total Complaints: " + result.data.length;
          } else if (result.error) {
              card.innerText = "Error: " + result.error;
          } else {
              card.innerText = "Google Sheet Connected! No complaints found.";
          }
      })
      .catch(error => {
          const card = document.querySelector('.card p');
          card.innerText = "Connection failed!";
          console.error("Error:", error);
      });
});
