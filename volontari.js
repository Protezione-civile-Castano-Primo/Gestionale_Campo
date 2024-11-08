// Riferimento al nodo "volontari" nel database
const volontariRef = database.ref('volontari');

let isSubmitting = false;

const autoCompleteAssociazione = new autoComplete({
    selector: "#organizzazione",
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
                autoCompleteAssociazione.input.value = selection.toUpperCase();
            }
        }
    }
});


document.getElementById('organizzazione').addEventListener('input', function() {
    this.value = this.value.toUpperCase();
});

function registraVolontario(nome, cognome, codiceFiscale, organizzazione, ruolo, orarioIngresso, orarioUscita, pasti, allergeni, note, volontarioKey) {
    return new Promise((resolve, reject) => {
        const nuovoVolontario = {
            nome,
            cognome,
            codiceFiscale: codiceFiscale.replace(/\s/g, '').toUpperCase(),
            organizzazione,
            ruolo,
            orarioIngresso,
            orarioUscita,
            pasti,
            allergeni,
            note,
            presente: !orarioUscita,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        volontariRef.child(volontarioKey).transaction((currentData) => {
            if (currentData === null) {
                return nuovoVolontario;
            } else {
                // Abort the transaction
                return;
            }
        }, (error, committed, snapshot) => {
            if (error) {
                console.error('Errore durante la transazione:', error);
                reject(error);
            } else if (!committed) {
                console.log('Transazione abortita, il volontario già esiste');
                reject({
                    code: 'VOLONTARIO_ESISTENTE',
                    message: 'Questo volontario è già stato registrato.',
                    existingData: snapshot.val()
                });
            } else {
                console.log('Volontario registrato con successo');
                resolve();
            }
        });
    });
}

// Funzione per segnare l'uscita di un volontario
function segnaUscitaVolontario(key) {
    return volontariRef.child(key).update({
        orarioUscita: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        // Aggiorna il report dei pasti dopo aver segnato l'uscita
        volontariRef.once('value', snapshot => {
            aggiornaReportPasti(snapshot.val());
        });
    });
}

// Funzione per eliminare un volontario
function eliminaVolontario(key) {
    if (confirm("Sei sicuro di voler eliminare questo volontario?")) {
        volontariRef.child(key).remove()
            .then(() => {
                console.log('Volontario eliminato con successo');
                alert('Volontario eliminato con successo');
                // Aggiorna immediatamente la visualizzazione della tabella
                aggiornaTabelle();
            })
            .catch((error) => {
                console.error('Errore durante l\'eliminazione:', error);
                alert('Si è verificato un errore durante l\'eliminazione. Riprova.');
            });
    }
}
// Funzione per formattare la data
function formattaData(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('it-IT', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Europe/Rome' // Assicurati che questo sia il fuso orario corretto per l'Italia
    });
}

// Funzione per aggiornare il report dei pasti
function aggiornaReportPasti(volontari) {
    let colazione = 0, pranzo = 0, cena = 0;
    
    for (let key in volontari) {
        const v = volontari[key];
        // Conta i pasti solo se il volontario è presente (non ha un orario di uscita)
        if (!v.orarioUscita && v.pasti) {
            if (v.pasti.colazione) colazione++;
            if (v.pasti.pranzo) pranzo++;
            if (v.pasti.cena) cena++;
        }
    }

    document.getElementById('numeroColazione').textContent = colazione;
    document.getElementById('numeroPranzo').textContent = pranzo;
    document.getElementById('numeroCena').textContent = cena;
}

// Funzione per ascoltare gli aggiornamenti in tempo reale
function ascoltaAggiornamenti() {
    volontariRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            aggiornaTabella('volontariPresentiTable', data, (v) => !v.orarioUscita && v.ruolo !== 'Ospite');
            aggiornaTabella('volontariUscitiTable', data, (v) => v.orarioUscita && v.ruolo !== 'Ospite');
            aggiornaTabella('ospitiTable', data, (v) => v.ruolo === 'Ospite');
            aggiornaReportPasti(data);
        } else {
            console.log('Nessun dato disponibile nel database');
            // Puoi aggiungere qui la logica per gestire il caso in cui non ci sono dati
            // Ad esempio, mostrare un messaggio all'utente o resettare le tabelle
        }
    }, (error) => {
        console.error('Errore nel recupero dei dati:', error);
        // Gestisci l'errore, ad esempio mostrando un messaggio all'utente
    });
}

