// ⬇️ Yahan apni Google Sheet ka Web App URL paste karein
const API_URL = "https://script.google.com/macros/s/AKfycbwdlfmUGUy1__3TammocP9quhr9GDN6RDYpwYI22pjhEOWxw8l8yfBHsjpeQQyBsNp77A/exec"; 

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
