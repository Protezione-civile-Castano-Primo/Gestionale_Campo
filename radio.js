// Riferimento al nodo "radio" nel database
const radioRef = database.ref('radio');

// Funzione per aggiungere una nuova assegnazione radio
function assegnaRadio(idRadio, assegnatoA, identificativo, orario) {
    return radioRef.push({
        idRadio: idRadio,
        assegnatoA: assegnatoA,
        identificativo: identificativo,
        orarioAssegnazione: orario || new Date().toLocaleTimeString(),
        riconsegnata: false
    });
}

// Funzione per riconsegnare una radio
function riconsegnaRadio(key) {
    return radioRef.child(key).update({
        riconsegnata: true,
        orarioRiconsegna: new Date().toLocaleTimeString()
    });
}

// Funzione per eliminare un'assegnazione
function eliminaAssegnazione(key) {
    return radioRef.child(key).remove();
}

// Funzione per ascoltare gli aggiornamenti in tempo reale
function ascoltaAggiornamenti() {
    radioRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const assegnazioniBody = document.querySelector('#assegnazioniTable tbody');
        const riconsegnateBody = document.querySelector('#riconsegnateTable tbody');
        
        assegnazioniBody.innerHTML = '';
        riconsegnateBody.innerHTML = '';

        for (let key in data) {
            const radio = data[key];
            const row = `
                <tr>
                    <td data-label="ID Radio">${radio.idRadio}</td>
                    <td data-label="Assegnato a">${radio.assegnatoA}</td>
                    <td data-label="Identificativo">${radio.identificativo}</td>
                    <td data-label="Orario">${radio.orarioAssegnazione}</td>
                    <td data-label="Azioni">
                        <button onclick="modificaAssegnazione('${key}')" class="btn btn-modifica">Modifica</button>
                        <button onclick="eliminaAssegnazione('${key}')" class="btn btn-elimina">Elimina</button>
                        ${!radio.riconsegnata ? `<button onclick="riconsegnaRadio('${key}')" class="btn btn-riconsegna">Riconsegna</button>` : ''}
                    </td>
                </tr>
            `;

            if (radio.riconsegnata) {
                riconsegnateBody.innerHTML += `
                    <tr>
                        <td data-label="ID Radio">${radio.idRadio}</td>
                        <td data-label="Assegnato a">${radio.assegnatoA}</td>
                        <td data-label="Identificativo">${radio.identificativo}</td>
                        <td data-label="Orario di uscita">${radio.orarioAssegnazione}</td>
                        <td data-label="Orario di riconsegna">${radio.orarioRiconsegna}</td>
                        <td data-label="Azioni">
                            <button onclick="modificaAssegnazione('${key}')" class="btn btn-modifica">Modifica</button>
                            <button onclick="eliminaAssegnazione('${key}')" class="btn btn-elimina">Elimina</button>
                        </td>
                    </tr>
                `;
            } else {
                assegnazioniBody.innerHTML += row;
            }
        }
    });
}

// Gestione del form di assegnazione
document.getElementById('assegnaRadioForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const idRadio = document.getElementById('idRadio').value;
    const assegnatoA = document.getElementById('assegnatoA').value;
    const identificativo = document.getElementById('identificativo').value;
    const orario = document.getElementById('orario').value;

    const editingKey = e.target.getAttribute('data-editing-key');

    if (editingKey) {
        // Stiamo modificando un'assegnazione esistente
        radioRef.child(editingKey).update({
            idRadio: idRadio,
            assegnatoA: assegnatoA,
            identificativo: identificativo,
            orarioAssegnazione: orario
        }).then(() => {
            document.getElementById('assegnaRadioForm').reset();
            document.querySelector('#assegnaRadioForm button[type="submit"]').textContent = 'Assegna Radio';
            e.target.removeAttribute('data-editing-key');
        });
    } else {
        // Stiamo aggiungendo una nuova assegnazione
        assegnaRadio(idRadio, assegnatoA, identificativo, orario).then(() => {
            document.getElementById('assegnaRadioForm').reset();
        });
    }
});

// Funzione per modificare un'assegnazione (da implementare)
function modificaAssegnazione(key) {
    const assegnazione = radioRef.child(key);
    assegnazione.once('value', (snapshot) => {
        const data = snapshot.val();
        
        // Popola il form con i dati attuali
        document.getElementById('idRadio').value = data.idRadio;
        document.getElementById('assegnatoA').value = data.assegnatoA;
        document.getElementById('identificativo').value = data.identificativo;
        document.getElementById('orario').value = data.orarioAssegnazione;
        
        // Cambia il testo del pulsante di invio
        const submitButton = document.querySelector('#assegnaRadioForm button[type="submit"]');
        submitButton.textContent = 'Aggiorna Assegnazione';
        
        // Aggiungi un attributo data per memorizzare la chiave dell'assegnazione da modificare
        document.getElementById('assegnaRadioForm').setAttribute('data-editing-key', key);
    });
}


// Inizializza gli aggiornamenti in tempo reale
ascoltaAggiornamenti();
// Aggiungi questo alla fine del file radio.js
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('userInfo').textContent = `Utente: ${user.email}`;
    } else {
        window.location.href = 'login.html';
    }
});

// Convertire tutti gli input in maiuscolo durante la digitazione
document.querySelectorAll('input[type="text"]').forEach(input => {
    input.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });
});