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

// -----------------------
// Utilità normalizzazione
// -----------------------
function normalizeEmail(v) {
  return (v || "").trim().toLowerCase();
}
function normalizePhone(v) {
  return (v || "").replace(/\D+/g, ""); // solo cifre
}
function simpleHash(str) {
  let h = 0, i, chr;
  if (str.length === 0) return "0";
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    h = (h << 5) - h + chr;
    h |= 0;
  }
  return String(Math.abs(h));
}

// ✅ Genera ID utente univoco (deterministico se c'è email)
function generateUserId(baseEmail) {
  const e = normalizeEmail(baseEmail || "");
  if (e) return "user_" + simpleHash(e);
  return "user_" + Date.now();
}

// ✅ URL del tuo script Google DEFINITIVO
const GAS_URL = "https://script.google.com/macros/s/AKfycbyvwq5vFv6VUTG_Pu2C3FXDSNLqptL0dJKPjrmipYS9hwAOQkh4SdVgee961lAjem5ZLw/exec";

// =======================
//  Invii verso Google Sheets (centralizzati)
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

// ===============
//  Anti-doppio invio (IDEMPOTENZA CLIENT)
// ===============
const DEFAULT_DEDUP_WINDOW_MS = 30_000; // invii normali (test, login)
const REGISTER_DEDUP_WINDOW_MS = 365 * 24 * 60 * 60 * 1000; // 1 anno per registrazione

if (!window.__pendingSends) window.__pendingSends = new Map();

function getDedupTtlMs(action) {
  return action === "registrazione" ? REGISTER_DEDUP_WINDOW_MS : DEFAULT_DEDUP_WINDOW_MS;
}

function loadIdemHistory() {
  try { return JSON.parse(localStorage.getItem("idempotentHistory") || "{}"); }
  catch { return {}; }
}
function saveIdemHistory(map) {
  try { localStorage.setItem("idempotentHistory", JSON.stringify(map)); } catch {}
}

/**
 * Crea una chiave stabile per l'idempotenza lato client.
 * - Per "registrazione": usa email/telefono (così è forte nel tempo).
 * - Per altri invii: userId + test + data + score.
 */
function buildIdempotencyKey(payload) {
  const action = payload.action || "generic";
  if (action === "registrazione") {
    const email = normalizeEmail(payload.email);
    const tel = normalizePhone(payload.telefono);
    return [action, email || tel || "anon"].join("|");
  }
  const userId = payload.userId || payload.email || "anon";
  const nomeTest = payload.nomeTest || "";
  const data = payload.data_test || payload.loginDate || new Date().toISOString().slice(0, 10);
  const score = (payload.score != null && payload.total != null) ? `${payload.score}/${payload.total}` : "";
  return [action, userId, nomeTest, data, score].join("|");
}

// Pulisce la history da chiavi scadute (best-effort)
function gcIdemHistory() {
  const hist = loadIdemHistory();
  const now = Date.now();
  const out = {};
  for (const [k, meta] of Object.entries(hist)) {
    const ttl = getDedupTtlMs((meta && meta.action) || "generic");
    if (meta && (now - (meta.ts || 0)) < ttl) out[k] = meta;
  }
  saveIdemHistory(out);
}

