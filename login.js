// Il riferimento a auth è già disponibile dal file firebase-init.js

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Login riuscito, reindirizza alla pagina principale
            window.location.href = 'index.html';
        })
        .catch((error) => {
            // Gestione degli errori
            alert('Errore di accesso: ' + error.message);
        });
});

// Opzionale: registra un evento di login per Analytics
if (window.analytics) {
    window.analytics.logEvent('login');
}