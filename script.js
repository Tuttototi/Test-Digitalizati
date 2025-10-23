// Check if user is authenticated
function checkAuth() {
  if (localStorage.getItem("isRegistered") !== "true") {
    window.location.href = "index.html";
  }
}

// Format date in Italian
function formatDate(date) {
  return new Date(date).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Get date for test (offset: -1 = ieri, 0 = oggi, 1 = domani)
function getTestDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('it-IT');
}

// Save test results locally
function saveTestResults(testName, score, total) {
  const results = JSON.parse(localStorage.getItem("testResults") || "{}");
  const userData = JSON.parse(localStorage.getItem("userData"));

  results[testName] = {
    score: score,
    total: total,
    percentage: Math.round((score / total) * 100),
    date: new Date().toISOString(),
    user: userData.nome + " " + userData.cognome,
  };

  localStorage.setItem("testResults", JSON.stringify(results));
}

// Genera un User ID univoco (oppure sostituisci con la tua funzione)
function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Invia i dati di registrazione utente al Google Sheet
async function sendUserRegistration(userData) {
  const url = "https://script.google.com/macros/s/AKfycbzvFOMzLJft5ndvsEipmZJWA9YAGNNaRhN08TE0jGFacND__bLsANleDgRzZwq7oF79gQ/exec";
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    const json = await resp.json();
    console.log("Registrazione inviata:", json);
    return json;
  } catch (err) {
    console.error("Errore invio utente:", err);
    return null;
  }
}

// Funzione da chiamare DOPO la validazione e salvataggio del form di registrazione
function registerUser() {
  const userData = {
    userId: generateUserId(),
    nome: document.getElementById("nome").value.trim(),
    cognome: document.getElementById("cognome").value.trim(),
    email: document.getElementById("email").value.trim(),
    telefono: document.getElementById("telefono").value.trim()
  };

  localStorage.setItem("userData", JSON.stringify(userData));
  localStorage.setItem("isRegistered", "true");

  // Invio al tuo Google Apps Script
  sendUserRegistration(userData);

  // Puoi poi fare redirect o mostrare conferma
  window.location.href = "test-selection.html";
}

