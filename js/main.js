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
