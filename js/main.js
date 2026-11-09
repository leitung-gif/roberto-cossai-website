/* Roberto Cossai. Ohne dieses Skript bleibt alles lesbar und die Navigation offen. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var knopf = document.querySelector(".menue-knopf");
  var nav = document.querySelector(".nav");
  if (knopf && nav) {
    knopf.addEventListener("click", function () {
      var offen = nav.classList.toggle("offen");
      knopf.setAttribute("aria-expanded", offen ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("offen")) {
        nav.classList.remove("offen");
        knopf.setAttribute("aria-expanded", "false");
        knopf.focus();
      }
    });
  }

  // Mobil: fester Knopf weicht, solange ein anderer Aufruf im Bild ist
  var aufrufe = document.querySelectorAll(".hero-aktion, .schluss-text .knopf, form[data-modus]");
  if (aufrufe.length && "IntersectionObserver" in window) {
    var sichtbar = new Set();
    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (x) { if (x.isIntersecting) sichtbar.add(x.target); else sichtbar.delete(x.target); });
      document.body.classList.toggle("aktion-sichtbar", sichtbar.size > 0);
    });
    aufrufe.forEach(function (a) { beobachter.observe(a); });
  }

  // Film: YouTube lädt erst nach dem Klick. Im Entwurf ohne Video nur ein Hinweis.
  var ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var film = document.querySelector(".film");
  if (film) {
    film.querySelector(".film-start").addEventListener("click", function (e) {
      e.preventDefault();
      var id = film.dataset.youtube;
      if (!id) { film.querySelector(".film-hinweis").hidden = false; return; }
      var rahmen = document.createElement("iframe");
      rahmen.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&cc_load_policy=1";
      rahmen.title = "Roberto Cossai stellt sich vor";
      rahmen.allow = "autoplay; encrypted-media; fullscreen";
      rahmen.allowFullscreen = true;
      film.replaceChildren(rahmen);
    });
  }

  // Stimmen: Knöpfe führen die Spur, Wischen und Tastatur gehen ohne sie
  var spur = document.querySelector(".stimmen-spur");
  if (spur) {
    var steuerung = document.querySelector(".stimmen-steuerung");
    var zahl = steuerung.querySelector(".stimmen-zahl");
    var knoepfe = steuerung.querySelectorAll("button");
    var karten = spur.children;
    var stelle = 0;
    var aktuell = function () {
      var best = 0, abstand = Infinity;
      for (var i = 0; i < karten.length; i++) {
        var d = Math.abs(karten[i].offsetLeft - karten[0].offsetLeft - spur.scrollLeft);
        if (d < abstand) { abstand = d; best = i; }
      }
      return best;
    };
    var melden = function () {
      var i = aktuell();
      var ende = spur.scrollLeft + spur.clientWidth >= spur.scrollWidth - 2;
      if (ende) i = karten.length - 1;
      stelle = i;
      zahl.textContent = (i + 1) + " von " + karten.length;
      knoepfe[0].disabled = spur.scrollLeft < 2;
      knoepfe[1].disabled = ende;
    };
    steuerung.hidden = false;
    knoepfe.forEach(function (k) {
      k.addEventListener("click", function () {
        var ziel = karten[Math.max(0, Math.min(karten.length - 1, stelle + Number(k.dataset.schritt)))];
        spur.scrollTo({ left: ziel.offsetLeft - karten[0].offsetLeft, behavior: ruhig ? "auto" : "smooth" });
      });
    });
    var wartet = false;
    spur.addEventListener("scroll", function () {
      if (wartet) return;
      wartet = true;
      requestAnimationFrame(function () { wartet = false; melden(); });
    }, { passive: true });
    melden();
  }

  // Luzerner Punktfahne: bewegt erst im Bild, unter reduzierter Bewegung bleibt die stille Fassung
  var fahne = document.querySelector(".fahne video");
  if (fahne && !ruhig && "IntersectionObserver" in window) {
    var basis = document.documentElement.dataset.basis || "";
    new IntersectionObserver(function (eintraege, b) {
      if (!eintraege[0].isIntersecting) return;
      b.disconnect();
      fahne.src = basis + fahne.dataset.video;
      fahne.addEventListener("playing", function () { fahne.parentNode.classList.add("laeuft"); }, { once: true });
      var p = fahne.play();
      if (p && p.catch) p.catch(function () { /* Autoplay gesperrt: still bleiben */ });
    }, { rootMargin: "200px" }).observe(fahne.parentNode);
  }

  // Tage bis zur Wahl, immer aktuell
  document.querySelectorAll("[data-wahl]").forEach(function (x) {
    var tage = Math.ceil((new Date(2027, 2, 21) - new Date()) / 864e5);
    if (tage > 1) x.textContent = "noch " + tage + " Tage";
    else if (tage === 1) x.textContent = "noch 1 Tag";
    else x.textContent = "Wahltag";
  });

  // Kontakt: Thema aus dem Aufruf übernehmen, damit der erste Schritt schon getan ist
  var ortFeld = document.getElementById("ort");
  var liste = document.getElementById("themen-liste");
  var themen = liste ? JSON.parse(liste.textContent) : {};
  var gewaehlt = new URLSearchParams(location.search).get("thema");
  if (ortFeld && themen[gewaehlt]) ortFeld.value = themen[gewaehlt];

  var start = Date.now();
  document.querySelectorAll("form[data-modus]").forEach(function (form) {
    var antwort = form.querySelector(".antwort");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var gut = true;
      form.querySelectorAll("[required]").forEach(function (feld) {
        var meldung = form.querySelector('[data-fehler="' + feld.id + '"]');
        var ok = feld.type === "checkbox" ? feld.checked : feld.checkValidity();
        feld.setAttribute("aria-invalid", ok ? "false" : "true");
        if (meldung) meldung.textContent = ok ? "" : feld.dataset.meldung;
        if (!ok && gut) { feld.focus(); gut = false; }
      });
      if (!gut) return;
      var topf = form.querySelector(".topf input");
      if ((topf && topf.value) || Date.now() - start < 2000) return;
      if (form.dataset.modus === "mail") {
        // Entwurf ohne Server: Nachricht an das Postfach, veröffentlicht wird nur nach Prüfung
        var wert = function (id) { var f = form.querySelector("#" + id); return f ? (f.type === "checkbox" ? (f.checked ? "ja" : "nein") : f.value.trim()) : ""; };
        var text = "Ort oder Anliegen: " + wert("ort") + "\n\n" + wert("anliegen") + "\n\nName: " + wert("name") +
          "\nQuartier: " + wert("quartier") + "\nE-Mail: " + wert("email") +
          "\nDarf nach Prüfung erscheinen: " + wert("oeffentlich") + "\nNachfragen erlaubt: " + wert("rueckfrage");
        location.href = "mailto:" + form.dataset.mail + "?subject=" + encodeURIComponent("Säg mer, wo: " + wert("ort")) + "&body=" + encodeURIComponent(text);
        antwort.textContent = form.dataset.danke;
        return;
      }
      if (form.dataset.modus === "prototyp") {
        antwort.textContent = form.dataset.danke + " (Vorschau: nichts wurde gesendet.)";
        form.reset();
        return;
      }
      fetch(form.action, { method: "POST", body: new FormData(form) }).then(function (r) {
        return r.ok ? r.json() : { success: false };
      }).then(function (d) {
        antwort.textContent = d.success ? form.dataset.danke : "Das hat nicht geklappt. Schreib mir direkt per E-Mail.";
        if (d.success) form.reset();
      }).catch(function () {
        antwort.textContent = "Das hat nicht geklappt. Schreib mir direkt per E-Mail.";
      });
    });
  });
})();
