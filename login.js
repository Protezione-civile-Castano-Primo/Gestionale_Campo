// Il riferimento a auth è già disponibile dal file firebase-init.js

const rateLimiter = {
    attempts: {},
    maxAttempts: 5,
    timeWindow: 15 * 60 * 1000, // 15 minuti
    
    isBlocked: function(email) {
        const userAttempts = this.attempts[email];
        if (!userAttempts) return false;
        
        // Pulisci i tentativi vecchi
        const now = Date.now();
        if (now - userAttempts.firstAttempt > this.timeWindow) {
            delete this.attempts[email];
            return false;
        }
        
        return userAttempts.count >= this.maxAttempts;
    },
    
    recordAttempt: function(email) {
        if (!this.attempts[email]) {
            this.attempts[email] = {
                count: 1,
                firstAttempt: Date.now()
            };
        } else {
            this.attempts[email].count++;
        }
    }
};

// Funzione per validare l'input
function validateInput(email, password) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Email non valida');
    }
    
    if (password.length < 6) {
        throw new Error('La password deve essere di almeno 6 caratteri');
    }
    
    // Sanitizza l'input per prevenire XSS
    email = DOMPurify.sanitize(email);
    password = DOMPurify.sanitize(password);
    
    return { email, password };
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = document.querySelector('button[type="submit"]');
    
    try {
        // Validazione input
        const { email, password } = validateInput(emailInput.value, passwordInput.value);
        
        // Controlla rate limiting
        if (rateLimiter.isBlocked(email)) {
            throw new Error('Troppi tentativi di accesso. Riprova tra 15 minuti.');
        }
        
        // Disabilita il form durante il login
        emailInput.disabled = true;
        passwordInput.disabled = true;
        submitButton.disabled = true;
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        // Imposta cookie sicuri
        document.cookie = "session=true; Secure; HttpOnly; SameSite=Strict";
        
        // Reindirizza con token CSRF
        const csrfToken = generateCSRFToken();
        sessionStorage.setItem('csrfToken', csrfToken);
        window.location.href = `index.html?csrf=${csrfToken}`;
        
    } catch (error) {
        rateLimiter.recordAttempt(emailInput.value);
        
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        
        // Log sicuro dell'errore (evita di esporre dettagli sensibili)
        console.error('Errore di login:', error.code);
        
    } finally {
        // Riabilita il form
        emailInput.disabled = false;
        passwordInput.disabled = false;
        submitButton.disabled = false;
    }
});

// Funzione per generare token CSRF
function generateCSRFToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Pulisci i campi quando l'utente lascia la pagina
window.addEventListener('beforeunload', () => {
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
});
