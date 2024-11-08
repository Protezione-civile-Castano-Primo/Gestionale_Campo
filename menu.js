// Contenuto del menu
const menuHTML = `
<nav class="menu">
    <div class="menu-content">
        <div class="menu-toggle">
            <span></span>
            <span></span>
            <span></span>
        </div>
        <ul class="menu-items">
            <li><a href="index.html"><i class="fas fa-home"></i> Home</a></li>
            <li><a href="carraia.html"><i class="fas fa-car"></i> Carraia</a></li>
            <li><a href="radio.html"><i class="fas fa-broadcast-tower"></i> Gestione Radio</a></li>
            <li><a href="accessi_uscite_mezzi.html"><i class="fas fa-exchange-alt"></i> Accessi/Uscite Mezzi</a></li>
            <li><a href="volontari.html"><i class="fas fa-users"></i> Gestione Volontari</a></li>
            <li><a href="allergeni.html"><i class="fas fa-allergies"></i> Allergeni</a></li>
            <li><a href="pca.html"><i class="fas fa-map-marked-alt"></i> PCA</a></li>
            <li><a href="#" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
            
        </ul>
    </div>
</nav>
`;

// Funzione per caricare il menu
function loadMenu() {
    const menuPlaceholder = document.getElementById('menu-placeholder');
    if (menuPlaceholder) {
        menuPlaceholder.innerHTML = menuHTML;
        
        // Aggiungi l'evento di logout dopo che il menu è stato caricato
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                firebase.auth().signOut().then(() => {
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Errore durante il logout:', error);
                });
            });
        }

        // Aggiungi la funzionalità del menu a sandwich
        const menuToggle = document.querySelector('.menu-toggle');
        const menuItems = document.querySelector('.menu-items');
        
        if (menuToggle && menuItems) {
            menuToggle.addEventListener('click', () => {
                menuItems.classList.toggle('active');
                menuToggle.classList.toggle('active');
            });
        }
    }
}

// Carica il menu quando il documento è pronto
document.addEventListener('DOMContentLoaded', loadMenu);

// Gestione dell'autenticazione
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // L'utente è autenticato, carica il menu
        loadMenu();
    } else {
        // L'utente non è autenticato, reindirizza alla pagina di login
        window.location.href = 'login.html';
    }
});