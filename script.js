// =======================================
//  CFL TEST DIGITALIZATI – SCRIPT CENTRALE
// =======================================

// ✅ Controllo autenticazione
function checkAuth() {
  if (localStorage.getItem("isRegistered") !== "true") {
    window.location.href = "index.html";
  }
}

// ✅ Data in formato italiano (offset: -1 ieri, 0 oggi, +1 domani)
function getTestDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("it-IT");
}

// ✅ Genera ID utente univoco
function generateUserId() {
  return "user_" + Date.now();
}

// ✅ URL del tuo script Google DEFINITIVO
const GAS_URL = "https://script.google.com/macros/s/AKfycbyvwq5vFv6VUTG_Pu2C3FXDSNLqptL0dJKPjrmipYS9hwAOQkh4SdVgee961lAjem5ZLw/exec";

// =======================
//  INVII VERSO GOOGLE SHEETS (CENTRALIZZATI)
// =======================

// ✅ Invio registrazione
async function sendUserRegistration(userData) {
  const payload = { action: "registrazione", ...userData };
  return await sendToSheet(payload);
}

// ✅ Invio risultati test (test1/test2/test3)
async function sendTestDataToSheet(testResultData) {
  const payload = { action: "esito_test", ...testResultData };
  return await sendToSheet(payload);
}

// ✅ Invio evento login
async function sendLoginEvent(userData) {
  const payload = { action: "login", ...userData, loginDate: new Date().toISOString() };
  return await sendToSheet(payload);
}

// ✅ Funzione unica di comunicazione con Google Sheets (con fallback no-cors)
async function sendToSheet(payload) {
  try {
    console.log("📤 Invio dati a Google Sheets...", payload);
    const resp = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    console.log("✅ Risposta JSON:", json);
    return json;
  } catch (err) {
    console.warn("⚠️ CORS bloccato, passo al fallback no-cors:", err);
  }

  try {
    await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    console.log("✅ Inviato in modalità no-cors (risposta opaca)");
    return { ok: true, opaque: true };
  } catch (e2) {
    console.error("❌ Invio fallito anche in no-cors:", e2);
    return null;
  }
}

// =======================
//  REGISTRAZIONE (index.html)
// =======================
function registerUser() {
  const userData = {
    userId: generateUserId(),
    cognome: document.getElementById("cognome").value.trim(),
    nome: document.getElementById("nome").value.trim(),
    email: document.getElementById("email").value.trim(),
    telefono: document.getElementById("telefono").value.trim(),
    registrationDate: new Date().toISOString(),
  };

  localStorage.setItem("userData", JSON.stringify(userData));
  localStorage.setItem("isRegistered", "true");

  sendUserRegistration(userData);
  window.location.href = "test-selection.html";
}

// =======================
//  ESPORTAZIONE SU WINDOW (MODIFICA COINVOLTA)
//  Garantisce che le pagine che usano window.* (es. test1)
//  vedano sempre queste funzioni senza duplicazioni locali.
// =======================
window.checkAuth = checkAuth;
window.getTestDate = getTestDate;
window.generateUserId = generateUserId;

window.sendToSheet = sendToSheet;
window.sendUserRegistration = sendUserRegistration;
window.sendTestDataToSheet = sendTestDataToSheet;
window.sendLoginEvent = sendLoginEvent;
window.registerUser = registerUser;





