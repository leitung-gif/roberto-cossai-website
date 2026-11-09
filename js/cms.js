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
    return { id: x.slug, titel: x.titel || "", start: !!x.startseite, frage: x.frage || "", zuruf: x.zuruf || "Säg mer, wie.", kern: x.kern || "",
      kurz: x.kurztext || "", stehe: x.langtext || "", belegt: x.belegt || "", qn: x.quelleName || "", ql: url(x.quelleLink), preis: x.preis || "", voran: x.naechsterSchritt || "" };
  }
  function themaZeile(t, offen) {
    return '<details class="thema-zeile" name="thema"' + (offen ? " open" : "") + '>\n<summary><span class="thema-marke">' + h(t.titel) + '</span><span class="thema-frage-gross">' + h(t.frage) +
      '</span><span class="zeichen" aria-hidden="true"></span></summary>\n<div class="thema-antwort"><p class="thema-kern">' + h(t.kern) + "</p><p>" + h(t.kurz) +
      '</p>\n<p class="thema-wege"><a class="knopf knopf-mundart" lang="gsw" href="' + B + "/kontakt.html?thema=" + h(t.id) + '">' + h(t.zuruf) + '</a><a href="' + B +
      "/positionen/" + h(t.id) + '.html">Meine Position lesen</a></p></div>\n</details>';
  }
  function themaBlock(t) {
    var l = B + "/positionen/" + h(t.id) + ".html";
    return '<section class="thema" id="' + h(t.id) + '"><div class="raster">\n<h2><a class="thema-link" href="' + l + '">' + h(t.titel) + '</a></h2>\n<div class="thema-text"><p class="thema-kern">' +
      h(t.kern) + "</p><p>" + h(t.kurz) + '</p>\n<p class="thema-weiter"><a href="' + l + '">Ganze Position lesen</a></p></div>\n</div></section>';
  }
  function sprung(liste, ohne) {
    return liste.filter(function (t) { return t.id !== ohne; }).map(function (t) { return '<li><a href="' + B + "/positionen/" + h(t.id) + '.html">' + h(t.titel) + "</a></li>"; }).join("");
  }
  function positionInhalt(t, liste) {
    var f = "";
    if (t.belegt) f += "<div><dt>Was belegt ist</dt><dd>" + h(t.belegt) + (t.qn && t.ql ? ' <a class="quelle" href="' + h(t.ql) + '" rel="noopener">' + h(t.qn) + "</a>" : "") + "</dd></div>";
    f += "<div><dt>Wo ich stehe</dt><dd>" + h(t.stehe) + "</dd></div>";
    if (t.preis) f += "<div><dt>Was es kostet</dt><dd>" + h(t.preis) + "</dd></div>";
    if (t.voran) f += "<div><dt>Was ich als Nächstes tue</dt><dd>" + h(t.voran) + "</dd></div>";
    if (t.id === "erreichbarkeit") f += '<div><dt>Mein Engagement</dt><dd>Erweitertes Komitee der <a href="https://www.parkraumgestaltung.ch/">Initiative «Ja zu einer quartierverträglichen Parkierung in der Stadt Luzern»</a></dd></div>';
    if (t.id === "sicherheit") f += '<div><dt>Im Video</dt><dd>Die Serie Gewalt in drei Teilen steht unter <a href="' + B + '/beitraege.html">Beiträge</a>.</dd></div>';
    return '<section class="flaeche-marke seitenkopf"><div class="raster">\n<nav class="brotkrume" aria-label="Brotkrume"><ol><li><a href="' + B + '/">Start</a></li><li><a href="' + B +
      '/positionen.html">Positionen</a></li><li aria-current="page">' + h(t.titel) + "</li></ol></nav>\n<h1>" + h(t.titel) + '</h1>\n<p class="einstieg">' + h(t.kern) +
      '</p>\n</div></section>\n<section class="thema"><div class="raster">\n<h2>Meine Position</h2>\n<div class="thema-text"><p class="thema-kern">' + h(t.kurz) +
      '</p><dl class="thema-felder">' + f + '</dl>\n<div class="thema-frage"><p>' + h(t.frage) + '</p><a lang="gsw" href="' + B + "/kontakt.html?thema=" + h(t.id) + '">' + h(t.zuruf) +
      '</a></div></div>\n</div></section>\n<section class="flaeche-nebel abschnitt"><div class="raster">\n<h2 class="abschnitt-titel">Weitere Positionen</h2>\n<ul class="sprungliste">' +
      sprung(liste, t.id) + "</ul>\n</div></section>";
  }
  function positionen(daten) {
    var liste = sichtbar(daten).filter(function (x) { return x.slug; }).sort(reihe).map(thema);
    if (!liste.length) return;
    document.querySelectorAll('[data-cms="themen-start"]').forEach(function (x) {
      var offen = x.querySelector("details[open] .thema-marke");
      var start = liste.filter(function (t) { return t.start; });
      var o = offen ? offen.textContent : (start[0] || {}).titel;
      var neu = start.map(function (t) { return themaZeile(t, t.titel === o); }).join("");
      if (x.innerHTML !== neu) x.innerHTML = neu;
    });
    setzen('[data-cms="positionen-liste"]', liste.map(themaBlock).join(""));
    setzen('[data-cms="positionen-sprung"]', sprung(liste));
    document.querySelectorAll('[data-cms="position"]').forEach(function (m) {
      var t = liste.filter(function (x) { return x.id === m.dataset.slug; })[0];
      if (t) { var neu = positionInhalt(t, liste); if (m.innerHTML.trim() !== neu) m.innerHTML = neu; }
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
    if (s.Termine) termine(s.Termine);
    if (s.News) news(s.News);
    if (s.Stimmen) stimmen(s.Stimmen);
    if (s.Rueckmeldungen) rueckmeldungen(s.Rueckmeldungen, ein);
    document.documentElement.dataset.cms = "aktuell";
  }).catch(function () { document.documentElement.dataset.cms = "gebaut"; });
})();
