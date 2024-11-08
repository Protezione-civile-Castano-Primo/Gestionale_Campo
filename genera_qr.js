// Riferimento al nodo "carraia" nel database
const carraiaRef = database.ref('carraia');

// Funzione per ottenere i dati unici dalla carraia
async function getDatiCarraia() {
    try {
        const snapshot = await carraiaRef.once('value');
        const data = snapshot.val();
        
        // Oggetti per memorizzare valori unici
        const targhe = new Set();
        const modelli = new Set();
        const associazioni = new Set();

        // Estrai i dati unici
        if (data) {
            Object.values(data).forEach(entry => {
                if (entry.targa) targhe.add(entry.targa);
                if (entry.modello) modelli.add(entry.modello);
                if (entry.associazione) associazioni.add(entry.associazione);
            });
        }

        return {
            targhe: Array.from(targhe),
            modelli: Array.from(modelli),
            associazioni: Array.from(associazioni)
        };
    } catch (error) {
        console.error('Errore nel recupero dei dati:', error);
        return { targhe: [], modelli: [], associazioni: [] };
    }
}

// Funzione per mostrare il feedback
function showFeedback(message, type = 'info') {
    const feedback = document.getElementById('feedback');
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
    feedback.style.display = 'block';
    setTimeout(() => {
        feedback.style.display = 'none';
    }, 3000);
}

// Funzione per aggiornare l'anteprima
function updatePreview() {
    const targa = document.getElementById('targa').value.toUpperCase();
    const associazione = document.getElementById('associazione').value.toUpperCase();
    const modello = document.getElementById('modello').value.toUpperCase();
    
    const preview = document.getElementById('dataPreview');
    if (targa || associazione || modello) {
        preview.innerHTML = `
            <div class="preview-item"><strong>Targa:</strong> ${targa}</div>
            <div class="preview-item"><strong>Associazione:</strong> ${associazione}</div>
            <div class="preview-item"><strong>Modello:</strong> ${modello}</div>
        `;
    } else {
        preview.innerHTML = '<div class="preview-empty">I dati appariranno qui</div>';
    }
}

// Inizializzazione e gestione eventi al caricamento del documento
document.addEventListener('DOMContentLoaded', async function() {
    const form = document.getElementById('qrForm');
    const qrResult = document.getElementById('qrResult');
    const qrCode = document.getElementById('qrCode');
    const vehicleInfo = document.querySelector('.vehicle-info');
    const printBtn = document.getElementById('printBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const newQrBtn = document.getElementById('newQrBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // Mostra loading
    loadingIndicator.style.display = 'block';

    // Carica i dati per l'autocompletamento
    const datiCarraia = await getDatiCarraia();

    // Nascondi loading
    loadingIndicator.style.display = 'none';

    // Autocompletamento per la targa
    const autoCompleteTarga = new autoComplete({
        selector: "#targa",
        placeHolder: "Inserisci la targa",
        data: {
            src: datiCarraia.targhe,
            cache: true,
        },
        resultItem: {
            highlight: true
        },
        events: {
            input: {
                selection: async (event) => {
                    const selection = event.detail.selection.value;
                    autoCompleteTarga.input.value = selection;
                    
                    // Cerca e popola automaticamente gli altri campi
                    const snapshot = await carraiaRef
                        .orderByChild('targa')
                        .equalTo(selection)
                        .once('value');
                    
                    const data = snapshot.val();
                    if (data) {
                        const entry = Object.values(data)[0];
                        document.getElementById('associazione').value = entry.associazione || '';
                        document.getElementById('modello').value = entry.modello || '';
                        updatePreview();
                    }
                }
            }
        }
    });

    // Autocompletamento per l'associazione e il modello
    [
        { id: 'associazione', data: datiCarraia.associazioni },
        { id: 'modello', data: datiCarraia.modelli }
    ].forEach(({ id, data }) => {
        new autoComplete({
            selector: `#${id}`,
            placeHolder: `Inserisci ${id}`,
            data: { src: data, cache: true },
            resultItem: { highlight: true },
            events: {
                input: {
                    selection: (event) => {
                        const input = document.getElementById(id);
                        input.value = event.detail.selection.value;
                        updatePreview();
                    }
                }
            }
        });
    });

    // Aggiorna preview quando si digita
    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
            updatePreview();
        });
    });

    // Gestione del form
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const targa = document.getElementById('targa').value.toUpperCase();
        const associazione = document.getElementById('associazione').value.toUpperCase();
        const modello = document.getElementById('modello').value.toUpperCase();

        // Validazione
        if (!targa || !associazione || !modello) {
            showFeedback('Tutti i campi sono obbligatori', 'error');
            return;
        }

        // Crea l'oggetto dati per il QR code
        const data = {
            targa: targa,
            associazione: associazione,
            modello: modello
        };

        try {
            // Genera il QR code
            qrCode.innerHTML = '';
            const canvas = document.createElement('canvas');
            QRCode.toCanvas(canvas, JSON.stringify(data), {
                width: 300,
                margin: 2
            });
            qrCode.appendChild(canvas);

            // Mostra le informazioni del veicolo
            vehicleInfo.innerHTML = `
                <strong>Targa:</strong> ${targa}<br>
                <strong>Associazione:</strong> ${associazione}<br>
                <strong>Modello:</strong> ${modello}
            `;

            // Mostra il risultato e i pulsanti
            qrResult.style.display = 'block';
            showFeedback('QR Code generato con successo', 'success');
            
            // Nascondi il form
            form.style.display = 'none';
        } catch (error) {
            console.error('Errore nella generazione del QR code:', error);
            showFeedback('Errore nella generazione del QR code', 'error');
        }
    });

    // Gestione stampa
    printBtn.addEventListener('click', function() {
        window.print();
    });

    // Gestione download
    downloadBtn.addEventListener('click', function() {
        const canvas = qrCode.querySelector('canvas');
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `qr_${document.getElementById('targa').value}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    // Gestione nuovo QR code
    newQrBtn.addEventListener('click', function() {
        form.reset();
        form.style.display = 'block';
        qrResult.style.display = 'none';
        updatePreview();
    });

    // Inizializza la preview
    updatePreview();
});

// Controlla lo stato di autenticazione
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('userInfo').textContent = `Utente: ${user.email}`;
    } else {
        window.location.href = 'login.html';
    }
});