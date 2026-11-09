/* Executive-Seite Roberto Cossai. Entschlüsselt den Inhalt im Browser, erst nach dem richtigen Zugangscode.
   PBKDF2-SHA256 leitet aus dem Code einen Schlüssel ab, der den Inhaltsschlüssel auspackt (AES-256-GCM). */
(function () {
  "use strict";
  var html = document.documentElement;
  var daten = JSON.parse(document.getElementById("tresor").textContent);
  var form = document.getElementById("tor-form");
  var feld = document.getElementById("code");
  var meldung = document.getElementById("tor-meldung");
  var knopf = form.querySelector("button[type=submit]");
  var tor = document.getElementById("tor");
  var profil = document.getElementById("profil");
  var schliessen = document.querySelector(".x-schliessen");
  var kennung = "rc-executive-" + daten.c.slice(0, 16);
  var enc = new TextEncoder();

  function bytes(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function b64(a) { var s = ""; a = new Uint8Array(a); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function merken(k, w) { try { sessionStorage.setItem(k, w); } catch (e) { /* privat: ohne Merken weiter */ } }
  function lesen(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }

  // Sprache: Deutsch oder Englisch, gilt für Maske und Profil
  function sprache(sp) {
    html.dataset.sprache = sp;
    html.lang = sp === "en" ? "en" : "de-CH";
    document.querySelectorAll("[data-wahl]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.wahl === sp ? "true" : "false"); });
    if (!knopf.disabled) knopf.textContent = form.dataset["knopf" + (sp === "en" ? "En" : "De")];
    merken("rc-executive-sprache", sp);
  }
  var gewaehlt = new URLSearchParams(location.search).get("lang") || lesen("rc-executive-sprache") ||
    ((navigator.language || "de").toLowerCase().indexOf("de") === 0 ? "de" : "en");
  document.querySelectorAll("[data-wahl]").forEach(function (b) { b.addEventListener("click", function () { sprache(b.dataset.wahl); }); });
  sprache(gewaehlt === "en" ? "en" : "de");
  function text(k) { return form.dataset[k + (html.dataset.sprache === "en" ? "En" : "De")]; }

  function oeffnen(schluessel) {
    return crypto.subtle.importKey("raw", schluessel, "AES-GCM", false, ["decrypt"]).then(function (k) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(daten.i), additionalData: enc.encode("rc-executive-inhalt") }, k, bytes(daten.c));
    }).then(function (klar) {
      profil.innerHTML = new TextDecoder().decode(klar);
      profil.hidden = false;
      tor.hidden = true;
      schliessen.hidden = false;
      document.title = "Roberto Cossai | Executive Profile";
      merken(kennung, b64(schluessel));
      var h = profil.querySelector(".sp-" + html.dataset.sprache + " h1");
      if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    });
  }

  function auspacken(code) {
    return crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveKey"]).then(function (basis) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: bytes(daten.s), iterations: daten.r },
        basis, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    }).then(function (kek) {
      // jedes Fach probieren, nur das passende lässt sich mit diesem Code entschlüsseln
      var versuche = daten.k.map(function (f) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(f.i), additionalData: enc.encode("rc-executive-schluessel") }, kek, bytes(f.w))
          .then(function (s) { return s; }, function () { return null; });
      });
      return Promise.all(versuche).then(function (r) {
        var s = r.filter(Boolean)[0];
        if (!s) throw new Error("falsch");
        return s;
      });
    });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var code = feld.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) { meldung.textContent = text("falsch"); feld.focus(); return; }
    knopf.disabled = true;
    knopf.textContent = text("pruefe");
    meldung.textContent = "";
    auspacken(code).then(oeffnen).catch(function () {
      meldung.textContent = text("falsch");
      feld.setAttribute("aria-invalid", "true");
      feld.select();
    }).then(function () {
      knopf.disabled = false;
      knopf.textContent = text("knopf");
    });
  });
  feld.addEventListener("input", function () { feld.removeAttribute("aria-invalid"); });

  schliessen.addEventListener("click", function () {
    try { sessionStorage.removeItem(kennung); } catch (e) { /* nichts gemerkt */ }
    profil.innerHTML = "";
    profil.hidden = true;
    tor.hidden = false;
    schliessen.hidden = true;
    feld.value = "";
    feld.focus();
  });

  var gemerkt = lesen(kennung);
  if (gemerkt) oeffnen(bytes(gemerkt)).catch(function () { try { sessionStorage.removeItem(kennung); } catch (e) { /* egal */ } });
})();
