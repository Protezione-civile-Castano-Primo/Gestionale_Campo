document.addEventListener('DOMContentLoaded', function() {
    // Verifica lo stato di autenticazione
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // L'utente è autenticato
            document.getElementById('userInfo').textContent = `Benvenuto, ${user.email}`;
        } else {
            // L'utente non è autenticato, reindirizza alla pagina di login
            window.location.href = 'login.html';
        }
    });
});