/* Roberto Cossai: holt beim Öffnen den neusten Stand aus dem Wix-CMS und ersetzt die betroffenen Abschnitte.
   Ohne Skript, ohne Verbindung oder bei einem Fehler bleibt der gebaute Stand stehen. Der Aufbau folgt
   werkzeuge/bauen.py (thema_zeile, thema_block, position_inhalt, clips, folgen, anlaesse, medienberichte, meldungen). */
(function () {
  "use strict";
  var CLIENT = "e3e490e0-547d-42ad-becf-f52c5acb338f"; // öffentliche Client-ID, kein Geheimnis
  var API = "https://www.wixapis.com/";
  var B = document.documentElement.dataset.basis || "";
  var stellen = document.querySelectorAll("[data-cms], [data-cms-text], [data-cms-instagram]");
  if (!window.fetch || !stellen.length) return;

  function h(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (z) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[z]; }); }
  function url(u) { return /^(https?:|mailto:)/i.test(u || "") ? u : ""; }
  function datum(i) { i = (i || "").slice(0, 10); return i.length === 10 ? i.slice(8, 10) + "." + i.slice(5, 7) + "." + i.slice(0, 4) : ""; }
  function sichtbar(l) { return l.filter(function (x) { return x.sichtbar !== false; }); }
  function reihe(a, b) { var x = typeof a.reihenfolge === "number" ? a.reihenfolge : 999, y = typeof b.reihenfolge === "number" ? b.reihenfolge : 999; return x - y || String(a.titel || "").localeCompare(String(b.titel || "")); }
  function setzen(sel, inhalt) { document.querySelectorAll(sel).forEach(function (x) { if (x.innerHTML !== inhalt) x.innerHTML = inhalt; }); }
  function zeigen(sel, an) { document.querySelectorAll(sel).forEach(function (x) { x.hidden = !an; }); }

  function post(pfad, body, tok) {
    var kopf = { "Content-Type": "application/json" };
    if (tok) kopf.Authorization = tok;
    return fetch(API + pfad, { method: "POST", headers: kopf, body: JSON.stringify(body) }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function sammlung(tok, id) {
    return post("wix-data/v2/items/query", { dataCollectionId: id, query: { paging: { limit: 100 } } }, tok)
      .then(function (d) { return (d.dataItems || []).map(function (x) { return x.data; }); });
  }

  // ------------------------------------------------ Positionen
  function thema(x) {
    return { id: x.slug, titel: x.titel || "", navTitel: x.slug === "digital" ? "Digitalisierung" : x.titel || "",
      start: !!x.startseite, frage: x.frage || "", zuruf: x.zuruf || "Säg mer, wie.", kern: x.kern || "",
      kurz: x.kurztext || "", stehe: x.langtext || "", belegt: x.belegt || "", qn: x.quelleName || "", ql: url(x.quelleLink),
      abwaegung: x.abwaegung || "", preis: x.preis || "", voran: x.naechsterSchritt || "",
      uebersicht: x.uebersichtKernsatz || "", belege: belegeMarkup(x.belegeMitQuellen) };
  }
  function belegeText(knoten) {
    if (knoten.nodeName === "BR") return "<br>";
    if (knoten.nodeName === "P") return Array.from(knoten.childNodes).map(belegeText).join("");
    if (knoten.nodeName === "STRONG" || knoten.nodeName === "B") return "<strong>" + h(knoten.textContent) + "</strong>";
    if (knoten.nodeName === "A") {
      var href = knoten.getAttribute("href");
      if (/^https:\/\//i.test(href || "")) return '<a href="' + h(href) + '" rel="noopener">' + h(knoten.textContent) + "</a>";
    }
    return h(knoten.textContent);
  }
  function belegeMarkup(inhalt) {
    if (typeof inhalt !== "string" || !inhalt) return "";
    var vorlage = document.createElement("template");
    vorlage.innerHTML = inhalt;
    return Array.from(vorlage.content.children).map(function (element) {
      if (element.tagName === "UL") {
        var punkte = Array.from(element.children).filter(function (punkt) {
          return punkt.tagName === "LI" && punkt.textContent.trim();
        }).map(function (punkt) {
          return "<li>" + Array.from(punkt.childNodes).map(belegeText).join("") + "</li>";
        }).join("");
        return punkte ? "<ul>" + punkte + "</ul>" : "";
      }
      if (element.tagName !== "P" || !element.textContent.trim()) return "";
      var knoten = Array.from(element.childNodes);
      var quellen = element.querySelector("a") && knoten.every(function (teil) {
        return teil.nodeName === "A" || /^[\s·]*$/.test(teil.textContent);
      });
      return (quellen ? '<p class="quelle">' : "<p>") + knoten.map(belegeText).join("") + "</p>";
    }).join("");
  }
  function positionVollstaendig(t) {
    if (t.id !== "gesundheit" && t.id !== "erreichbarkeit" && t.id !== "digital" && t.id !== "sicherheit" && t.id !== "wohnen" && t.id !== "finanzen") return true;
    var gemeinsam = t.titel && t.kern && t.kurz && t.stehe && t.abwaegung && t.voran && t.frage && t.zuruf === "Säg mer, wo.";
    if (t.id === "sicherheit") return gemeinsam && t.uebersicht && t.belege && t.belege.includes("texts_of_law/370");
    if (t.id === "digital") return gemeinsam && t.titel === "Digital Schritt halten" && t.belege;
    if (t.id === "wohnen") return gemeinsam && t.titel === "Wohnen" && t.uebersicht && t.belege && absatzTeile(t.kurz).length > 1;
    if (t.id === "finanzen") return gemeinsam && t.titel === "Finanzen" && t.uebersicht && t.belege.includes("<ul>");
    return gemeinsam && (t.id === "gesundheit" ? t.belegt && t.qn && t.ql : t.uebersicht && t.belege);
  }
  function positionsMarkup(ziel, liste, render) {
    var neu = liste.map(function (t) {
      if (positionVollstaendig(t) || (t.id === "wohnen" && ziel.dataset.cms === "themen-start")) return render(t);
      var lokal = ziel.querySelector('[id="' + t.id + '"], [data-slug="' + t.id + '"]');
      return lokal ? lokal.outerHTML : "";
    }).join("");
    if (ziel.innerHTML !== neu) ziel.innerHTML = neu;
  }
  // Doppelte Leerzeichen erhalten die Absatzgrenzen in Wix-Textfeldern.
  function absatzTeile(text) {
    return text.trim().split(/\r?\n\s*\r?\n| {2,}/);
  }
  function absaetze(text) {
    var teile = absatzTeile(text);
    return teile.length > 1 ? teile.map(function (teil) { return "<p>" + h(teil) + "</p>"; }).join("") : h(text);
  }
  function themaZeile(t, offen) {
    return '<details class="thema-zeile" name="thema"' + (offen ? " open" : "") + '>\n<summary><span class="thema-marke">' + h(t.navTitel) + '</span><span class="thema-frage-gross">' + h(t.frage) +
      '</span><span class="zeichen" aria-hidden="true"></span></summary>\n<div class="thema-antwort"><p class="thema-kern">' + h(t.kern) + "</p><p>" + h(t.id === "sicherheit" || t.id === "wohnen" ? (t.uebersicht || t.kurz) : t.kurz) +
      '</p>\n<p class="thema-wege"><a class="knopf knopf-mundart" lang="gsw" href="' + B + "/kontakt.html?thema=" + h(t.id) + '">' + h(t.zuruf) + '</a><a href="' + B +
      "/positionen/" + h(t.id) + '.html">Meine Position lesen</a></p></div>\n</details>';
  }
  function themaBlock(t) {
    var l = B + "/positionen/" + h(t.id) + ".html";
    return '<section class="thema" id="' + h(t.id) + '"><div class="raster">\n<h2><a class="thema-link" href="' + l + '">' + h(t.titel) + '</a></h2>\n<div class="thema-text"><p class="thema-kern">' +
      h(t.kern) + "</p><p>" + h(t.uebersicht || t.kurz) + '</p>\n<p class="thema-weiter"><a href="' + l + '">Ganze Position lesen</a></p></div>\n</div></section>';
  }
  function sprung(liste, ohne) {
    return liste.filter(function (t) { return t.id !== ohne; }).map(function (t) { return '<li><a href="' + B + "/positionen/" + h(t.id) + '.html">' + h(t.navTitel || t.titel) + "</a></li>"; }).join("");
  }
  function positionInhalt(t, liste) {
    var digital = t.id === "digital";
    var erreichbarkeit = t.id === "erreichbarkeit";
    var wohnen = t.id === "wohnen";
    var finanzen = t.id === "finanzen";
    var mitAbschnittstiteln = wohnen || finanzen;
    var gegliedert = t.id === "gesundheit" || erreichbarkeit || digital || mitAbschnittstiteln;
    var position = wohnen ? absatzTeile(t.kurz) : [t.kurz];
    var kurz = h(position[0]) + "</p>" + position.slice(1).map(function (absatz) { return "<p>" + h(absatz) + "</p>"; }).join("");
    var f = "";
    var belege = t.belege || h(t.belegt) + (t.qn && t.ql ? ' <a class="quelle" href="' + h(t.ql) + '" rel="noopener">' + h(t.qn) + "</a>" : "");
    if (belege) f += "<div><dt>Was belegt ist</dt><dd>" + belege + "</dd></div>";
    var stehe = gegliedert ? absaetze(t.stehe) : h(t.stehe);
    if (mitAbschnittstiteln) {
      stehe = absatzTeile(t.stehe).map(function (absatz) {
        return absatz.indexOf("### ") === 0 ? "<h3><em>" + h(absatz.slice(4)) + "</em></h3>" : "<p>" + h(absatz) + "</p>";
      }).join("");
    }
    if (digital) stehe = stehe.replace("Mehr dazu unter Sicherheit.",
      'Mehr dazu unter <a href="' + B + '/positionen/sicherheit.html">Sicherheit</a>.');
    if (finanzen) stehe = stehe.replace("Mehr dazu unter Digitalisierung.",
      'Mehr dazu unter <a href="' + B + '/positionen/digital.html">Digitalisierung</a>.');
    f += "<div><dt>Wo ich stehe</dt><dd>" + stehe + "</dd></div>";
    if (gegliedert && t.abwaegung) {
      var abwaegung = h(t.abwaegung);
      if (erreichbarkeit) abwaegung = abwaegung.replace(/\bParkierungsinitiative\b/, '<a href="https://parkraumgestaltung.ch/" rel="noopener">Parkierungsinitiative</a>');
      f += "<div><dt>Was ich abwäge</dt><dd>" + abwaegung + "</dd></div>";
    }
    if (!gegliedert && t.preis) f += "<div><dt>Was es kostet</dt><dd>" + h(t.preis) + "</dd></div>";
    if (t.voran) f += "<div><dt>Was ich als Nächstes tue</dt><dd>" + h(t.voran) + "</dd></div>";
    return '<section class="flaeche-marke seitenkopf"><div class="raster">\n<nav class="brotkrume" aria-label="Brotkrume"><ol><li><a href="' + B + '/">Start</a></li><li><a href="' + B +
      '/positionen.html">Positionen</a></li><li aria-current="page">' + h(t.navTitel) + "</li></ol></nav>\n<h1>" + h(t.titel) + '</h1>\n<p class="einstieg">' + (gegliedert ? "<em>" + h(t.kern) + "</em>" : h(t.kern)) +
      '</p>\n</div></section>\n<section class="thema"><div class="raster">\n<h2>Meine Position</h2>\n<div class="thema-text"><p class="thema-kern">' + kurz +
      '<dl class="thema-felder">' + f + '</dl>\n<div class="thema-frage"><p>' + (gegliedert ? "<em>" + h(t.frage) + "</em>" : h(t.frage)) + '</p><a lang="gsw" href="' + B + "/kontakt.html?thema=" + h(t.id) + '">' + h(t.zuruf) +
      '</a></div>' + (digital ? '<aside class="thema-frage" data-abstimmung="digital" hidden></aside>' : "") + '</div>\n</div></section>\n<section class="flaeche-nebel abschnitt"><div class="raster">\n<h2 class="abschnitt-titel">Weitere Positionen</h2>\n<ul class="sprungliste">' +
      sprung(liste, t.id) + "</ul>\n</div></section>";
  }
  function sicherheitInhalt(m, t, liste) {
    // Listen und Hilfelinks behalten die Struktur der statischen Vorlage.
    function textTeile(feld, text) {
      var teile = absatzTeile(text);
      var elemente = Array.from(m.querySelectorAll('[data-sicherheit-text="' + feld + '"]'));
      if (teile.length !== elemente.length) return;
      elemente.forEach(function (element, i) {
        var link = element.querySelector("a");
        if (!link) {
          element.textContent = teile[i];
          return;
        }
        var label = link.textContent;
        var index = teile[i].indexOf(label);
        if (index < 0) return;
        element.replaceChildren(teile[i].slice(0, index), link, teile[i].slice(index + label.length));
      });
    }
    textTeile("kern", t.kern);
    textTeile("kurz", t.kurz);
    textTeile("stehe", t.stehe);
    textTeile("abwaegung", t.abwaegung);
    textTeile("voran", t.voran);
    textTeile("frage", t.frage);
    m.querySelector("[data-sicherheit-belege]").innerHTML = t.belege;
    m.querySelector(".sprungliste").innerHTML = sprung(liste, t.id);
  }
  function abstimmungAnzeigen(einstellungen) {
    var hinweis = document.querySelector("[data-abstimmung]");
    if (!hinweis) return;
    var resultat = einstellungen[hinweis.dataset.abstimmung + "_abstimmungsresultat"];
    var vorher = Date.now() < Date.parse("2026-11-30T00:00:00+01:00");
    var vorlage = Array.from(document.querySelectorAll("template[data-abstimmung-stand]")).find(function (t) {
      var stand = t.dataset.abstimmungStand;
      return vorher ? stand === "vorher" : stand !== "vorher" && stand === resultat;
    });
    hinweis.hidden = !vorlage;
    hinweis.innerHTML = vorlage ? vorlage.innerHTML : "";
  }
  function positionen(daten) {
    var liste = sichtbar(daten).filter(function (x) { return x.slug; }).sort(reihe).map(thema);
    if (!liste.length) return;
    var gesundheit = liste.find(function (t) { return t.id === "gesundheit"; });
    if (!gesundheit) {
      gesundheit = { id: "gesundheit", titel: "Gesundheit", start: true };
      liste.splice(2, 0, gesundheit);
    }
    var gesundheitAusWix = positionVollstaendig(gesundheit);
    document.querySelectorAll('[data-cms="themen-start"]').forEach(function (x) {
      var offen = x.querySelector("details[open] .thema-marke");
      var start = liste.filter(function (t) { return t.start || (t === gesundheit && !gesundheitAusWix); });
      var o = offen ? offen.textContent : (start[0] || {}).navTitel;
      positionsMarkup(x, start, function (t) { return themaZeile(t, t.navTitel === o); });
    });
    document.querySelectorAll('[data-cms="positionen-liste"]').forEach(function (x) {
      positionsMarkup(x, liste, themaBlock);
    });
    setzen('[data-cms="positionen-sprung"]', sprung(liste));
    document.querySelectorAll('[data-cms="position"]').forEach(function (m) {
      var t = liste.filter(function (x) { return x.id === m.dataset.slug; })[0];
      if (t && positionVollstaendig(t)) {
        if (t.id === "sicherheit") {
          sicherheitInhalt(m, t, liste);
          return;
        }
        var neu = positionInhalt(t, liste);
        if (m.innerHTML.trim() !== neu) m.innerHTML = neu;
      }
    });
  }

  // ------------------------------------------------ Termine und News
  function termine(daten) {
    var heute = new Date().toISOString().slice(0, 10);
    var l = sichtbar(daten).map(function (x) { x.datum = (x.datum || "").slice(0, 10); return x; })
      .sort(function (a, b) { return (a.datum + (a.zeit || "")).localeCompare(b.datum + (b.zeit || "")); });
    setzen('[data-cms="folgen"]', l.filter(function (x) { return x.art === "Folge"; }).map(function (t) {
      var titel = url(t.link) ? '<a href="' + h(t.link) + '" rel="noopener">' + h(t.titel) + "</a>" : h(t.titel);
      return '<li class="folge"><time datetime="' + h(t.datum) + '">' + datum(t.datum) + "</time><strong>" + titel + "</strong></li>";
    }).join(""));
    var an = l.filter(function (x) { return x.art === "Anlass" && x.datum >= heute; }).map(function (t) {
      var mehr = url(t.link) ? ' <a href="' + h(t.link) + '" rel="noopener">Mehr dazu</a>' : "";
      return '<li class="anlass"><time datetime="' + h(t.datum) + '">' + datum(t.datum) + (t.zeit ? ", " + h(t.zeit) : "") + "</time><strong>" + h(t.titel) + "</strong><span>" + h(t.ort) + mehr + "</span></li>";
    }).join("");
    setzen('[data-cms="anlaesse"]', an);
    zeigen('[data-cms="anlaesse-abschnitt"]', !!an);
  }
  function news(daten) {
    var l = sichtbar(daten);
    var videos = l.filter(function (x) { return x.art === "Video"; }).sort(reihe);
    if (videos.length) {
      setzen('[data-cms="serie"]', videos.map(function (c) {
        var link = url(c.link) ? '<p><a href="' + h(c.link) + '" rel="noopener">Video ansehen</a></p>' : "";
        return '<article class="clip"><div class="clip-tafel" lang="gsw">' + h(c.tafel) + "</div><h3>" + h(c.titel) + "</h3><p>" + h(c.text) + "</p>" + link + "</article>";
      }).join(""));
      var s = videos.filter(function (x) { return x.serie; })[0];
      if (s) setzen('[data-cms="serie-titel"]', h(s.serie));
    }
    var b = l.filter(function (x) { return x.art === "Medienbericht"; }).sort(function (a, b) { return String(b.datum || "").localeCompare(String(a.datum || "")); }).map(function (n) {
      var kopf = [datum(n.datum), n.quelle].filter(Boolean).join(" · ");
      var titel = url(n.link) ? '<a href="' + h(n.link) + '" rel="noopener">' + h(n.titel) + "</a>" : h(n.titel);
      return '<li class="bericht"><span>' + h(kopf) + "</span><strong>" + titel + "</strong></li>";
    }).join("");
    setzen('[data-cms="medienberichte"]', b);
    zeigen('[data-cms="medienberichte-abschnitt"]', !!b);
  }

  // ------------------------------------------------ Stimmen und Rückmeldungen
  function stimmen(daten) {
    var echt = sichtbar(daten).filter(function (x) { return x.zustimmung && x.text && x.name; }).sort(reihe);
    if (!echt.length) return; // bis dahin bleiben die Muster
    var spur = document.querySelector('[data-cms="stimmen"]');
    if (!spur) return;
    spur.innerHTML = echt.map(function (s) {
      return '<li class="stimme"><blockquote>«' + h(s.text) + '»</blockquote>\n<p class="stimme-wer"><span class="balken">' + h(s.name) + '</span><span class="balken balken-klein">' + h(s.funktion) + "</span></p></li>";
    }).join("");
    spur.scrollLeft = 0;
    spur.dispatchEvent(new Event("scroll"));
  }
  function rueckmeldungen(daten, ein) {
    var l = daten.filter(function (x) { return x.freigegeben; }).sort(function (a, b) { return String(b.datum || "").localeCompare(String(a.datum || "")); });
    var ab = document.querySelector('[data-cms="gesagt-abschnitt"]');
    if (!ab) return;
    var neu = l.length ? '<ul class="meldungen">' + l.map(function (r) {
      return '<li class="meldung"><p class="meldung-ort">' + h(r.ort) + "</p><blockquote>«" + h(r.text) + '»</blockquote><p class="meldung-wer">' + h([r.vorname, r.quartier].filter(Boolean).join(", ")) + "</p></li>";
    }).join("") + "</ul>" : '<p class="meldungen-leer" data-cms-text="rueckmeldungen_leer">' + h(ein.rueckmeldungen_leer || "") + "</p>";
    setzen('[data-cms="gesagt"]', neu);
    ab.hidden = !l.length && ab.dataset.modus === "live";
  }

  // ------------------------------------------------ Einstellungen
  function einstellungen(daten) {
    var ein = {};
    daten.forEach(function (x) { if (x.schluessel) ein[x.schluessel] = x.wert || ""; });
    document.querySelectorAll("[data-cms-text]").forEach(function (x) { var k = x.dataset.cmsText; if (ein[k]) x.textContent = ein[k]; });
    var mail = ein.email;
    if (mail && /^[^@\s]+@[^@\s]+$/.test(mail)) {
      document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
        var alt = a.getAttribute("href").slice(7).split("?")[0];
        if (alt === mail) return;
        a.setAttribute("href", "mailto:" + mail + a.getAttribute("href").slice(7 + alt.length));
        if (a.textContent === alt) a.textContent = mail;
      });
      document.querySelectorAll("form[data-mail]").forEach(function (f) { f.dataset.mail = mail; });
    }
    if (url(ein.linkedin)) document.querySelectorAll('a[href*="linkedin.com/"]').forEach(function (a) { a.setAttribute("href", ein.linkedin); });
    document.querySelectorAll("[data-cms-instagram]").forEach(function (li) {
      var u = url(ein.instagram);
      li.innerHTML = u ? '<a href="' + h(u) + '" rel="me">Instagram</a>' : "";
      li.hidden = !u;
    });
    return ein;
  }

  // ------------------------------------------------ Ablauf: nur holen, was die Seite braucht
  var braucht = { Einstellungen: true };
  var karte = { "themen-start": "Positionen", "positionen-liste": "Positionen", "positionen-sprung": "Positionen", position: "Positionen", folgen: "Termine", anlaesse: "Termine",
    serie: "News", medienberichte: "News", stimmen: "Stimmen", gesagt: "Rueckmeldungen" };
  document.querySelectorAll("[data-cms]").forEach(function (x) { if (karte[x.dataset.cms]) braucht[karte[x.dataset.cms]] = true; });
  abstimmungAnzeigen({});

  post("oauth2/token", { clientId: CLIENT, grantType: "anonymous" }).then(function (d) {
    var ids = Object.keys(braucht);
    return Promise.all(ids.map(function (id) { return sammlung(d.access_token, id); })).then(function (r) {
      var s = {};
      ids.forEach(function (id, i) { s[id] = r[i]; });
      return s;
    });
  }).then(function (s) {
    var ein = einstellungen(s.Einstellungen || []);
    if (s.Positionen) positionen(s.Positionen);
    abstimmungAnzeigen(ein);
    if (s.Termine) termine(s.Termine);
    if (s.News) news(s.News);
    if (s.Stimmen) stimmen(s.Stimmen);
    if (s.Rueckmeldungen) rueckmeldungen(s.Rueckmeldungen, ein);
    document.documentElement.dataset.cms = "aktuell";
  }).catch(function () { document.documentElement.dataset.cms = "gebaut"; });
})();
