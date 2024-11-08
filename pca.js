// Riferimenti ai nodi del database
const carraiaRef = database.ref('carraia');
const volontariRef = database.ref('volontari');
const pcaRef = database.ref('pca');

// Funzione per caricare i mezzi dalla carraia
function caricaMezzi() {
    const mezzoSelect = document.getElementById('mezzo');
    
    carraiaRef.on('value', (carraiaSnapshot) => {
        pcaRef.once('value', (pcaSnapshot) => {
            mezzoSelect.innerHTML = '<option value="">Seleziona un mezzo</option>';
            const mezziInOperazione = new Set();
            
            // Raccogliamo i mezzi già in operazione
            pcaSnapshot.forEach(childSnapshot => {
                mezziInOperazione.add(childSnapshot.val().mezzo);
            });

            carraiaSnapshot.forEach((childSnapshot) => {
                const mezzo = childSnapshot.val();
                const option = document.createElement('option');
                const mezzoValue = `${mezzo.targa} - ${mezzo.modello}`;
                option.value = mezzoValue;
                option.textContent = mezzoValue;
                option.dataset.associazione = mezzo.associazione;
                
                if (mezziInOperazione.has(mezzoValue)) {
                    option.disabled = true;
                    option.textContent += ' (In operazione)';
                } else if (mezzo.orario_uscita) {
                    option.textContent += ' (Uscito)';
                    option.classList.add('mezzo-uscito');
                }
                
                mezzoSelect.appendChild(option);
            });
        });
    });
}

// Funzione per caricare i responsabili dai volontari
// Funzione per caricare tutti i volontari
function caricaResponsabili() {
    const responsabileSelect = document.getElementById('responsabile');
    volontariRef.once('value', (snapshot) => {
        const volontari = [];
        snapshot.forEach((childSnapshot) => {
            const volontario = childSnapshot.val();
            if (volontario.nome && volontario.cognome) {
                volontari.push(volontario);
            }
        });

        // Ordina i volontari per cognome
        volontari.sort((a, b) => a.cognome.localeCompare(b.cognome));

        responsabileSelect.innerHTML = '<option value="">Seleziona un responsabile</option>';
        volontari.forEach((volontario) => {
            const option = document.createElement('option');
            const ruoloDisplay = volontario.ruolo ? ` - ${volontario.ruolo}` : '';
            option.value = `${volontario.nome} ${volontario.cognome}${ruoloDisplay}`;
            option.textContent = `${volontario.cognome} ${volontario.nome}${ruoloDisplay}`;
            
            if (volontario.ruolo && volontario.ruolo.startsWith('(Res.)')) {
                option.classList.add('responsabile');
            }
            
            responsabileSelect.appendChild(option);
        });
    });
}

// Funzione per aggiungere un mezzo in operazione
function aggiungiMezzoInOperazione(e) {
    e.preventDefault();
    const mezzo = document.getElementById('mezzo').value;
    const scenario = document.getElementById('scenario').value;
    const posizione = document.getElementById('posizione').value;
    const associazione = document.getElementById('associazione').value;
    const responsabile = document.getElementById('responsabile').value;
    const cellulare = document.getElementById('cellulare').value;

    pcaRef.orderByChild('mezzo').equalTo(mezzo).once('value', snapshot => {
        if (snapshot.exists()) {
            // Il mezzo è già in operazione
            if (confirm(`Il mezzo ${mezzo} è già in operazione. Vuoi cambiare il suo scenario?`)) {
                // Aggiorna lo scenario del mezzo esistente
                const key = Object.keys(snapshot.val())[0];
                pcaRef.child(key).update({
                    scenario: scenario,
                    posizione: posizione,
                    responsabile: responsabile,
                    cellulare: cellulare,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                }).then(() => {
                    alert('Scenario del mezzo aggiornato con successo');
                    document.getElementById('pcaForm').reset();
                }).catch(error => {
                    console.error("Errore nell'aggiornamento dello scenario:", error);
                });
            }
        } else {
            // Aggiungi un nuovo mezzo in operazione
            pcaRef.push({
                mezzo,
                scenario,
                posizione,
                associazione,
                responsabile,
                cellulare,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                document.getElementById('pcaForm').reset();
                alert('Mezzo aggiunto in operazione con successo');
            }).catch((error) => {
                console.error("Errore nell'aggiunta del mezzo in operazione:", error);
            });
        }
    });
}

