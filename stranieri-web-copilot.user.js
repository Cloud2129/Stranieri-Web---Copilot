// ==UserScript==
// @name         Stranieri WEB - Copilot
// @namespace    stranieri-web-copilot
// @version      0.21.3
// @description  Assistente operativo per pratiche Stranieri WEB.
// @author       Jurij Rella
// @homepageURL  https://github.com/Cloud2129/Stranieri-Web---Copilot
// @supportURL   https://github.com/Cloud2129/Stranieri-Web---Copilot/issues
// @updateURL    https://raw.githubusercontent.com/Cloud2129/Stranieri-Web---Copilot/main/stranieri-web-copilot.user.js
// @downloadURL  https://raw.githubusercontent.com/Cloud2129/Stranieri-Web---Copilot/main/stranieri-web-copilot.user.js
// @match        http://*/StranieriWeb/*
// @match        https://*/StranieriWeb/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  var KEY = "STRANIERI_WEB_COPILOT_DATI";
  var KEY_PRIMA_COPIA = "STRANIERI_WEB_COPILOT_PRIMA_COPIA";
  var HUD_POS_KEY = "STRANIERI_WEB_COPILOT_HUD_POS";
  var HUD_MIN_KEY = "STRANIERI_WEB_COPILOT_HUD_MIN";
  var CAMPI = {
    "cognome": ["cognome"],
    "nome": ["nome"],
    "sesso": ["sesso"],
    "nazionalita": ["nazionalita", "nazione nascita", "nazione di nascita", "nazionalita dello straniero"],
    "data nascita": ["datanascitastraniero", "data nascita", "data di nascita"],
    "giorno nascita": ["giornodinascita", "giorno di nascita"],
    "mese nascita": ["mesedinascita", "mese di nascita"],
    "anno nascita": ["annodinascita", "anno di nascita"],
    "codice fiscale": ["codicefiscalestraniero", "codice fiscale"],
    "stato civile": ["statocivile", "stato civile"],
    "luogo nascita": ["luogonascitastraniero", "luogo nascita", "luogo di nascita"],
    "cittadinanza": ["cittadinanza", "cittadinanza dello straniero"],
    "clandestino": ["clandestino"],
    "dec crsr": ["deccrsr", "riconoscimento rifugiato"],
    "ruolo": ["ruolo"],
    "data frontiera": ["datafrontiera", "data ingresso frontiera"],
    "frontiera": ["frontiera", "frontiera d ingresso"],
    "tipo visto": ["tipovisto", "tipo del visto ingresso", "tipo del visto d ingresso"],
    "numero visto": ["numerovisto", "numero visto"],
    "data visto": ["datavisto", "data visto ingresso", "data visto d ingresso"],
    "data scadenza visto": ["datascadenzavisto", "data scadenza visto"],
    "visto rilasciato da": ["vistorilasciatoda", "autorita che ha rilasciato il visto ingresso", "autorita che ha rilasciato il visto d ingresso"],
    "motivo visto": ["motivovisto", "motivo visto"],
    "motivo soggiorno": ["motivosoggiorno", "motivazione del soggiorno", "motivo del soggiorno"],
    "professione": ["professione", "professione esercitata"],
    "mezzi sostentamento": ["mezzisostentamento", "mezzi di sostentamento"],
    "coniuge": ["coniuge", "cognome e o nome del coniuge"],
    "referenze": ["referenze", "eventuali referenze"],
    "categorie speciali": ["categoriespeciali", "categorie speciali relative al titolare del foglio di soggiorno", "categorie speciali"],
    "codice attenzione": ["codiceattenzione", "codice attenzione"],
    "data prima dichiarazione": ["dataprimadichiarazione", "data di presentazione prima dichiarazione"],
    "data scadenza pd": ["datascadenzapd", "data scadenza pd", "data di scadenza della prima dichiarazione"]
  };

  function trim(s) {
    return String(s || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
  }

  function norm(s) {
    return trim(s).toLowerCase()
      .replace(/autoacquisitore.*/g, "")
      .replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u").replace(/ç/g, "c")
      .replace(/à/g, "a").replace(/è/g, "e").replace(/é/g, "e")
      .replace(/ì/g, "i").replace(/ò/g, "o").replace(/ù/g, "u")
      .replace(/[^a-z0-9]+/g, " ");
  }

  function canonical(raw) {
    var key = norm(raw);
    var campo;
    var aliases;
    var i;

    if (!key) return "";
    for (campo in CAMPI) {
      if (CAMPI.hasOwnProperty(campo)) {
        aliases = CAMPI[campo];
        for (i = 0; i < aliases.length; i = i + 1) {
          if (key === norm(aliases[i])) return campo;
        }
      }
    }
    return "";
  }

  function getLabel(el) {
    var id;
    var label;
    var td;
    var tr;
    var cells;
    var i;
    var idx;
    var txt;

    id = el.getAttribute("id");
