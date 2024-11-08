// Riferimento al nodo "volontari" nel database
const volontariRef = window.database.ref('volontari');

// Mappa degli allergeni con nomi completi
const allergeniMap = {
    'glutine': 'Cereali contenenti glutine',
    'crostacei': 'Crostacei e derivati',
    'uova': 'Uova e derivati',
    'pesce': 'Pesce e derivati',
    'arachidi': 'Arachidi e derivati',
    'soia': 'Soia e derivati',
    'latte': 'Latte e derivati',
    'frutta_guscio': 'Frutta con guscio',
    'sedano': 'Sedano e derivati',
    'senape': 'Senape e derivati',
    'sesamo': 'Sesamo e derivati',
    'solfiti': 'Anidride solforosa e solfiti',
    'lupini': 'Lupini e derivati',
    'molluschi': 'Molluschi e derivati'
};

// Funzione per creare una card per un volontario
// Funzione per creare una card per un volontario
function creaCardVolontario(volontario) {
    console.log("Dati volontario ricevuti:", volontario);
    const card = document.createElement('div');
    card.className = 'card';

    const nomeCognome = document.createElement('h2');
    nomeCognome.textContent = `${volontario.nome} ${volontario.cognome}`;
    card.appendChild(nomeCognome);

    const associazione = document.createElement('p');
    associazione.textContent = `Associazione: ${volontario.organizzazione}`;
    card.appendChild(associazione);

    const allergeni = document.createElement('div');
    allergeni.className = 'allergeni';
    allergeni.innerHTML = '<strong>Allergeni:</strong><br>';
    
    if (Array.isArray(volontario.allergeni) && volontario.allergeni.length > 0) {
        volontario.allergeni.forEach(allergene => {
            const span = document.createElement('span');
            if (typeof allergene === 'string') {
                if (allergene.startsWith('altro:')) {
                    const altroAllergeneValue = allergene.substring(6).trim();
                    span.textContent = altroAllergeneValue.charAt(0).toUpperCase() + altroAllergeneValue.slice(1);
                } else {
                    span.textContent = allergeniMap[allergene] || allergene;
                }
                allergeni.appendChild(span);
                allergeni.appendChild(document.createElement('br'));
            }
        });
    } else {
        allergeni.innerHTML += 'Nessuno';
    }
    
    card.appendChild(allergeni);

    const pasti = document.createElement('div');
    pasti.className = 'pasti';
    pasti.innerHTML = '<strong>Pasti:</strong> ';
    if (volontario.pasti) {
        const pastiRichiesti = [];
        if (volontario.pasti.colazione) pastiRichiesti.push('Colazione');
        if (volontario.pasti.pranzo) pastiRichiesti.push('Pranzo');
        if (volontario.pasti.cena) pastiRichiesti.push('Cena');
        if (pastiRichiesti.length > 0) {
            pasti.innerHTML += pastiRichiesti.map(pasto => `<span>${pasto}</span>`).join('');
        } else {
            pasti.innerHTML += 'Nessuno';
        }
    } else {
        pasti.innerHTML += 'Nessuno';
    }
    card.appendChild(pasti);

    return card;
}

// Funzione per aggiornare il report dei pasti
function aggiornaReportPasti(volontari) {
    let colazione = 0, pranzo = 0, cena = 0;
    
    for (let key in volontari) {
        const volontario = volontari[key];
        // Conta i pasti solo se il volontario non ha orario di uscita (è presente)
        if (!volontario.orarioUscita && volontario.pasti) {
            if (volontario.pasti.colazione) colazione++;
            if (volontario.pasti.pranzo) pranzo++;
            if (volontario.pasti.cena) cena++;
        }
    }

    document.getElementById('numeroColazione').textContent = colazione;
    document.getElementById('numeroPranzo').textContent = pranzo;
    document.getElementById('numeroCena').textContent = cena;
}

// Funzione per caricare e visualizzare i volontari con allergeni
function caricaVolontariConAllergeni() {
    const allergeniCards = document.getElementById('allergeniCards');
    
    volontariRef.on('value', (snapshot) => {
        allergeniCards.innerHTML = '';
        const volontari = snapshot.val();
        const volontariConAllergeni = [];

        for (let key in volontari) {
            const volontario = volontari[key];
            // Verifica che il volontario sia presente (non ha orario di uscita) e ha allergeni
            if (!volontario.orarioUscita && volontario.allergeni && Array.isArray(volontario.allergeni) && volontario.allergeni.length > 0) {
                volontariConAllergeni.push(volontario);
            }
        }

        // Ordina i volontari per cognome e nome
        volontariConAllergeni.sort((a, b) => {
            if (a.cognome === b.cognome) {
                return a.nome.localeCompare(b.nome);
            }
            return a.cognome.localeCompare(b.cognome);
        });

        volontariConAllergeni.forEach((volontario) => {
            const card = creaCardVolontario(volontario);
            allergeniCards.appendChild(card);
        });

        aggiornaReportPasti(volontari); // Passa tutti i volontari per il conteggio corretto
    });
}

// Funzione di ricerca
function cercaVolontari() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const nome = card.querySelector('h2').textContent.toLowerCase();
        const associazione = card.querySelector('p').textContent.toLowerCase();
        const allergeni = card.querySelector('.allergeni').textContent.toLowerCase();
        if (nome.includes(searchTerm) || associazione.includes(searchTerm) || allergeni.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Event listener per la ricerca
document.getElementById('searchInput').addEventListener('input', cercaVolontari);

// Ottimizzazione per dispositivi touch
if ('ontouchstart' in window) {
    document.body.addEventListener('touchstart', function() {}, {passive: true});
}

// Carica i volontari quando la pagina è pronta
document.addEventListener('DOMContentLoaded', caricaVolontariConAllergeni);