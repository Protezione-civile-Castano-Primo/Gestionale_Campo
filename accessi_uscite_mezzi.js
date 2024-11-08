// Riferimento al nodo "carraia" nel database
const carraiaRef = database.ref('carraia');

// Funzione per formattare la data
function formattaData(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

// Funzione per caricare e visualizzare i dati
// ... (codice precedente rimane invariato) ...

function caricaDati(data = null) {
    let query = carraiaRef;
    if (data) {
        const dataInizio = new Date(data);
        dataInizio.setHours(0, 0, 0, 0);
        const dataFine = new Date(data);
        dataFine.setHours(23, 59, 59, 999);
        query = query.orderByChild('orario_ingresso').startAt(dataInizio.getTime()).endAt(dataFine.getTime());
    }

    query.on('value', (snapshot) => {
        const mezziInterni = document.getElementById('mezziInterni');
        const mezziUsciti = document.getElementById('mezziUsciti');
        mezziInterni.innerHTML = '';
        mezziUsciti.innerHTML = '';

        snapshot.forEach((childSnapshot) => {
            const veicolo = childSnapshot.val();
            const key = childSnapshot.key;
            const isUscito = veicolo.orario_uscita ? true : false;
            const card = `
                <div class="card ${isUscito ? 'card-uscito' : 'card-interno'}">
                    <div class="card-header">
                        <h3>${veicolo.modello}</h3>
                        <span class="semaforo ${isUscito ? 'semaforo-rosso' : 'semaforo-verde'}"></span>
                    </div>
                    <div class="card-body">
                        <p><strong>Targa:</strong> ${veicolo.targa}</p>
                        <p><strong>Associazione:</strong> ${veicolo.associazione}</p>
                        <p><strong>Orario Ingresso:</strong> ${formattaData(veicolo.orario_ingresso)}</p>
                        ${isUscito ? `<p><strong>Orario Uscita:</strong> ${formattaData(veicolo.orario_uscita)}</p>` : ''}
                    </div>
                </div>
            `;

            if (isUscito) {
                mezziUsciti.innerHTML += card;
            } else {
                mezziInterni.innerHTML += card;
            }
        });
    });
}

// Gestione del filtro per data
document.getElementById('applicaFiltro').addEventListener('click', () => {
    const dataFiltro = document.getElementById('filtroData').value;
    if (dataFiltro) {
        caricaDati(dataFiltro);
    }
});

document.getElementById('resetFiltro').addEventListener('click', () => {
    document.getElementById('filtroData').value = '';
    caricaDati();
});

// Controlla lo stato di autenticazione
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('userInfo').textContent = `Utente: ${user.email}`;
        caricaDati();
    } else {
        window.location.href = 'login.html';
    }
});