function aggiornaTabella(tableId, data, filterFn) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    const headers = Array.from(document.querySelectorAll(`#${tableId} thead th`)).map(th => th.textContent.trim());
    tableBody.innerHTML = '';

    if (data && typeof data === 'object') {
        Object.entries(data).forEach(([key, volontario]) => {
            if (filterFn(volontario)) {
                const row = document.createElement('tr');
                headers.forEach(header => {
                    const cell = document.createElement('td');
                    cell.setAttribute('data-label', header);
                    switch(header) {
                        case 'Nome':
                            cell.textContent = volontario.nome || '';
                            break;
                        case 'Cognome':
                            cell.textContent = volontario.cognome || '';
                            break;
                        case 'Codice Fiscale':
                            cell.textContent = volontario.codiceFiscale || '';
                            break;
                        case 'Associazione':
                            cell.textContent = volontario.organizzazione || '';
                            break;
                        case 'Ruolo':
                            cell.textContent = volontario.ruolo || '';
                            break;
                        case 'Ingresso':
                            cell.textContent = formattaData(volontario.orarioIngresso) || '';
                            break;
                        case 'Uscita':
                            cell.textContent = formattaData(volontario.orarioUscita) || '';
                            break;
                        case 'Pasti':
                            cell.textContent = getPastiInfo(volontario.pasti);
                            break;
                        case 'Note':
                            cell.textContent = volontario.note || '';
                            break;
                        case 'Azioni':
                            cell.innerHTML = `
                                <button onclick="modificaVolontario('${key}')" class="btn btn-modifica">Modifica</button>
                                <button onclick="eliminaVolontario('${key}')" class="btn btn-elimina">Elimina</button>
                                ${!volontario.orarioUscita ? `<button onclick="segnaUscitaVolontario('${key}')" class="btn btn-uscita">Segna Uscita</button>` : ''}
                            `;
                            break;
                    }
                    row.appendChild(cell);
                });
                tableBody.appendChild(row);
            }
        });
    } else {
        console.log(`Nessun dato disponibile per la tabella ${tableId}`);
    }
}

function aggiornaTabelle() {
    volontariRef.once('value')
        .then((snapshot) => {
            const data = snapshot.val();
            if (data) {
                aggiornaTabella('volontariPresentiTable', data, (v) => !v.orarioUscita && v.ruolo !== 'Ospite');
                aggiornaTabella('volontariUscitiTable', data, (v) => v.orarioUscita && v.ruolo !== 'Ospite');
                aggiornaTabella('ospitiTable', data, (v) => v.ruolo === 'Ospite');
                aggiornaReportPasti(data);
            } else {
                console.log('Nessun dato disponibile nel database');
                // Pulisci le tabelle
                ['volontariPresentiTable', 'volontariUscitiTable', 'ospitiTable'].forEach(tableId => {
                    const tableBody = document.querySelector(`#${tableId} tbody`);
                    if (tableBody) tableBody.innerHTML = '';
                });
                aggiornaReportPasti({});
            }
        })
        .catch((error) => {
            console.error('Errore nel recupero dei dati:', error);
        });
}

function getPastiInfo(pasti) {
    if (!pasti) return '';
    return `${pasti.colazione ? 'C' : ''}${pasti.pranzo ? 'P' : ''}${pasti.cena ? 'S' : ''}`;
}

let currentlyEditingKey = null;

// Funzione per modificare un volontario
// Sostituisci la funzione modificaVolontario esistente con questa versione
function modificaVolontario(key) {
    currentlyEditingKey = key;
    volontariRef.child(key).once('value', (snapshot) => {
        const volontario = snapshot.val();
        document.getElementById('nome').value = volontario.nome || '';
        document.getElementById('cognome').value = volontario.cognome || '';
        document.getElementById('codiceFiscale').value = volontario.codiceFiscale || '';
        document.getElementById('organizzazione').value = volontario.organizzazione || '';
        document.getElementById('ruolo').value = volontario.ruolo || '';
        
        // Gestione corretta degli orari considerando il fuso orario
        function formatDateTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        document.getElementById('orarioIngresso').value = formatDateTime(volontario.orarioIngresso);
        document.getElementById('orarioUscita').value = formatDateTime(volontario.orarioUscita);
        
        document.getElementById('colazione').checked = volontario.pasti ? volontario.pasti.colazione : false;
        document.getElementById('pranzo').checked = volontario.pasti ? volontario.pasti.pranzo : false;
        document.getElementById('cena').checked = volontario.pasti ? volontario.pasti.cena : false;
        
        // Gestione degli allergeni
        const allergeniCheckboxes = document.querySelectorAll('input[name="allergeni"]');
        allergeniCheckboxes.forEach(checkbox => {
            checkbox.checked = volontario.allergeni && volontario.allergeni.includes(checkbox.value);
        });
        
        // Gestione dell'altro allergene
        const altroAllergeneInput = document.getElementById('altroAllergene');
        if (altroAllergeneInput) {
            const altroAllergene = volontario.allergeni ? volontario.allergeni.find(a => a.startsWith('altro:')) : null;
            if (altroAllergene) {
                const altroAllergeneValue = altroAllergene.substring(6).trim();
                altroAllergeneInput.value = altroAllergeneValue.charAt(0).toUpperCase() + altroAllergeneValue.slice(1);
            } else {
                altroAllergeneInput.value = '';
            }
        }
        
        document.getElementById('note').value = volontario.note || '';

        // Cambia il testo del pulsante
        const submitButton = document.querySelector('#registraVolontarioForm button[type="submit"]');
        submitButton.textContent = 'Salva Modifiche';
    });
}

