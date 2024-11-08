// Riferimenti ai nodi del database
const carraiaRef = database.ref('carraia');
const radioRef = database.ref('radio');
const volontariRef = database.ref('volontari');

// Funzioni helper
function formattaData(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('it-IT', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit'
    });
}

function calcolaDurata(inizio, fine) {
    if (!fine) return 'In corso';
    const durata = (fine - inizio) / (1000 * 60 * 60); // Durata in ore
    return durata.toFixed(2) + ' ore';
}

function getPastiInfo(pasti) {
    if (!pasti) return '-';
    return `${pasti.colazione ? 'C' : ''}${pasti.pranzo ? 'P' : ''}${pasti.cena ? 'S' : ''}`;
}

function mostraMessaggioErrore(messaggio) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = messaggio;
    container.insertBefore(errorDiv, container.firstChild);
}

function inizializzaReport() {
    Promise.all([
        carraiaRef.once('value'),
        volontariRef.once('value')
    ]).then(([carraiaSnapshot, volontariSnapshot]) => {
        const datiCarraia = carraiaSnapshot.val();
        const datiVolontari = volontariSnapshot.val();

        if (datiCarraia && datiVolontari) {
            const mezzi = Object.values(datiCarraia);
            const volontari = Object.values(datiVolontari);

            aggiornaSommario(mezzi, volontari);
            creaGraficoOrganizzazioni(mezzi);
            creaGraficoTipiMezzi(mezzi);
            creaGraficoIngressiUscite(mezzi);
            creaGraficoVolontariRuolo(volontari);
            creaGraficoDistribuzionePasti(volontari);
            popolaTabellaDettagliMezzi(mezzi);
            popolaTabellaDettagliVolontari(volontari);
        } else {
            console.log('Nessun dato disponibile');
            mostraMessaggioErrore("Nessun dato disponibile. Riprova più tardi.");
        }
    }).catch(error => {
        console.error("Errore nel recupero dei dati:", error);
        mostraMessaggioErrore("Errore nel caricamento dei dati. Riprova più tardi.");
    });
}

function aggiornaSommario(mezzi, volontari) {
    const totaleMezzi = mezzi.length;
    const mezziPresenti = mezzi.filter(m => !m.orario_uscita).length;
    const mezziUsciti = mezzi.filter(m => m.orario_uscita).length;
    const organizzazioni = new Set(mezzi.map(m => m.associazione)).size;

    const totaleVolontari = volontari.length;
    const volontariPresenti = volontari.filter(v => !v.orarioUscita).length;
    const volontariUsciti = volontari.filter(v => v.orarioUscita).length;
    const pastiPrevisti = volontari.reduce((acc, v) => {
        if (v.pasti) {
            if (v.pasti.colazione) acc++;
            if (v.pasti.pranzo) acc++;
            if (v.pasti.cena) acc++;
        }
        return acc;
    }, 0);

    document.getElementById('totale-mezzi').textContent = totaleMezzi;
    document.getElementById('mezzi-presenti').textContent = mezziPresenti;
    document.getElementById('mezzi-usciti').textContent = mezziUsciti;
    document.getElementById('totale-organizzazioni').textContent = organizzazioni;
    document.getElementById('totale-volontari').textContent = totaleVolontari;
    document.getElementById('volontari-presenti').textContent = volontariPresenti;
    document.getElementById('volontari-usciti').textContent = volontariUsciti;
    document.getElementById('pasti-previsti').textContent = pastiPrevisti;
}

function creaGraficoOrganizzazioni(mezzi) {
    const organizzazioni = {};
    mezzi.forEach(mezzo => {
        organizzazioni[mezzo.associazione] = (organizzazioni[mezzo.associazione] || 0) + 1;
    });

    const labels = Object.keys(organizzazioni);
    const data = Object.values(organizzazioni);

    new Chart(document.getElementById('organizzazioni-chart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Numero di mezzi',
                data: data,
                backgroundColor: 'rgba(0, 123, 255, 0.5)',
                borderColor: 'rgba(0, 123, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Numero di mezzi'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Mezzi per Organizzazione'
                }
            }
        }
    });
}


function creaGraficoTipiMezzi(mezzi) {
    const tipiMezzi = {};
    mezzi.forEach(mezzo => {
        tipiMezzi[mezzo.modello] = (tipiMezzi[mezzo.modello] || 0) + 1;
    });

    const labels = Object.keys(tipiMezzi);
    const data = Object.values(tipiMezzi);

    new Chart(document.getElementById('tipi-mezzi-chart'), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'Distribuzione Tipi di Mezzi'
                }
            }
        }
    });
}

function creaGraficoIngressiUscite(mezzi) {
    const ore = Array.from({length: 24}, (_, i) => i);
    const ingressi = new Array(24).fill(0);
    const uscite = new Array(24).fill(0);

    mezzi.forEach(mezzo => {
        const oraIngresso = new Date(mezzo.orario_ingresso).getHours();
        ingressi[oraIngresso]++;

        if (mezzo.orario_uscita) {
            const oraUscita = new Date(mezzo.orario_uscita).getHours();
            uscite[oraUscita]++;
        }
    });

    new Chart(document.getElementById('ingressi-uscite-chart'), {
        type: 'line',
        data: {
            labels: ore,
            datasets: [
                {
                    label: 'Ingressi',
                    data: ingressi,
                    borderColor: 'rgba(0, 123, 255, 1)',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true
                },
                {
                    label: 'Uscite',
                    data: uscite,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Ora del giorno'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Numero di mezzi'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Ingressi e Uscite per Ora'
                }
            }
        }
    });
}

