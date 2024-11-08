// Configurazione di Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCF2noUuOIK0hE4ybBZCgf0H9fyNHj0lrQ",
  authDomain: "esercitazioni-pc.firebaseapp.com",
  projectId: "esercitazioni-pc",
  storageBucket: "esercitazioni-pc.appspot.com",
  messagingSenderId: "1033946281340",
  appId: "1:1033946281340:web:1d362c10456a7b961ce0f9",
  measurementId: "G-GCQYSX9HZ9",
  databaseURL: "https://esercitazioni-pc-default-rtdb.europe-west1.firebasedatabase.app"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);

// Inizializza i servizi Firebase che utilizzeremo
const auth = firebase.auth();
let database;
let analytics;

// Esporta i servizi per l'utilizzo in altri file
window.auth = auth;
window.database = database;


// Abilita la persistenza offline
if (firebase.firestore) {
  firebase.firestore().enablePersistence()
    .catch((err) => {
      if (err.code == 'failed-precondition') {
        console.log("La persistenza può essere abilitata in una sola scheda alla volta");
      } else if (err.code == 'unimplemented') {
        console.log("Il browser non supporta la persistenza offline");
      }
    });
} else {
  console.log("Firestore non è disponibile in questa versione di Firebase");
}


// Monitora lo stato della connessione
if (database) {
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
      console.log("Connesso al database");
      // Aggiorna l'UI per mostrare che sei online
      document.body.classList.remove('offline');
      document.body.classList.add('online');
    } else {
      console.log("Non connesso al database");
      // Aggiorna l'UI per mostrare che sei offline
      document.body.classList.remove('online');
      document.body.classList.add('offline');
    }
  });
}

// Verifica se il modulo database è disponibile
if (typeof firebase.database === 'function') {
  database = firebase.database();
} else {
  console.error('Il modulo database di Firebase non è disponibile');
}

// Verifica se il modulo analytics è disponibile
if (typeof firebase.analytics === 'function') {
  analytics = firebase.analytics();
} else {
  console.log('Il modulo analytics di Firebase non è disponibile');
}

// Esporta i servizi per l'utilizzo in altri file
window.auth = auth;
if (database) window.database = database;
if (analytics) window.analytics = analytics;

// Riferimento al nodo "associazioni" nel database
const associazioniRef = database ? database.ref('associazioni') : null;

// Funzione per codificare il nome dell'associazione
function encodeAssociationName(name) {
  return name.replace(/[.#$[\]]/g, '_');
}

// Funzione per decodificare il nome dell'associazione
function decodeAssociationName(encodedName) {
  return encodedName.replace(/_/g, '.');
}

// Funzione per aggiungere o aggiornare un'associazione
function aggiungiAssociazione(nome) {
  nome = nome.toUpperCase().trim();
  const encodedNome = encodeAssociationName(nome);
  if (!associazioniRef) {
    console.error('Il riferimento al database non è disponibile');
    return Promise.reject(new Error('Database non disponibile'));
  }
  if (!navigator.onLine) {
    // Se offline, salva localmente
    let offlineAssociazioni = JSON.parse(localStorage.getItem('offlineAssociazioni') || '[]');
    offlineAssociazioni.push(nome);
    localStorage.setItem('offlineAssociazioni', JSON.stringify(offlineAssociazioni));
    console.log("Associazione salvata offline");
    return Promise.resolve();
  } else {
    // Se online, salva nel database
    return associazioniRef.child(encodedNome).set(nome);
  }
}

// Funzione per ottenere tutte le associazioni
function getAssociazioni() {
  return new Promise((resolve, reject) => {
    if (!associazioniRef) {
      reject(new Error("Il riferimento al database non è disponibile"));
      return;
    }
    associazioniRef.once('value')
      .then(snapshot => {
        const associazioni = snapshot.val() || {};
        resolve(Object.values(associazioni));
      })
      .catch(error => {
        console.error("Errore nel recupero delle associazioni:", error);
        // Se offline, prova a recuperare dalla cache locale
        if (!navigator.onLine) {
          const cachedAssociazioni = localStorage.getItem('cachedAssociazioni');
          if (cachedAssociazioni) {
            resolve(JSON.parse(cachedAssociazioni));
          } else {
            reject(error);
          }
        } else {
          reject(error);
        }
      });
  });
}

// Funzione per gestire le operazioni offline
function handleOfflineOperations() {
  if (database) {
    database.goOffline();
    console.log("Modalità offline attivata");
    
    // Salva le associazioni in cache locale
    getAssociazioni().then(associazioni => {
      localStorage.setItem('cachedAssociazioni', JSON.stringify(associazioni));
    }).catch(console.error);
  }
  
  // Riconnetti quando torna online
  window.addEventListener('online', () => {
    if (database) {
      database.goOnline();
      console.log("Riconnesso al database");
      // Sincronizza i dati locali con il server
      // Implementa qui la logica di sincronizzazione
    }
  });
}

// Funzione per sincronizzare i dati offline
function sincronizzaDatiOffline() {
  if (navigator.onLine && database) {
    const offlineAssociazioni = JSON.parse(localStorage.getItem('offlineAssociazioni') || '[]');
    const promesse = offlineAssociazioni.map(nome => aggiungiAssociazione(nome));
    Promise.all(promesse).then(() => {
      localStorage.removeItem('offlineAssociazioni');
      console.log("Dati offline sincronizzati");
    }).catch(console.error);
  }
}

// Chiama questa funzione quando l'app torna online
window.addEventListener('online', sincronizzaDatiOffline);

// Aggiungi un listener per l'evento offline
window.addEventListener('offline', handleOfflineOperations);

/// Esporta le funzioni
window.aggiungiAssociazione = aggiungiAssociazione;
window.getAssociazioni = getAssociazioni;
window.encodeAssociationName = encodeAssociationName;
window.decodeAssociationName = decodeAssociationName;
window.handleOfflineOperations = handleOfflineOperations;
window.sincronizzaDatiOffline = sincronizzaDatiOffline;