function salvaVolontario(e) {
    e.preventDefault();
    const nome = document.getElementById('nome').value;
    const cognome = document.getElementById('cognome').value;
    const codiceFiscale = document.getElementById('codiceFiscale').value;
    const organizzazione = document.getElementById('organizzazione').value;
    const ruolo = document.getElementById('ruolo').value;
    const orarioIngresso = document.getElementById('orarioIngresso').value;
    const orarioUscita = document.getElementById('orarioUscita').value;
    const pasti = {
        colazione: document.getElementById('colazione').checked,
        pranzo: document.getElementById('pranzo').checked,
        cena: document.getElementById('cena').checked
    };
    
    const allergeniCheckboxes = document.querySelectorAll('input[name="allergeni"]:checked');
    const allergeni = Array.from(allergeniCheckboxes).map(cb => cb.value);
    
    const altroAllergene = document.getElementById('altroAllergene').value.trim();
    if (altroAllergene) {
        allergeni.push(`altro:${altroAllergene}`);
    }
    
    const note = document.getElementById('note').value;

    function saveDateTime(dateTimeString) {
        if (!dateTimeString) return null;
        const date = new Date(dateTimeString);
        return date.toISOString();
    }

    const updatedData = {
        nome, cognome, codiceFiscale, organizzazione, ruolo, 
        orarioIngresso: saveDateTime(orarioIngresso),
        orarioUscita: saveDateTime(orarioUscita),
        pasti, allergeni, note,
        presente: !orarioUscita
    };

    volontariRef.child(currentlyEditingKey).update(updatedData).then(() => {
        document.getElementById('registraVolontarioForm').reset();
        console.log('Volontario aggiornato con successo');
        // Resetta il form e il testo del pulsante
        const submitButton = document.querySelector('#registraVolontarioForm button[type="submit"]');
        submitButton.textContent = 'Registra Volontario';
        currentlyEditingKey = null;
    }).catch((error) => {
        console.error('Errore durante l\'aggiornamento:', error);
        alert('Si è verificato un errore durante l\'aggiornamento.');
    });
}


