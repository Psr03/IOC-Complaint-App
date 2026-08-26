document.addEventListener('DOMContentLoaded', function() {
    console.log("App Loaded Successfully!");
    
    // Yahan hum aage Google Sheet se data lane wala code likhenge
    const card = document.querySelector('.card p');
    if(card) {
        card.innerText = "App is ready! Google Sheet connection will be added next.";
    }
});