function creaGraficoVolontariRuolo(volontari) {
    const ruoli = {};
    volontari.forEach(volontario => {
        ruoli[volontario.ruolo] = (ruoli[volontario.ruolo] || 0) + 1;
    });

    const labels = Object.keys(ruoli);
    const data = Object.values(ruoli);

    new Chart(document.getElementById('volontari-ruolo-chart'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'Volontari per Ruolo'
                }
            }
        }
    });
}

function creaGraficoDistribuzionePasti(volontari) {
    let colazione = 0, pranzo = 0, cena = 0;
    volontari.forEach(volontario => {
        if (volontario.pasti) {
            if (volontario.pasti.colazione) colazione++;
            if (volontario.pasti.pranzo) pranzo++;
            if (volontario.pasti.cena) cena++;
        }
    });

    new Chart(document.getElementById('distribuzione-pasti-chart'), {
        type: 'bar',
        data: {
            labels: ['Colazione', 'Pranzo', 'Cena'],
            datasets: [{
                label: 'Numero di pasti',
                data: [colazione, pranzo, cena],
                backgroundColor: [
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Numero di pasti'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Distribuzione Pasti'
                }
            }
        }
    });
}

function popolaTabellaDettagliMezzi(mezzi) {
    const tbody = document.querySelector('#mezzi-table tbody');
    tbody.innerHTML = '';

    mezzi.sort((a, b) => b.orario_ingresso - a.orario_ingresso);

    mezzi.forEach(mezzo => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = mezzo.targa;
        row.insertCell(1).textContent = mezzo.modello;
        row.insertCell(2).textContent = mezzo.associazione;
        row.insertCell(3).textContent = formattaData(mezzo.orario_ingresso);
        row.insertCell(4).textContent = mezzo.orario_uscita ? formattaData(mezzo.orario_uscita) : '-';
        row.insertCell(5).textContent = calcolaDurata(mezzo.orario_ingresso, mezzo.orario_uscita);
    });
}

function popolaTabellaDettagliVolontari(volontari) {
    const tbody = document.querySelector('#volontari-table tbody');
    tbody.innerHTML = '';

    volontari.sort((a, b) => b.orarioIngresso - a.orarioIngresso);

    volontari.forEach(volontario => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = volontario.nome;
        row.insertCell(1).textContent = volontario.cognome;
        row.insertCell(2).textContent = volontario.organizzazione;
        row.insertCell(3).textContent = volontario.ruolo;
        row.insertCell(4).textContent = formattaData(volontario.orarioIngresso);
        row.insertCell(5).textContent = volontario.orarioUscita ? formattaData(volontario.orarioUscita) : '-';
        row.insertCell(6).textContent = getPastiInfo(volontario.pasti);
    });
}

function esportaCSV() {
    Promise.all([
        carraiaRef.once('value'),
        volontariRef.once('value')
    ]).then(([carraiaSnapshot, volontariSnapshot]) => {
        const datiCarraia = carraiaSnapshot.val();
        const datiVolontari = volontariSnapshot.val();
        
        if (datiCarraia && datiVolontari) {
            const mezzi = Object.values(datiCarraia);
            const volontari = Object.values(datiVolontari);

            let csvContent = "data:text/csv;charset=utf-8,";

            // Intestazioni per i mezzi
            csvContent += "MEZZI\n";
            csvContent += "Targa,Modello,Associazione,Orario Ingresso,Orario Uscita,Durata\n";

            mezzi.forEach(mezzo => {
                const row = [
                    mezzo.targa,
                    mezzo.modello,
                    mezzo.associazione,
                    formattaData(mezzo.orario_ingresso),
                    mezzo.orario_uscita ? formattaData(mezzo.orario_uscita) : '-',
                    calcolaDurata(mezzo.orario_ingresso, mezzo.orario_uscita)
                ].join(',');
                csvContent += row + "\n";
            });

            // Aggiungi una riga vuota tra mezzi e volontari
            csvContent += "\n";

            // Intestazioni per i volontari
            csvContent += "VOLONTARI\n";
            csvContent += "Nome,Cognome,Organizzazione,Ruolo,Ingresso,Uscita,Pasti\n";

            volontari.forEach(volontario => {
                const row = [
                    volontario.nome,
                    volontario.cognome,
                    volontario.organizzazione,
                    volontario.ruolo,
                    formattaData(volontario.orarioIngresso),
                    volontario.orarioUscita ? formattaData(volontario.orarioUscita) : '-',
                    getPastiInfo(volontario.pasti)
                ].join(',');
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "report_completo.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('Nessun dato da esportare');
        }
    }).catch(error => {
        console.error("Errore durante l'esportazione dei dati:", error);
        alert("Si è verificato un errore durante l'esportazione dei dati.");
    });
}

// Inizializzazione della pagina
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            inizializzaReport();
        } else {
            window.location.href = 'login.html';
        }
    });
});

// Event listener per il pulsante di esportazione CSV
document.getElementById('esporta-csv').addEventListener('click', esportaCSV);