// Gestione del form di registrazione
function handleFormSubmit(e) {
    e.preventDefault();
    
    if (isSubmitting) {
        console.log('Invio già in corso, ignorato');
        return;
    }
    
    isSubmitting = true;
    const submitButton = document.querySelector('#registraVolontarioForm button[type="submit"]');
    submitButton.disabled = true;

    const nome = document.getElementById('nome').value.trim().toUpperCase();
    const cognome = document.getElementById('cognome').value.trim().toUpperCase();
    const codiceFiscale = document.getElementById('codiceFiscale').value.trim().toUpperCase();
    const organizzazione = document.getElementById('organizzazione').value.trim().toUpperCase();
    const ruolo = document.getElementById('ruolo').value;
    const orarioIngresso = document.getElementById('orarioIngresso').value;
    const orarioUscita = document.getElementById('orarioUscita').value;
    const pasti = {
        colazione: document.getElementById('colazione').checked,
        pranzo: document.getElementById('pranzo').checked,
        cena: document.getElementById('cena').checked
    };
    
    const allergeniCheckboxes = document.querySelectorAll('input[name="allergeni"]:checked');
    const allergeni = Array.from(allergeniCheckboxes).map(cb => cb.value);
    
    const altroAllergene = document.getElementById('altroAllergene').value.trim();
    if (altroAllergene) {
        allergeni.push(`altro:${altroAllergene}`);
    }
    
    const note = document.getElementById('note').value.trim();

    if (!nome || !cognome || !codiceFiscale || !organizzazione || !ruolo || !orarioIngresso) {
        alert('Per favore, compila tutti i campi obbligatori.');
        isSubmitting = false;
        submitButton.disabled = false;
        return;
    }

    if (currentlyEditingKey) {
        // Modifica di un volontario esistente
        const updatedData = {
            nome, cognome, codiceFiscale, organizzazione, ruolo,
            orarioIngresso: saveDateTime(orarioIngresso),
            orarioUscita: saveDateTime(orarioUscita),
            pasti, allergeni, note,
            presente: !orarioUscita,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        volontariRef.child(currentlyEditingKey).update(updatedData)
            .then(() => {
                document.getElementById('registraVolontarioForm').reset();
                alert('Volontario aggiornato con successo');
                submitButton.textContent = 'Registra Volontario';
                currentlyEditingKey = null;
            })
            .catch((error) => {
                console.error('Errore durante l\'aggiornamento:', error);
                alert('Si è verificato un errore durante l\'aggiornamento. Riprova.');
            })
            .finally(() => {
                isSubmitting = false;
                setTimeout(() => {
                    submitButton.disabled = false;
                }, 2000);
            });
    } else {
        // Registrazione di un nuovo volontario
        const volontarioKey = `${codiceFiscale}_${orarioIngresso}`;
        
        registraVolontario(nome, cognome, codiceFiscale, organizzazione, ruolo, orarioIngresso, orarioUscita, pasti, allergeni, note, volontarioKey)
            .then(() => {
                document.getElementById('registraVolontarioForm').reset();
                alert('Volontario registrato con successo');
            })
            .catch((error) => {
                console.error('Errore durante la registrazione:', error);
                if (error.code === 'VOLONTARIO_ESISTENTE') {
                    const conferma = confirm(`${error.message}\nVuoi aggiornare i dati del volontario esistente?`);
                    if (conferma) {
                        // Aggiorna i dati del volontario esistente
                        volontariRef.child(volontarioKey).update({
                            nome, cognome, organizzazione, ruolo, orarioIngresso, orarioUscita, pasti, allergeni, note,
                            presente: !orarioUscita,
                            timestamp: firebase.database.ServerValue.TIMESTAMP
                        }).then(() => {
                            alert('Dati del volontario aggiornati con successo');
                            document.getElementById('registraVolontarioForm').reset();
                        }).catch((updateError) => {
                            console.error('Errore durante l\'aggiornamento:', updateError);
                            alert('Si è verificato un errore durante l\'aggiornamento. Riprova.');
                        });
                    }
                } else {
                    alert('Si è verificato un errore durante la registrazione. Riprova.');
                }
            })
            .finally(() => {
                isSubmitting = false;
                setTimeout(() => {
                    submitButton.disabled = false;
                }, 2000);
            
             // Aggiorna la lista dei responsabili nel PCA
                if (typeof caricaResponsabili === 'function') {
                    caricaResponsabili();
                }   
            });
    }
}

document.getElementById('registraVolontarioForm').onsubmit = handleFormSubmit;

// Inizializza gli aggiornamenti in tempo reale
ascoltaAggiornamenti();

// Gestione dell'autenticazione
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('userInfo').textContent = `Utente: ${user.email}`;
    } else {
        window.location.href = 'login.html';
    }
});

// Convertire tutti gli input di testo in maiuscolo durante la digitazione
document.querySelectorAll('input[type="text"]').forEach(input => {
    input.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });
});

// Cercare i volontari nella tabella
function cercaVolontari() {
    const input = document.getElementById('searchInput');
    const filter = input.value.toUpperCase();
    const tables = document.querySelectorAll('#volontariPresentiTable, #volontariUscitiTable');

    tables.forEach(table => {
        const rows = table.getElementsByTagName('tr');
        for (let i = 1; i < rows.length; i++) {
            const tdNome = rows[i].getElementsByTagName('td')[0];
            const tdCognome = rows[i].getElementsByTagName('td')[1];
            const tdCodiceFiscale = rows[i].getElementsByTagName('td')[2];
            if (tdNome && tdCognome && tdCodiceFiscale) {
                const txtNome = tdNome.textContent || tdNome.innerText;
                const txtCognome = tdCognome.textContent || tdCognome.innerText;
                const txtCodiceFiscale = tdCodiceFiscale.textContent || tdCodiceFiscale.innerText;
                if (txtNome.toUpperCase().indexOf(filter) > -1 || 
                    txtCognome.toUpperCase().indexOf(filter) > -1 || 
                    txtCodiceFiscale.toUpperCase().indexOf(filter) > -1) {
                    rows[i].style.display = "";
                } else {
                    rows[i].style.display = "none";
                }
            }
        }
    });
}

