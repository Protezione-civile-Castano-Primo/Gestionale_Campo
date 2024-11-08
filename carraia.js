// Riferimento al nodo "carraia" nel database
const carraiaRef = database.ref('carraia');

let ultimoQRProcessato = null;
let timeoutProcessamento = null;
const RITARDO_ANTI_RIMBALZO = 3000; // 3 secondi di attesa tra le scansioni

// Lista dei modelli comuni per l'autocompletamento
const modelliComuni = [
    "AUTO", "CARRELLO", "PICK-UP", "FURGONE", "AMBULANZA", "AUTOPOMPA", "JEEP","CAMION", "SUV", "AUTOBUS", "SCOOTER", "MOTO"
];

// Funzioni di base

function formattaData(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function registraUscita(entryKey) {
    return carraiaRef.child(entryKey).update({
        orario_uscita: firebase.database.ServerValue.TIMESTAMP
    });
}

function verificaTargaPresente(targa) {
    return new Promise((resolve, reject) => {
        carraiaRef.orderByChild('targa')
            .equalTo(targa)
            .once('value', snapshot => {
                let stato = {
                    presente: false,
                    ultimoIngresso: null,
                    esistente: false
                };
                
                let entries = [];
                snapshot.forEach(childSnapshot => {
                    entries.push({
                        ...childSnapshot.val(),
                        key: childSnapshot.key
                    });
                });

                console.log('Entries trovate per targa:', targa, entries);

                if (entries.length > 0) {
                    stato.esistente = true;
                    // Ordina per orario di ingresso decrescente
                    entries.sort((a, b) => (b.orario_ingresso || 0) - (a.orario_ingresso || 0));
                    stato.ultimoIngresso = entries[0];
                    
                    // Verifica se l'ultimo ingresso non ha un'uscita registrata
                    stato.presente = !stato.ultimoIngresso.orario_uscita;
                }

                console.log('Stato calcolato:', stato);
                resolve(stato);
            })
            .catch(error => {
                console.error('Errore in verificaTargaPresente:', error);
                reject(error);
            });
    });
}


// Funzione per aggiungere un nuovo ingresso
async function aggiungiIngresso(targa, associazione, modello) {
    console.log('Tentativo di aggiungere ingresso:', { targa, associazione, modello });
    
    if (!targa || !associazione || !modello) {
        throw new Error("Tutti i campi sono obbligatori.");
    }
    
    targa = targa.toUpperCase().trim();
    associazione = associazione.toUpperCase().trim();
    modello = modello.toUpperCase().trim();

    const statoTarga = await verificaTargaPresente(targa);
    console.log('Stato targa per nuovo ingresso:', statoTarga);
    
    if (statoTarga.presente) {
        throw new Error("Questa targa è già presente e non è ancora uscita.");
    }

    await aggiungiAssociazione(associazione);

    // Se esiste un record precedente con uscita registrata, lo riutilizziamo
    if (statoTarga.esistente && statoTarga.ultimoIngresso?.orario_uscita) {
        console.log('Aggiornamento record esistente:', statoTarga.ultimoIngresso.key);
        return carraiaRef.child(statoTarga.ultimoIngresso.key).update({
            associazione: associazione,
            modello: modello,
            orario_ingresso: firebase.database.ServerValue.TIMESTAMP,
            orario_uscita: null
        });
    }

    // Altrimenti, creiamo un nuovo record
    console.log('Creazione nuovo record');
    return carraiaRef.push({
        targa: targa,
        associazione: associazione,
        modello: modello,
        orario_ingresso: firebase.database.ServerValue.TIMESTAMP,
        orario_uscita: null
    });
}

function eliminaIngresso(entryKey) {
    if (confirm("Sei sicuro di voler eliminare questo ingresso?")) {
        return carraiaRef.child(entryKey).remove()
            .then(() => {
                console.log("Ingresso eliminato con successo");
            })
            .catch((error) => {
                console.error("Errore durante l'eliminazione:", error);
            });
    }
}

// Funzioni statistiche
function aggiornaStatistiche(data) {
    if (!data) return;

    const entries = Object.values(data);
    const now = new Date();
    const startOfDay = new Date(now.setHours(0,0,0,0));

    // Mezzi presenti
    const mezziPresenti = entries.filter(entry => !entry.orario_uscita).length;
    document.getElementById('mezziPresenti').textContent = mezziPresenti;

    // Mezzi usciti oggi
    const mezziUscitiOggi = entries.filter(entry => 
        entry.orario_uscita && new Date(entry.orario_uscita) > startOfDay
    ).length;
    document.getElementById('mezziUsciti').textContent = mezziUscitiOggi;

    // Ultimo movimento
    const ultimoMovimento = entries.reduce((latest, entry) => {
        const entryTime = entry.orario_uscita || entry.orario_ingresso;
        return !latest || entryTime > latest ? entryTime : latest;
    }, null);
    document.getElementById('ultimoMovimento').textContent = 
        ultimoMovimento ? formattaData(ultimoMovimento) : '-';
}

// Funzione per il caricamento di jsQR
function loadJsQR() {
    return new Promise((resolve, reject) => {
        if (window.jsQR) {
            resolve();
            return;
        }

        // Se non è disponibile, aspetta un po' e riprova
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkJsQR = () => {
            attempts++;
            if (typeof jsQR !== 'undefined') {
                resolve();
            } else if (attempts < maxAttempts) {
                setTimeout(checkJsQR, 500);
            } else {
                reject(new Error('jsQR non disponibile dopo diversi tentativi'));
            }
        };

        checkJsQR();
    });
}

// Funzione per aggiornare la vista
function aggiornaVista(data) {
    const presentiGrid = document.getElementById('mezziPresentiGrid');
    const uscititBody = document.getElementById('ingressiBody');
    
    if (!data) {
        presentiGrid.innerHTML = '<div class="no-data">Nessun mezzo presente</div>';
        uscititBody.innerHTML = '<tr><td colspan="6">Nessun dato disponibile</td></tr>';
        return;
    }

    const entries = Object.entries(data).map(([key, value]) => ({key, ...value}));
    
    // Aggiorna griglia mezzi presenti
    const mezziPresenti = entries.filter(entry => !entry.orario_uscita);
    presentiGrid.innerHTML = mezziPresenti.map(entry => `
        <div class="mezzo-card">
            <h4>${entry.targa}</h4>
            <div class="mezzo-info">
                <p><strong>Associazione:</strong> ${entry.associazione}</p>
                <p><strong>Modello:</strong> ${entry.modello}</p>
                <p><strong>Ingresso:</strong> ${formattaData(entry.orario_ingresso)}</p>
            </div>
            <div class="mezzo-actions">
                <button onclick="registraUscita('${entry.key}')" class="btn">
                    <i class="fas fa-sign-out-alt"></i> Registra Uscita
                </button>
            </div>
        </div>
    `).join('');

    // Aggiorna tabella usciti
    const mezziUsciti = entries.filter(entry => entry.orario_uscita)
        .sort((a, b) => b.orario_uscita - a.orario_uscita);
    
    uscititBody.innerHTML = mezziUsciti.map(entry => `
        <tr>
            <td data-label="Targa">${entry.targa}</td>
            <td data-label="Associazione">${entry.associazione}</td>
            <td data-label="Modello">${entry.modello}</td>
            <td data-label="Orario Ingresso">${formattaData(entry.orario_ingresso)}</td>
            <td data-label="Orario Uscita">${formattaData(entry.orario_uscita)}</td>
            <td data-label="Azioni">
                <button onclick="eliminaIngresso('${entry.key}')" class="btn btn-delete">
                    <i class="fas fa-trash"></i> Elimina
                </button>
            </td>
        </tr>
    `).join('');
}

// Funzione per ascoltare gli aggiornamenti in tempo reale
function ascoltaAggiornamenti() {
    carraiaRef.on('value', (snapshot) => {
        const data = snapshot.val();
        aggiornaVista(data);
        aggiornaStatistiche(data);
    }, (error) => {
        console.error("Errore nel recupero dei dati:", error);
        showStatus('Errore nel caricamento dei dati', 'error');
    });
}

// Inizializzazione e gestione eventi al caricamento del documento
document.addEventListener('DOMContentLoaded', function() {
    // Riferimenti agli elementi DOM
    const modal = document.querySelector('#scannerModal');
    const openScannerBtn = document.querySelector('#openScanner');
    const closeBtn = document.querySelector('.close');
    const video = document.getElementById('qr-video');
    const cameraSelect = document.getElementById('camera-select');
    const startButton = document.getElementById('startScanner');
    const stopButton = document.getElementById('stopScanner');
    const statusMessage = document.getElementById('scanner-status');
    const searchInput = document.getElementById('searchTarga');
    let videoStream;

    // Inizializzazione delle tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Rimuovi la classe active da tutti i bottoni e contenuti
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Aggiungi la classe active al bottone cliccato e al contenuto corrispondente
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Inizializzazione dell'autocompletamento per il modello
    const autoCompleteJS = new autoComplete({
        selector: "#modello",
        placeHolder: "Inserisci il modello del veicolo",
        data: {
            src: modelliComuni
        },
        resultItem: {
            highlight: true
        },
        events: {
            input: {
                selection: (event) => {
                    const selection = event.detail.selection.value;
                    autoCompleteJS.input.value = selection;
                }
            }
        }
    });

    // Inizializzazione dell'autocompletamento per l'associazione
    const autoCompleteAssociazione = new autoComplete({
        selector: "#associazione",
        placeHolder: "Inserisci l'associazione",
        data: {
            src: async () => {
                return await getAssociazioni();
            }
        },
        resultItem: {
            highlight: true
        },
        events: {
            input: {
                selection: (event) => {
                    const selection = event.detail.selection.value;
                    autoCompleteAssociazione.input.value = selection;
                }
            },
            results: {
                rendered: (results, matches) => {
                    const resultsList = document.getElementById("autoComplete_list_2");
                    if (matches > 0) {
                        resultsList.classList.add("autoComplete_result");
                        resultsList.removeAttribute("hidden"); // Assicurati che sia visibile
                    } else {
                        resultsList.setAttribute("hidden", "true");
                    }
                }
            }
        }
    });
    
    

    // Funzione di ricerca
    function cercaMezzi() {
        const searchTerm = searchInput.value.toUpperCase();
        const cards = document.querySelectorAll('.mezzo-card');
        const rows = document.querySelectorAll('#ingressiBody tr');

        // Cerca nelle cards dei mezzi presenti
        cards.forEach(card => {
            const targa = card.querySelector('h4').textContent;
            const associazione = card.querySelector('.mezzo-info p:nth-child(1)').textContent;
            const modello = card.querySelector('.mezzo-info p:nth-child(2)').textContent;
            
            if (targa.includes(searchTerm) || 
                associazione.includes(searchTerm) || 
                modello.includes(searchTerm)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });

        // Cerca nella tabella dei mezzi usciti
        rows.forEach(row => {
            const targa = row.querySelector('[data-label="Targa"]').textContent;
            const associazione = row.querySelector('[data-label="Associazione"]').textContent;
            const modello = row.querySelector('[data-label="Modello"]').textContent;
            
            if (targa.includes(searchTerm) || 
                associazione.includes(searchTerm) || 
                modello.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    // Event listener per la ricerca
    if (searchInput) {
        searchInput.addEventListener('input', cercaMezzi);
    }

    // Gestione dei pulsanti rapidi
    document.querySelectorAll('.btn-rapido').forEach(button => {
        button.addEventListener('click', () => {
            document.getElementById('modello').value = button.dataset.modello;
        });
    });

    // Gestione del form di ingresso
    document.getElementById('ingressoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const targa = document.getElementById('targa').value.toUpperCase();
        const associazione = document.getElementById('associazione').value.toUpperCase();
        const modello = document.getElementById('modello').value.toUpperCase();
        const errorMessage = document.getElementById('errorMessage');
        
        try {
            await aggiungiIngresso(targa, associazione, modello);
            document.getElementById('ingressoForm').reset();
            errorMessage.textContent = '';
            errorMessage.style.display = 'none';
            showStatus('Ingresso registrato con successo', 'success');
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
            showStatus(error.message, 'error');
        }
    });

    // Funzione per mostrare messaggi di stato
    function showStatus(message, type) {
        const statusEl = document.createElement('div');
        statusEl.className = `status ${type}`;
        statusEl.textContent = message;
        document.querySelector('.container').insertBefore(statusEl, document.querySelector('.container').firstChild);
        
        setTimeout(() => {
            statusEl.remove();
        }, 3000);
    }

    // Gestione Scanner QR
    if (openScannerBtn) {
        openScannerBtn.onclick = function() {
            modal.style.display = "block";
            getCameras();
        }
    }

    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = "none";
            stopScanner();
        }
    }

    // Chiusura del modal quando si clicca fuori
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
            stopScanner();
        }
    }

    // Funzioni Scanner QR
    async function getCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            if (cameraSelect) {
                cameraSelect.innerHTML = videoDevices.map(device => 
                    `<option value="${device.deviceId}">${device.label || `Camera ${videoDevices.indexOf(device) + 1}`}</option>`
                ).join('');
            }
        } catch (error) {
            showStatus('Errore nel caricamento delle fotocamere', 'error');
        }
    }

    async function startScanner() {
        try {
            await loadJsQR();
            
            const constraints = {
                video: {
                    deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
                    facingMode: "environment"
                }
            };
            
            videoStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (video) {
                video.srcObject = videoStream;
                video.play();
                
                if (startButton && stopButton) {
                    startButton.style.display = 'none';
                    stopButton.style.display = 'block';
                }
                
                requestAnimationFrame(tick);
            }
        } catch (error) {
            showStatus('Errore nell\'accesso alla fotocamera', 'error');
            console.error('Errore:', error);
        }
    }

    function stopScanner() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            if (video) {
                video.srcObject = null;
            }
            if (startButton && stopButton) {
                startButton.style.display = 'block';
                stopButton.style.display = 'none';
            }
        }
    }

    function tick() {
        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            try {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code && (!ultimoQRProcessato || code.data !== ultimoQRProcessato)) {
                    processQRCode(code.data);
                }
            } catch (error) {
                console.error('Errore nella decodifica del QR code:', error);
            }
        }
        if (video && video.srcObject) {
            requestAnimationFrame(tick);
        }
    }

    async function processQRCode(data) {
        try {
            console.log('Dati QR ricevuti:', data);
            
            // Previene l'elaborazione di scansioni duplicate
            if (ultimoQRProcessato === data && timeoutProcessamento) {
                console.log('Scansione QR duplicata ignorata');
                return;
            }
    
            // Cancella eventuali timeout esistenti
            if (timeoutProcessamento) {
                clearTimeout(timeoutProcessamento);
            }
    
            // Imposta i dati correnti come ultimi processati
            ultimoQRProcessato = data;
            
            // Imposta il timeout per cancellare i dati dell'ultima scansione
            timeoutProcessamento = setTimeout(() => {
                ultimoQRProcessato = null;
                timeoutProcessamento = null;
            }, RITARDO_ANTI_RIMBALZO);
    
            if (!data) {
                showStatus('QR Code vuoto o non valido', 'error');
                return;
            }
    
            let qrData;
            try {
                qrData = JSON.parse(data);
            } catch (e) {
                if (typeof data === 'string' && data.trim().length > 0) {
                    qrData = {
                        targa: data.trim(),
                        associazione: 'NON SPECIFICATA',
                        modello: 'NON SPECIFICATO'
                    };
                } else {
                    showStatus('Formato QR Code non valido', 'error');
                    return;
                }
            }
    
            console.log('Dati QR processati:', qrData);
    
            if (!qrData || !qrData.targa) {
                showStatus('QR Code non contiene una targa valida', 'error');
                return;
            }
    
            qrData.targa = qrData.targa.toUpperCase().trim();
            const statoTarga = await verificaTargaPresente(qrData.targa);
            console.log('Stato targa:', statoTarga);
    
            if (statoTarga.presente) {
                // Il mezzo è presente, registra l'uscita
                console.log('Registrazione uscita per:', qrData.targa);
                await registraUscita(statoTarga.ultimoIngresso.key);
                showStatus(`Uscita registrata per ${qrData.targa}`, 'success');
                
                // Attendi che l'uscita sia registrata prima di chiudere
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                // Il mezzo non è presente, registra l'ingresso
                console.log('Registrazione ingresso per:', qrData.targa);
                try {
                    // Se esiste un record precedente, usa quei dati come default
                    const associazione = qrData.associazione || 
                                       (statoTarga.ultimoIngresso?.associazione) || 
                                       'NON SPECIFICATA';
                    const modello = qrData.modello || 
                                  (statoTarga.ultimoIngresso?.modello) || 
                                  'NON SPECIFICATO';
                    
                    await aggiungiIngresso(qrData.targa, associazione, modello);
                    showStatus(`Ingresso registrato per ${qrData.targa}`, 'success');
                    
                    // Attendi che l'ingresso sia registrato prima di chiudere
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error('Errore durante la registrazione:', error);
                    showStatus(`Errore durante la registrazione: ${error.message}`, 'error');
                    return;
                }
            }
    
            // Chiudi scanner solo dopo che tutte le operazioni sono completate
            stopScanner();
            if (modal) {
                modal.style.display = "none";
            }
        } catch (error) {
            console.error('Errore nel processo del QR code:', error);
            showStatus(`Errore nella lettura del QR code: ${error.message}`, 'error');
        }
    }
    

    // Event listeners Scanner
    if (startButton) {
        startButton.addEventListener('click', startScanner);
    }
    if (stopButton) {
        stopButton.addEventListener('click', stopScanner);
    }
    if (cameraSelect) {
        cameraSelect.addEventListener('change', () => {
            if (videoStream) {
                stopScanner();
                startScanner();
            }
        });
    }

    // Convertire input in maiuscolo
    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
        });
    });
});

// Controlla lo stato di autenticazione
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('userInfo').textContent = `Utente: ${user.email}`;
        ascoltaAggiornamenti();
    } else {
        window.location.href = 'login.html';
    }
});