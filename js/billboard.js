/* Pinnwand: Eingaben bleiben in der privaten Wix-Sammlung «Billboard».
   Die öffentliche Anzeige liest nur die separat von Admins gepflegte Freigabesammlung. */
(function () {
  "use strict";
  var CLIENT = "e3e490e0-547d-42ad-becf-f52c5acb338f"; // öffentliche Client-ID wie in cms.js, kein Geheimnis
  var API = "https://www.wixapis.com/";
  var EINGANG = "Billboard";
  var FREIGEGEBEN = "PinnwandFreigegeben";
  var MAX = 140;

  var tafel = document.querySelector("[data-billboard]");
  if (!tafel || !window.fetch) return;

  var THEMEN = JSON.parse(document.getElementById("bb-themen").textContent);
  var reiter = tafel.querySelector(".bb-reiter");
  var feld = tafel.querySelector(".bb-feld");
  var fussText = tafel.querySelector(".bb-stand");
  var umschalten = tafel.querySelector(".bb-umschalten");
  var form = document.querySelector(".bb-form form");
  var zuletzt = 0;
  var eintraege = [];
  var aktiv = "alle";
  var alsListe = false;
  var token = null;
  var status = "laden";

  function h(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (z) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[z]; }); }
  function datum(d) { d = new Date(d); return isNaN(d) ? "" : ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); }
  function zeit(x) { return x && x.$date ? Date.parse(x.$date) : Date.parse(x || ""); }
  function schluessel(t) { return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function streuung(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }

  function holeToken() {
    if (token) return Promise.resolve(token);
    return post("oauth2/token", { clientId: CLIENT, grantType: "anonymous" }).then(function (d) { token = d.access_token; return token; });
  }
  function post(pfad, body, tok) {
    var kopf = { "Content-Type": "application/json" };
    if (tok) kopf.Authorization = tok;
    return fetch(API + pfad, { method: "POST", headers: kopf, body: JSON.stringify(body) }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  // ------------------------------------------------ Laden
  function laden() {
    return holeToken().then(function (tok) {
      var q = { dataCollectionId: FREIGEGEBEN, query: { sort: [{ fieldName: "_createdDate", order: "DESC" }], paging: { limit: 100 } } };
      return post("wix-data/v2/items/query", q, tok);
    }).then(function (d) {
      var roh = (d.dataItems || []).map(function (x) { return x.data; }).filter(function (x) {
        return Object.prototype.hasOwnProperty.call(THEMEN, x.thema) && typeof x.title === "string" && x.title.trim();
      });
      eintraege = buendeln(roh);
      status = "bereit";
      zaehlen();
      zeigen();
    }).catch(function () {
      status = "fehler";
      zeigen();
    });
  }

  // Gleiche Anliegen im gleichen Thema werden zu einem Eintrag mit Zähler
  function buendeln(liste) {
    var karte = {};
    liste.forEach(function (x) {
      var text = x.title.trim().slice(0, MAX), k = x.thema + "|" + schluessel(text);
      var t = zeit(x._createdDate);
      if (!karte[k]) karte[k] = { thema: x.thema, text: text, anzahl: 0, neu: t, id: x._id };
      karte[k].anzahl += 1;
      if (t > karte[k].neu) karte[k].neu = t;
    });
    return Object.keys(karte).map(function (k) { return karte[k]; });
  }

  // Grösse aus Häufigkeit und Aktualität, vier Stufen nach Rang innerhalb der Ansicht
  function stufen(liste) {
    var jetzt = Date.now();
    var bewertet = liste.map(function (x) {
      var tage = (jetzt - x.neu) / 864e5;
      return { x: x, wert: x.anzahl + Math.max(0, 1 - tage / 60) };
    }).sort(function (a, b) { return b.wert - a.wert || b.x.neu - a.x.neu; });
    var n = bewertet.length;
    bewertet.forEach(function (b, i) {
      var p = n === 1 ? 0 : i / n;
      b.x.stufe = p < .12 || i === 0 ? 4 : p < .35 ? 3 : p < .7 ? 2 : 1;
    });
    return liste;
  }

  function zaehlen() {
    reiter.querySelectorAll("button").forEach(function (b) {
      var id = b.dataset.thema;
      var n = eintraege.filter(function (x) { return id === "alle" || x.thema === id; }).length;
      b.querySelector(".bb-zahl").textContent = n ? String(n) : "";
    });
  }

  function zeigen() {
    if (status === "laden") return;
    if (status === "fehler") {
      feld.innerHTML = '<p class="bb-leer">Die Pinnwand konnte gerade nicht geladen werden. Versuch es gleich noch einmal.</p>';
      return;
    }
    var liste = eintraege.filter(function (x) { return aktiv === "alle" || x.thema === aktiv; });
    var name = aktiv === "alle" ? "" : THEMEN[aktiv];
    if (!liste.length) {
      feld.innerHTML = '<p class="bb-leer">' + (name ? "Zu «" + h(name) + "» steht noch nichts." : "Die Pinnwand ist noch leer.") +
        ' Der erste Eintrag kann deiner sein.<br><a href="#bb-schreiben">Eintrag schreiben</a></p>';
      fussText.textContent = "";
      umschalten.hidden = true;
      return;
    }
    umschalten.hidden = false;
    fussText.textContent = liste.length + (liste.length === 1 ? " Eintrag" : " Einträge") + (name ? " zu " + name : "") + ", von mir freigegeben.";
    if (alsListe) {
      var sortiert = liste.slice().sort(function (a, b) { return b.neu - a.neu; });
      feld.innerHTML = '<ul class="bb-liste">' + sortiert.map(function (x) {
        return '<li><span class="bb-text">' + h(x.text) + (x.anzahl > 1 ? " (" + x.anzahl + " Mal)" : "") + '</span><span class="bb-meta">' +
          (aktiv === "alle" ? h(THEMEN[x.thema]) + ", " : "") + datum(x.neu) + "</span></li>";
      }).join("") + "</ul>";
      return;
    }
    stufen(liste);
    var gemischt = liste.slice().sort(function (a, b) { return streuung(a.id) - streuung(b.id); });
    feld.innerHTML = '<ul class="bb-wolke">' + gemischt.map(function (x, i) {
      var mal = x.anzahl > 1 ? '<span class="bb-mal" aria-label="' + x.anzahl + ' Mal genannt">' + x.anzahl + "×</span>" : "";
      return '<li class="s' + x.stufe + '" style="--i:' + Math.min(i, 30) + '" title="' + h(THEMEN[x.thema]) + '">' + h(x.text) + mal + "</li>";
    }).join("") + "</ul>";
  }

  // ------------------------------------------------ Reiter
  function waehlen(knopf, fokus) {
    reiter.querySelectorAll("button").forEach(function (b) {
      var an = b === knopf;
      b.setAttribute("aria-selected", an ? "true" : "false");
      b.tabIndex = an ? 0 : -1;
    });
    aktiv = knopf.dataset.thema;
    if (fokus) knopf.focus();
    if (aktiv !== "alle" && form) {
      var r = form.querySelector('input[name="thema"][value="' + aktiv + '"]');
      if (r && !form.dataset.gewaehlt) r.checked = true;
    }
    zeigen();
  }
  reiter.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) waehlen(b); });
  reiter.addEventListener("keydown", function (e) {
    var alle = Array.from(reiter.querySelectorAll("button")), i = alle.indexOf(document.activeElement);
    if (i < 0) return;
    var ziel = e.key === "ArrowRight" ? alle[(i + 1) % alle.length] : e.key === "ArrowLeft" ? alle[(i - 1 + alle.length) % alle.length] :
      e.key === "Home" ? alle[0] : e.key === "End" ? alle[alle.length - 1] : null;
    if (ziel) { e.preventDefault(); waehlen(ziel, true); }
  });
  umschalten.addEventListener("click", function () {
    alsListe = !alsListe;
    umschalten.textContent = alsListe ? "Als Wolke zeigen" : "Als Liste zeigen";
    umschalten.setAttribute("aria-pressed", alsListe ? "true" : "false");
    zeigen();
  });

  // ------------------------------------------------ Posten
  if (form) {
    var text = form.querySelector("#bb-text"), zaehler = form.querySelector(".bb-zaehler"), antwort = form.querySelector(".antwort");
    var knopf = form.querySelector("button[type=submit]");
    knopf.disabled = false;
    function zaehle() {
      var rest = MAX - text.value.length;
      zaehler.textContent = rest + " Zeichen frei";
      zaehler.classList.toggle("knapp", rest <= 15);
    }
    text.addEventListener("input", zaehle);
    zaehle();
    form.addEventListener("change", function (e) { if (e.target.name === "thema") form.dataset.gewaehlt = "ja"; });

    function fehler(id, meldung) {
      var p = form.querySelector('[data-fehler="' + id + '"]');
      if (p) p.textContent = meldung || "";
      var f = id === "thema" ? form.querySelector(".bb-themen") : form.querySelector("#bb-text");
      if (f) { if (meldung) f.setAttribute("aria-invalid", "true"); else f.removeAttribute("aria-invalid"); }
      return !meldung;
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      antwort.textContent = ""; antwort.classList.remove("gut");
      var thema = (form.querySelector('input[name="thema"]:checked') || {}).value || "";
      var wert = text.value.replace(/\s+/g, " ").trim();
      var ok = fehler("thema", Object.prototype.hasOwnProperty.call(THEMEN, thema) ? "" : "Wähl ein Thema.");
      var meldung = "";
      if (wert.length < 3) meldung = "Schreib in ein paar Worten, was dir wichtig ist.";
      else if (wert.length > MAX) meldung = "Höchstens " + MAX + " Zeichen.";
      else if (/https?:|www\.|\.(ch|com|net|org)\b/i.test(wert)) meldung = "Bitte ohne Links.";
      else if (/@/.test(wert)) meldung = "Bitte ohne E-Mail-Adressen.";
      else if (/(\d[\s/.-]?){7,}/.test(wert)) meldung = "Bitte ohne Telefonnummern.";
      ok = fehler("text", meldung) && ok;
      if (!ok) { (form.querySelector("[aria-invalid=true] input, #bb-text[aria-invalid=true]") || text).focus(); return; }
      // Das versteckte Feld fängt einfache Formularbots ab.
      var topf = form.querySelector(".topf input");
      if (topf && topf.value) { danke(); return; }
      if (Date.now() - zuletzt < 60000) { antwort.textContent = "Dein letzter Eintrag ist gerade angekommen. Warte bitte eine Minute, bevor du den nächsten abschickst."; return; }
      knopf.disabled = true; knopf.textContent = "Wird gesendet …";
      holeToken().then(function (tok) {
        return post("wix-data/v2/items", { dataCollectionId: EINGANG, dataItem: { data: { thema: thema, text: wert } } }, tok);
      }).then(function () {
        zuletzt = Date.now();
        danke();
      }).catch(function () {
        antwort.textContent = "Dein Eintrag konnte nicht gesendet werden. Versuch es noch einmal oder schreib mir an hallo@robertocossai.ch.";
      }).then(function () { knopf.disabled = false; knopf.textContent = "Eintrag abschicken"; });
    });
    function danke() {
      text.value = ""; zaehle();
      antwort.classList.add("gut");
      antwort.textContent = "Danke, dein Eintrag ist angekommen. Er erscheint an der Pinnwand, wenn ich ihn freigebe.";
      antwort.focus();
    }
  }

  laden();
})();