// Aggiungi l'event listener al form
document.addEventListener('DOMContentLoaded', () => {
    // ... (altri event listener esistenti)

    const esportaButton = Array.from(document.getElementsByTagName('button')).find(button => button.textContent.trim() === 'Esporta Dati');
    if (esportaButton) {
        esportaButton.addEventListener('click', esportaDati);
    }

    const importaInput = document.createElement('input');
    importaInput.type = 'file';
    importaInput.accept = '.csv';
    importaInput.style.display = 'none';
    document.body.appendChild(importaInput);

    const importaButton = Array.from(document.getElementsByTagName('button')).find(button => button.textContent.trim() === 'Importa Dati');
    if (importaButton) {
        importaButton.addEventListener('click', () => {
            importaInput.click();
        });
    }

    importaInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            importaDati(file);
        }
    });
});

// Funzione helper per salvare le date
function saveDateTime(dateTimeString) {
    if (!dateTimeString) return null;
    const date = new Date(dateTimeString);
    return date.toISOString();
}

// Aggiungi questo listener dopo aver definito la funzione
document.getElementById('searchInput').addEventListener('keyup', cercaVolontari);

// Funzione di esportazione 
function esportaDati() {
    volontariRef.once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            alert('Nessun dato da esportare');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Nome,Cognome,Codice Fiscale,Organizzazione,Ruolo,Ingresso,Uscita,Colazione,Pranzo,Cena,Allergeni,Note\n";

        Object.values(data).forEach(v => {
            const allergeni = Array.isArray(v.allergeni) ? v.allergeni.join('; ') : '';
            const row = [
                v.nome,
                v.cognome,
                v.codiceFiscale,
                v.organizzazione,
                v.ruolo,
                formattaData(v.orarioIngresso),
                formattaData(v.orarioUscita),
                v.pasti?.colazione ? 'Sì' : 'No',
                v.pasti?.pranzo ? 'Sì' : 'No',
                v.pasti?.cena ? 'Sì' : 'No',
                allergeni,
                v.note
            ].map(cell => `"${cell || ''}"`).join(',');
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "volontari_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// Funzione per importare i dati (aggiungi questa nuova funzione)
function importaDati(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        const headers = rows[0].split(',').map(header => header.trim().replace(/^"(.*)"$/, '$1'));

        const volontariImportati = [];

        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split(',').map(value => value.trim().replace(/^"(.*)"$/, '$1'));
            if (values.length === headers.length) {
                const volontario = {};
                headers.forEach((header, index) => {
                    volontario[header] = values[index];
                });
                
                const volontarioMappato = {
                    nome: volontario['Nome'],
                    cognome: volontario['Cognome'],
                    codiceFiscale: volontario['Codice Fiscale'],
                    organizzazione: volontario['Organizzazione'],
                    ruolo: volontario['Ruolo'],
                    pasti: {
                        colazione: volontario['Colazione'] === 'Sì',
                        pranzo: volontario['Pranzo'] === 'Sì',
                        cena: volontario['Cena'] === 'Sì'
                    },
                    allergeni: volontario['Allergeni'] ? volontario['Allergeni'].split('; ') : [],
                    note: volontario['Note'],
                    orarioIngresso: convertToISODate(volontario['Ingresso']),
                    orarioUscita: convertToISODate(volontario['Uscita'])
                };

                volontarioMappato.presente = !volontarioMappato.orarioUscita;

                if (volontarioMappato.nome && volontarioMappato.cognome && volontarioMappato.codiceFiscale) {
                    volontariImportati.push(volontarioMappato);
                }
            }
        }

        if (volontariImportati.length === 0) {
            alert('Nessun volontario valido da importare');
            return;
        }

        const importPromises = volontariImportati.map(volontario => 
            volontariRef.push(volontario)
        );

        Promise.all(importPromises)
            .then(() => {
                alert(`Importazione completata con successo! ${volontariImportati.length} volontari importati.`);
                aggiornaTabelle();
            })
            .catch(error => {
                console.error('Errore durante l\'importazione:', error);
                alert('Si è verificato un errore durante l\'importazione.');
            });
    };
    reader.readAsText(file);
}

function convertToISODate(dateString) {
    if (!dateString) return null;
    const [date, time] = dateString.split(', ');
    const [day, month, year] = date.split('/');
    const [hours, minutes] = time.split(':');
    const isoDate = new Date(year, month - 1, day, hours, minutes);
    return isoDate.toISOString();
}