// Funzione per visualizzare i mezzi in operazione
function visualizzaMezziInOperazione() {
    const mezziContainer = document.getElementById('mezziInOperazione');
    pcaRef.on('value', (snapshot) => {
        mezziContainer.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const mezzo = childSnapshot.val();
            const mezzoCard = document.createElement('div');
            mezzoCard.className = 'mezzo-card';
            mezzoCard.setAttribute('data-scenario', mezzo.scenario);
            mezzoCard.innerHTML = `
                <h3>${mezzo.mezzo}</h3>
                <p><strong>Scenario:</strong> ${mezzo.scenario}</p>
                <p><strong>Posizione:</strong> ${mezzo.posizione}</p>
                <p><strong>Associazione:</strong> ${mezzo.associazione}</p>
                <p><strong>Responsabile:</strong> ${mezzo.responsabile}</p>
                <p><strong>Cellulare reperibilità:</strong> ${mezzo.cellulare || 'N/A'}</p>
                <button class="edit-btn" onclick="modificaMezzoInOperazione('${childSnapshot.key}')" title="Modifica">✎</button>
                <button class="print-btn" onclick="stampaReportMezzo('${childSnapshot.key}')" title="Stampa Report">🖨️</button>
                <button class="remove-btn" onclick="rimuoviMezzoInOperazione('${childSnapshot.key}')" title="Rimuovi">×</button>
            `;
            mezziContainer.appendChild(mezzoCard);
        });
    });
}

function modificaMezzoInOperazione(key) {
    pcaRef.child(key).once('value', snapshot => {
        const mezzo = snapshot.val();
        document.getElementById('mezzo').value = mezzo.mezzo;
        document.getElementById('scenario').value = mezzo.scenario;
        document.getElementById('posizione').value = mezzo.posizione;
        document.getElementById('associazione').value = mezzo.associazione;
        document.getElementById('responsabile').value = mezzo.responsabile;
        document.getElementById('cellulare').value = mezzo.cellulare || '';

        // Cambia il testo del pulsante di submit
        const submitButton = document.querySelector('#pcaForm button[type="submit"]');
        submitButton.textContent = 'Aggiorna Mezzo in Operazione';

        // Aggiungi un attributo data per identificare che stiamo modificando
        submitButton.setAttribute('data-editing', key);
    });
}

// Funzione per rimuovere un mezzo in operazione
function rimuoviMezzoInOperazione(key) {
    if (confirm('Sei sicuro di voler rimuovere questo mezzo dalle operazioni?')) {
        pcaRef.child(key).remove().catch((error) => {
            console.error("Errore nella rimozione del mezzo:", error);
        });
    }
}

// Funzione per condividere i dati
function condividiDati() {
    pcaRef.once('value').then((snapshot) => {
        const data = snapshot.val();
        const textData = JSON.stringify(data, null, 2);
        const blob = new Blob([textData], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pca_data.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }).catch((error) => {
        console.error("Errore nella condivisione dei dati:", error);
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    caricaMezzi();
    caricaResponsabili();
    visualizzaMezziInOperazione();
    updateResponsabiliInOperazione();

    document.getElementById('pcaForm').addEventListener('submit', aggiungiMezzoInOperazione);

    // Aggiorna l'associazione quando viene selezionato un mezzo
    document.getElementById('mezzo').addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        document.getElementById('associazione').value = selectedOption.dataset.associazione || '';
    });
});

// Gestione dell'autenticazione
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // L'utente è autenticato
    } else {
        // L'utente non è autenticato, reindirizza alla pagina di login
        window.location.href = 'login.html';
    }
});
// Stampa report
function stampaReportMezzo(key) {
    pcaRef.child(key).once('value', (snapshot) => {
        const mezzo = snapshot.val();
        const reportContent = `
            <h2>Report Mezzo in Operazione</h2>
            <p><strong>Mezzo:</strong> ${mezzo.mezzo}</p>
            <p><strong>Scenario:</strong> ${mezzo.scenario}</p>
            <p><strong>Posizione:</strong> ${mezzo.posizione}</p>
            <p><strong>Associazione:</strong> ${mezzo.associazione}</p>
            <p><strong>Responsabile:</strong> ${mezzo.responsabile}</p>
            <p><strong>Cellulare reperibilità:</strong> ${mezzo.cellulare || 'N/A'}</p>
            <p><strong>Data e ora:</strong> ${new Date().toLocaleString()}</p>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Report Mezzo - ${mezzo.mezzo}</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; }
                        h2 { color: #0056b3; }
                        p { margin: 10px 0; }
                    </style>
                </head>
                <body>
                    ${reportContent}
                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    });
}

// Funzione per aggiornare i dati dei responsabili in tempo reale 
function updateResponsabiliInOperazione() {
    volontariRef.on('value', (snapshot) => {
        const volontari = snapshot.val();
        document.querySelectorAll('.mezzo-card').forEach(card => {
            const responsabileElement = card.querySelector('p:nth-child(5)');
            const responsabileNome = responsabileElement.textContent.split(': ')[1];
            const [nome, cognome] = responsabileNome.split(' ');
            
            for (let key in volontari) {
                const volontario = volontari[key];
                if (volontario.nome === nome && volontario.cognome === cognome) {
                    responsabileElement.innerHTML = `<strong>Responsabile:</strong> ${volontario.nome} ${volontario.cognome} - ${volontario.ruolo}`;
                    break;
                }
            }
        });
    });
}