// =======================
//  Funzione unica di comunicazione con Google Sheets
//  (con idempotenza, lock e fallback no-cors)
// =======================
async function sendToSheet(payload) {
  const action = payload.action || "generic";
  const idemKey = buildIdempotencyKey(payload);
  const now = Date.now();
  const dedupTtl = getDedupTtlMs(action);

  gcIdemHistory();
  const history = loadIdemHistory();

  // 1) Dedup persistente
  const histMeta = history[idemKey];
  if (histMeta && (now - (histMeta.ts || 0)) < dedupTtl) {
    console.warn("⛔ Invio deduplicato (persistente):", idemKey);
    return { ok: true, deduped: true, cached: true };
  }

  // 2) Lock in-process
  if (window.__pendingSends.has(idemKey)) {
    console.warn("⏳ Invio già in corso, riuso la stessa richiesta:", idemKey);
    return window.__pendingSends.get(idemKey);
  }

  const runner = (async () => {
    const setHistoryMeta = () => {
      const map = loadIdemHistory();
      map[idemKey] = { ts: Date.now(), action };
      saveIdemHistory(map);
    };

    const body = JSON.stringify({ ...payload, idempotencyKey: idemKey });

    try {
      console.log("📤 Invio dati a Google Sheets...", payload);
      const resp = await fetch(GAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idemKey,
        },
        body,
      });
      const json = await resp.json();
      console.log("✅ Risposta JSON:", json);
      setHistoryMeta();
      return json;
    } catch (err) {
      console.warn("⚠️ CORS o rete bloccata, passo al fallback no-cors:", err);
    }

    try {
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          "X-Idempotency-Key": idemKey,
        },
        body,
      });
      console.log("✅ Inviato in modalità no-cors (risposta opaca)");
      setHistoryMeta();
      return { ok: true, opaque: true, idempotencyKey: idemKey };
    } catch (e2) {
      console.error("❌ Invio fallito anche in no-cors:", e2);
      return null;
    } finally {
      setTimeout(() => window.__pendingSends.delete(idemKey), 500);
    }
  })();

  window.__pendingSends.set(idemKey, runner);
  return runner;
}

// =======================
//  REGISTRAZIONE (index.html)
// =======================
// 🔴 MODIFICATA: async, pre-check, lock bottone e await invio
async function registerUser() {
  const btn = document.getElementById("registerBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Invio in corso..."; }

  // lock di sessione per evitare doppi submit paralleli (anche senza bottone)
  if (sessionStorage.getItem("register_lock") === "1") {
    console.warn("⛔ Registro già in corso (session lock).");
    if (btn) { btn.disabled = true; }
    return;
  }
  sessionStorage.setItem("register_lock", "1");

  // eventuale utente già salvato
  const existing = JSON.parse(localStorage.getItem("userData") || "{}");

  const rawEmail = document.getElementById("email").value;
  const rawPhone = document.getElementById("telefono").value;

  const normEmail = normalizeEmail(rawEmail);
  const normPhone = normalizePhone(rawPhone);

  // Se esiste già stesso utente (stessa email), riuso l'userId
  const stableUserId =
    (existing && normalizeEmail(existing.email) === normEmail && existing.userId) ||
    generateUserId(normEmail);

  const userData = {
    userId: stableUserId,
    cognome: document.getElementById("cognome").value.trim(),
    nome: document.getElementById("nome").value.trim(),
    email: normEmail,
    telefono: normPhone,
    registrationDate: new Date().toISOString(),
  };

  // Pre-check idempotenza locale (non invio se già registrato su questo browser)
  const idemKey = buildIdempotencyKey({ action: "registrazione", ...userData });
  const history = loadIdemHistory();
  const now = Date.now();
  if (history[idemKey] && (now - history[idemKey].ts) < REGISTER_DEDUP_WINDOW_MS) {
    console.warn("⛔ Registrazione già presente in questo browser, salto invio.");
    // comunque salvo i dati localmente e vado avanti
    localStorage.setItem("userData", JSON.stringify(userData));
    localStorage.setItem("isRegistered", "true");
    if (btn) { btn.disabled = false; btn.textContent = "Registrati"; }
    sessionStorage.removeItem("register_lock");
    window.location.href = "test-selection.html";
    return;
  }

  // Salvo localmente prima (così test-selection ha i dati anche se rete lenta)
  localStorage.setItem("userData", JSON.stringify(userData));
  localStorage.setItem("isRegistered", "true");

  try {
    // 🔸 ATTENDO l'invio: evitiamo abort su redirect
    await sendUserRegistration(userData);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Registrati"; }
    sessionStorage.removeItem("register_lock");
  }

  window.location.href = "test-selection.html";
}

// -----------------------
// Esporta funzioni nel window (già usate dalle pagine test)
// -----------------------
window.sendUserRegistration = sendUserRegistration;
window.sendTestDataToSheet = sendTestDataToSheet;
window.sendLoginEvent = sendLoginEvent;
window.registerUser = registerUser; // nel caso 






