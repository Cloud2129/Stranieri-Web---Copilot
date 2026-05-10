// ==UserScript==
// @name         Stranieri WEB - Copilot
// @namespace    stranieri-web-copilot
// @version      0.20.8
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
    if (id) {
      label = document.querySelector("label[for='" + id.replace(/'/g, "\\'") + "']");
      if (label) return trim(label.innerText || label.textContent);
    }

    td = el.parentNode;
    while (td && td.tagName && td.tagName.toLowerCase() !== "td") td = td.parentNode;
    if (!td) return "";

    tr = td.parentNode;
    if (!tr || !tr.children) return "";

    cells = tr.children;
    idx = -1;
    for (i = 0; i < cells.length; i = i + 1) {
      if (cells[i] === td) idx = i;
    }
    for (i = idx - 1; i >= 0; i = i - 1) {
      txt = trim(cells[i].innerText || cells[i].textContent);
      if (txt) return txt.replace(/:$/, "");
    }
    return "";
  }

  function getKey(el) {
    var speciale = getKeySpeciale(el);
    var options = [
      getLabel(el),
      el.getAttribute("name"),
      el.getAttribute("id"),
      el.getAttribute("title")
    ];
    var i;
    var found;

    if (speciale === "skip") return "";
    if (speciale) return speciale;

    for (i = 0; i < options.length; i = i + 1) {
      found = canonical(options[i]);
      if (found) return found;
    }
    return "";
  }

  function getKeySpeciale(el) {
    var title = norm(el.getAttribute("title"));
    var value = norm(el.value);
    var size = String(el.getAttribute("size") || "");
    var max = String(el.getAttribute("maxlength") || "");

    if (title === "numero conviventi" || title === "conviventi") {
      return "skip";
    }

    if (title === "autorita che ha rilasciato il documento" && size === "20" && max === "15") {
      if (value === "nessuno" || value === "ordinario" || value === "diplomatico" || value === "servizi special") {
        return "tipo visto";
      }
    }
    return "";
  }

  function allControls() {
    return document.querySelectorAll("input,select,textarea");
  }

  function usable(el) {
    var type = String(el.getAttribute("type") || el.type || "").toLowerCase();
    if (el.disabled) return false;
    if (type === "hidden") return false;
    if (type === "button") return false;
    if (type === "submit") return false;
    if (type === "reset") return false;
    return true;
  }

  function selectedText(sel) {
    if (sel.selectedIndex < 0) return "";
    return trim(sel.options[sel.selectedIndex].text);
  }

  function primaCopia() {
    var dati = {
      cognome: valoreCampoPerChiave("cognome") || valoreCampoByName("cognome"),
      nome: valoreCampoPerChiave("nome") || valoreCampoByName("nome"),
      giorno: valoreCampoPerChiave("giorno nascita") || valoreCampoByName("giornoDiNascita"),
      mese: valoreCampoPerChiave("mese nascita") || valoreCampoByName("meseDiNascita"),
      anno: valoreCampoPerChiave("anno nascita") || valoreCampoByName("annoDiNascita")
    };
    var dataUnica = valoreCampoPerChiave("data nascita") || valoreCampoByName("dataNascitaStraniero");
    var m;

    if ((!dati.giorno || !dati.mese || !dati.anno) && dataUnica) {
      m = String(dataUnica).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) {
        dati.giorno = m[1].length === 1 ? "0" + m[1] : m[1];
        dati.mese = m[2].length === 1 ? "0" + m[2] : m[2];
        dati.anno = m[3];
      }
    }

    localStorage.setItem(KEY_PRIMA_COPIA, JSON.stringify(dati));
    msg("1^ copia salvata: " + [dati.cognome, dati.nome, dati.giorno + "/" + dati.mese + "/" + dati.anno].join(" "));
    logPrimaCopia(dati);
  }

  function valoreCampoByName(name) {
    var el = document.getElementsByName(name)[0] || document.getElementById(name);
    if (!el) return "";
    return trim(el.value);
  }

  function valoreCampoPerChiave(chiave) {
    var controls = allControls();
    var i;
    var el;

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      if (getKey(el) === chiave) return valoreCampo(el);
    }
    return "";
  }

  function logPrimaCopia(dati) {
    var box = document.getElementById("autoacq_log");
    if (!box) return;
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">1^ Copia</div>" +
      "<div><strong>cognome</strong>: " + escapeHtml(dati.cognome) + "</div>" +
      "<div><strong>nome</strong>: " + escapeHtml(dati.nome) + "</div>" +
      "<div><strong>data nascita</strong>: " + escapeHtml(dati.giorno + "/" + dati.mese + "/" + dati.anno) + "</div>";
  }

  function copia() {
    var controls = allControls();
    var dati = {};
    var i;
    var el;
    var key;
    var type;
    var copiati = [];

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      key = getKey(el);
      if (!key) continue;
      type = String(el.type || "").toLowerCase();

      if (el.tagName.toLowerCase() === "select") {
        dati[key] = { value: el.value, text: selectedText(el), tag: "select" };
      } else if (type === "checkbox" || type === "radio") {
        dati[key] = { value: el.value, checked: el.checked, tag: type };
      } else {
        dati[key] = { value: el.value, tag: "text" };
      }
      if (key === "data nascita") salvaDataNascitaSpezzata(dati, el.value);
      evidenzia(el, "copiato");
      if (copiati.indexOf(key) < 0) copiati.push(key);
    }

    localStorage.setItem(KEY, JSON.stringify(dati));
    salvaValoriControllo(dati);
    localStorage.setItem(KEY, JSON.stringify(dati));
    msg("Copiati " + Object.keys(dati).length + " campi.");
    logCampi("Copiati", copiati, dati);
  }

  function salvaValoriControllo(dati) {
    var controls = allControls();
    var i;
    var el;
    var title;

    if (!dati.__controlli) dati.__controlli = {};
    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      title = norm(el.getAttribute("title"));
      if (title === "indirizzo") dati.__controlli.indirizzo = trim(el.value);
      if (title === "numero documento") dati.__controlli.numeroDocumento = trim(el.value);
      if (title === "motivazione del soggiorno") dati.__controlli.motivoSoggiorno = trim(el.value);
    }
  }

  function trovaOrigine(dati, key) {
    if (dati[key]) return dati[key];
    return null;
  }

  function scegliSelect(sel, origine) {
    var i;
    var opt;
    var val = norm(origine.value);
    var txt = norm(origine.text);
    var rawValue = norm(origine.value);

    for (i = 0; i < sel.options.length; i = i + 1) {
      opt = sel.options[i];
      if (norm(opt.value) === val && val) {
        sel.value = opt.value;
        return true;
      }
    }
    for (i = 0; i < sel.options.length; i = i + 1) {
      opt = sel.options[i];
      if (norm(opt.text) === txt && txt) {
        sel.value = opt.value;
        return true;
      }
    }
    for (i = 0; i < sel.options.length; i = i + 1) {
      opt = sel.options[i];
      if (txt && norm(opt.text).indexOf(txt) >= 0) {
        sel.value = opt.value;
        return true;
      }
    }
    for (i = 0; i < sel.options.length; i = i + 1) {
      opt = sel.options[i];
      if (rawValue && norm(opt.text).indexOf(rawValue) >= 0) {
        sel.value = opt.value;
        return true;
      }
    }
    for (i = 0; i < sel.options.length; i = i + 1) {
      opt = sel.options[i];
      if (rawValue && paroleCompatibili(norm(opt.text), rawValue)) {
        sel.value = opt.value;
        return true;
      }
    }
    return false;
  }

  function paroleCompatibili(opzione, valore) {
    var parole = valore.split(" ");
    var buone = 0;
    var i;

    for (i = 0; i < parole.length; i = i + 1) {
      if (parole[i].length < 4) continue;
      if (opzione.indexOf(parole[i]) >= 0) buone = buone + 1;
    }
    return buone > 0;
  }

  function fire(el) {
    var ev = document.createEvent("HTMLEvents");
    ev.initEvent("change", true, false);
    el.dispatchEvent(ev);
  }

  function incolla() {
    var raw = localStorage.getItem(KEY);
    var dati;
    var controls;
    var i;
    var el;
    var key;
    var origine;
    var ok = 0;
    var missing = 0;
    var avvisi = [];
    var critici = [];
    var fixes = [];
    var incollati = [];
    var nonTrovati = [];
    var ctxPermesso;
    var regolaPermesso;

    if (!raw) {
      applicaControlli(null, fixes);
      applicaRegolaPermesso(fixes, avvisi, critici, null);
      ctxPermesso = contestoPermessoCorrente();
      regolaPermesso = ctxPermesso ? trovaRegolaPermesso(ctxPermesso) : null;
      msg("Modalita senza vecchia pratica: controlli e note applicati sulla pratica nuova.");
      logTecnico({
        modalita: "Primo rilascio / senza vecchia pratica",
        stato: critici.length ? "Critico" : (avvisi.length ? "Con avvisi" : "OK"),
        regola: regolaPermesso ? regolaPermesso.codice : "",
        incollati: [],
        nonTrovati: [],
        avvisi: avvisi,
        critici: critici,
        fixes: fixes
      });
      mostraAvvisi(avvisi);
      mostraCritici(critici);
      mostraFixes(fixes);
      return;
    }
    dati = JSON.parse(raw);
    ctxPermesso = contestoPermessoCorrente(dati);
    regolaPermesso = ctxPermesso ? trovaRegolaPermesso(ctxPermesso) : null;
    incollaDataNascitaDiretta(dati);
    applicaControlli(dati, fixes);
    confrontaValoriSensibili(dati, avvisi);
    applicaRegolaPermesso(fixes, avvisi, critici, dati);
    controls = allControls();

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      key = getKey(el);
      if (!key) continue;

      if (key === "giorno nascita" || key === "mese nascita" || key === "anno nascita") {
        if (riempiDataNascita(el, key, dati)) {
          ok = ok + 1;
          evidenzia(el, "incollato");
          fire(el);
          if (incollati.indexOf(key) < 0) incollati.push(key);
        } else {
          missing = missing + 1;
          if (nonTrovati.indexOf(key) < 0) nonTrovati.push(key);
        }
        continue;
      }

      origine = trovaOrigine(dati, key);
      if (!origine) {
        missing = missing + 1;
        if (nonTrovati.indexOf(key) < 0) nonTrovati.push(key);
        continue;
      }

      if (key === "luogo nascita") controllaLuogoNascita(el, origine, avvisi);
      if (key === "motivo soggiorno") {
        if (applicaConversioneFamiliareUE(el, origine, critici, fixes)) {
          ok = ok + 1;
          if (incollati.indexOf(key) < 0) incollati.push(key);
          fire(el);
        } else if (motivoSoggiornoVuoto(el)) {
          if (el.tagName.toLowerCase() === "select") {
            if (scegliSelect(el, origine)) {
              ok = ok + 1;
              evidenzia(el, "incollato");
              if (incollati.indexOf(key) < 0) incollati.push(key);
              fire(el);
              fixes.push("Motivazione soggiorno compilata perche' era vuota.");
            }
          } else {
            el.value = origine.value || "";
            ok = ok + 1;
            evidenzia(el, "incollato");
            if (incollati.indexOf(key) < 0) incollati.push(key);
            fire(el);
            fixes.push("Motivazione soggiorno compilata perche' era vuota.");
          }
        } else {
          controllaMotivoSoggiorno(el, origine, avvisi, critici);
        }
        continue;
      }

      if (el.tagName.toLowerCase() === "select") {
        if (scegliSelect(el, origine)) {
          ok = ok + 1;
          evidenzia(el, "incollato");
          if (incollati.indexOf(key) < 0) incollati.push(key);
        }
      } else if (origine.checked !== undefined) {
        el.checked = origine.checked;
        ok = ok + 1;
        evidenzia(el, "incollato");
        if (incollati.indexOf(key) < 0) incollati.push(key);
      } else {
        el.value = origine.value || "";
        ok = ok + 1;
        evidenzia(el, "incollato");
        if (incollati.indexOf(key) < 0) incollati.push(key);
      }
      fire(el);
    }
    msg("Incollati " + ok + " campi. Non trovati " + missing + ".");
    logTecnico({
      modalita: "Con vecchia pratica",
      stato: critici.length ? "Critico" : (avvisi.length ? "Con avvisi" : "OK"),
      regola: regolaPermesso ? regolaPermesso.codice : "",
      incollati: incollati,
      nonTrovati: nonTrovati,
      avvisi: avvisi,
      critici: critici,
      fixes: fixes,
      dati: dati
    });
    mostraAvvisi(avvisi);
    mostraCritici(critici);
    mostraFixes(fixes);
  }

  function incollaPrimaCopia() {
    var raw = localStorage.getItem(KEY_PRIMA_COPIA);
    var dati;
    var ok = 0;

    if (!raw) return false;
    try {
      dati = JSON.parse(raw);
    } catch (e) {
      return false;
    }

    ok = ok + impostaCampoSemplice("cognome", dati.cognome);
    ok = ok + impostaCampoSemplice("nome", dati.nome);
    ok = ok + impostaCampoSemplice("giornoDiNascita", dati.giorno);
    ok = ok + impostaCampoSemplice("meseDiNascita", dati.mese);
    ok = ok + impostaCampoSemplice("annoDiNascita", dati.anno);

    if (!ok) return false;
    msg("1^ copia incollata: " + ok + " campi.");
    logPrimaCopia(dati);
    return true;
  }

  function impostaCampoSemplice(name, value) {
    var el;
    if (!value) return 0;
    el = document.getElementsByName(name)[0] || document.getElementById(name);
    if (!el) return 0;
    el.value = value;
    evidenzia(el, "incollato");
    fire(el);
    return 1;
  }

  function applicaControlli(dati, fixes) {
    var importo = leggiImportoPagina();
    var mesiValidita = 0;

    if (importo === "130,46") {
      impostaSelectPerValore("docSoggiorno", "L", "Documento di soggiorno impostato su PERM. SOGG. LUNGO PERIODO per importo 130,46", fixes);
      impostaSelectPerValore("tipoPratica", "R", "Tipo pratica impostato su RINNOVO SOGGIORNO per importo 130,46", fixes);
      impostaValiditaSoggiorno("Y", "10 ANNI", "Validita soggiorno impostata su 10 ANNI per importo 130,46", fixes);
      ripetiValiditaSoggiorno("Y", "10 ANNI");
      mesiValidita = 120;
    }
    if (importo === "80,46") {
      impostaValiditaSoggiorno("T", "2 ANNI", "Validita soggiorno impostata su 2 ANNI per importo 80,46", fixes);
      ripetiValiditaSoggiorno("T", "2 ANNI");
      mesiValidita = 24;
    }
    if (importo === "70,46") {
      impostaValiditaSoggiorno("S", "12 MESI", "Validita soggiorno impostata su 12 MESI per importo 70,46", fixes);
      ripetiValiditaSoggiorno("S", "12 MESI");
      mesiValidita = 12;
    }

    applicaControlloRinnovo(mesiValidita, fixes);
  }

  function leggiImportoPagina() {
    var controls = allControls();
    var i;
    var el;

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (norm(el.getAttribute("title")) === "importo") return normalizzaImporto(el.value);
    }
    return "";
  }

  function normalizzaImporto(value) {
    return trim(value).replace(/\./g, "").replace(/\s/g, "");
  }

  function impostaSelectPerValore(name, value, avviso, fixes) {
    var el = document.getElementsByName(name)[0] || document.getElementById(name);
    if (!el || el.tagName.toLowerCase() !== "select") return;
    if (el.value === value) return;
    el.value = value;
    evidenzia(el, "incollato");
    fire(el);
    fixes.push(avviso);
  }

  function impostaValiditaSoggiorno(value, testo, avviso, fixes) {
    var el = document.getElementsByName("validitaSoggiorno")[0] || document.getElementById("validitaSoggiorno");
    var ok;

    ok = forzaSelect(el, value, testo);
    if (!ok) return;

    evidenzia(el, "incollato");
    fire(el);
    fireClick(el);
    if (typeof window.gestisciScadenzaRinnovo === "function") {
      window.gestisciScadenzaRinnovo((document.PreAcquisizioneForm && document.PreAcquisizioneForm.docSoggiorno) ? document.PreAcquisizioneForm.docSoggiorno.value : "");
    }
    fixes.push(avviso);
  }

  function ripetiValiditaSoggiorno(value, testo) {
    window.setTimeout(function () {
      var el = document.getElementsByName("validitaSoggiorno")[0] || document.getElementById("validitaSoggiorno");
      if (forzaSelect(el, value, testo)) {
        evidenzia(el, "incollato");
        fire(el);
        fireClick(el);
      }
    }, 350);
  }

  function forzaSelect(el, value, testo) {
    var impostato = false;
    var i;

    if (!el || el.tagName.toLowerCase() !== "select") return;

    for (i = 0; i < el.options.length; i = i + 1) {
      if (el.options[i].value === value) {
        el.selectedIndex = i;
        el.options[i].selected = true;
        el.value = value;
        impostato = true;
      }
    }

    if (!impostato) {
      for (i = 0; i < el.options.length; i = i + 1) {
        if (norm(el.options[i].text) === norm(testo)) {
          el.selectedIndex = i;
          el.options[i].selected = true;
          el.value = el.options[i].value;
          impostato = true;
        }
      }
    }

    return impostato;
  }

  function fireClick(el) {
    var ev = document.createEvent("HTMLEvents");
    ev.initEvent("click", true, false);
    el.dispatchEvent(ev);
  }

  function applicaControlloRinnovo(mesiValidita, fixes) {
    var tipoPratica = document.getElementsByName("tipoPratica")[0] || document.getElementById("tipoPratica");
    var dataPresentazione = document.getElementsByName("dataPresentazione")[0] || document.getElementById("dataPresentazione");
    var dataRinnovo = document.getElementsByName("dataRinnovo")[0] || document.getElementById("dataRinnovo");
    var dataScadenzaRinnovo = document.getElementsByName("dataScadenzaRinnovo")[0] || document.getElementById("dataScadenzaRinnovo");

    if (!tipoPratica || tipoPratica.value !== "R") return;

    if (dataPresentazione && dataRinnovo && dataPresentazione.value) {
      dataRinnovo.value = dataPresentazione.value;
      evidenzia(dataRinnovo, "incollato");
      fire(dataRinnovo);
    }

    if (!mesiValidita) mesiValidita = mesiDaValiditaCorrente();
    if (mesiValidita && dataScadenzaRinnovo) {
      dataScadenzaRinnovo.value = formattaDataItaliana(aggiungiMesi(new Date(), mesiValidita));
      evidenzia(dataScadenzaRinnovo, "incollato");
      fire(dataScadenzaRinnovo);
      fixes.push("Data scadenza rinnovo calcolata da oggi +" + mesiValidita + " mesi.");
    }
  }

  function mesiDaValiditaCorrente() {
    var validita = document.getElementsByName("validitaSoggiorno")[0] || document.getElementById("validitaSoggiorno");
    if (!validita) return 0;
    if (validita.value === "S") return 12;
    if (validita.value === "T") return 24;
    if (validita.value === "Y") return 120;
    return 0;
  }

  function impostaScadenzaRinnovoDaDataRinnovo(mesi, fixes) {
    var dataPresentazione = document.getElementsByName("dataPresentazione")[0] || document.getElementById("dataPresentazione");
    var dataRinnovo = document.getElementsByName("dataRinnovo")[0] || document.getElementById("dataRinnovo");
    var dataScadenzaRinnovo = document.getElementsByName("dataScadenzaRinnovo")[0] || document.getElementById("dataScadenzaRinnovo");
    var base;

    if (!dataScadenzaRinnovo) return;
    if (dataRinnovo && !trim(dataRinnovo.value) && dataPresentazione && trim(dataPresentazione.value)) {
      dataRinnovo.value = dataPresentazione.value;
      evidenzia(dataRinnovo, "incollato");
      fire(dataRinnovo);
    }

    base = dataRinnovo && trim(dataRinnovo.value) ? parseDataItaliana(dataRinnovo.value) : null;
    if (!base) return;

    dataScadenzaRinnovo.value = formattaDataItaliana(aggiungiMesi(base, mesi));
    evidenzia(dataScadenzaRinnovo, "incollato");
    fire(dataScadenzaRinnovo);
    fixes.push("Data scadenza rinnovo calcolata da data rinnovo +10 anni per CARTA UE.");
  }

  function parseDataItaliana(value) {
    var m = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var data;

    if (!m) return null;
    data = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (data.getFullYear() !== Number(m[3])) return null;
    if (data.getMonth() !== Number(m[2]) - 1) return null;
    if (data.getDate() !== Number(m[1])) return null;
    return data;
  }

  function aggiungiMesi(data, mesi) {
    var out = new Date(data.getTime());
    var giorno = out.getDate();
    out.setDate(1);
    out.setMonth(out.getMonth() + mesi);
    out.setDate(Math.min(giorno, giorniNelMese(out.getFullYear(), out.getMonth())));
    return out;
  }

  function giorniNelMese(anno, meseZeroBased) {
    return new Date(anno, meseZeroBased + 1, 0).getDate();
  }

  function formattaDataItaliana(data) {
    return pad2(data.getDate()) + "/" + pad2(data.getMonth() + 1) + "/" + data.getFullYear();
  }

  function pad2(value) {
    value = String(value);
    return value.length === 1 ? "0" + value : value;
  }

  function controllaLuogoNascita(el, origine, avvisi) {
    var attuale = trim(el.value);
    var nuovo = trim(origine.value);

    if (!attuale || !nuovo) return;
    if (motiviEquivalenti(attuale, nuovo)) return;

    avvisi.push("Luogo nascita diverso. Prima: " + nuovo + " | Adesso: " + attuale + ".");
    evidenziaAvviso(el);
  }

  function controllaMotivoSoggiorno(el, origine, avvisi, critici) {
    var attuale = valoreCampo(el);
    var nuovo = origine.text || origine.value || "";

    if (!attuale || !nuovo) return;
    if (normConfronto(attuale) === normConfronto(nuovo)) return;

    if (motivoAssistenzaMinori(nuovo) && categoriaConversioneAssistenza(attuale)) {
      evidenziaCritico(el);
      return;
    }

    if (motivoProtezioneSpecialeOSussidiaria(nuovo)) {
      if (categoriaConversioneProtezioneLavoro(attuale)) {
        evidenziaCritico(el);
        return;
      }
      critici.push("Lo straniero sta convertendo permesso di soggiorno da protezione speciale/sussidiaria! Prima: " + nuovo + " | Adesso: " + attuale + ".");
      evidenziaCritico(el);
      return;
    }

    avvisi.push("La motivazione del permesso e' cambiata. Prima: " + nuovo + " | Adesso: " + attuale + ".");
    evidenziaAvviso(el);
  }

  function applicaConversioneFamiliareUE(el, origine, critici, fixes) {
    var vecchio = (origine.text || origine.value || "");

    if (!motivoFamiliareUEArt10(vecchio)) return false;
    if (!el || el.tagName.toLowerCase() !== "select") return false;
    if (!forzaSelect(el, "UEA20", "FAMILIARE UE ART.20 DIR 2004/38/CE")) return false;

    evidenziaCritico(el);
    critici.push("Attenzione CARTA UE - verificare.");
    impostaValiditaSoggiorno("Y", "10 ANNI", "Validita soggiorno impostata su 10 ANNI per CARTA UE.", fixes);
    ripetiValiditaSoggiorno("Y", "10 ANNI");
    impostaScadenzaRinnovoDaDataRinnovo(120, fixes);
    return true;
  }

  function motivoFamiliareUEArt10(value) {
    var testo = norm(value);
    return testo.indexOf("familiare ue art 10") >= 0 || testo.indexOf("uea10") >= 0;
  }

  function motivoAssistenzaMinori(value) {
    return norm(value).indexOf("assistenza minori") >= 0;
  }

  function categoriaConversioneAssistenza(value) {
    var categoria = categoriaMotivo(value);
    return categoria === "lavoro subordinato" ||
      categoria === "lavoro autonomo" ||
      categoria === "motivi familiari";
  }

  function motivoSoggiornoVuoto(el) {
    var value = norm(el.value);
    var text = norm(valoreCampo(el));

    return !value || value === "vuoto" || !text || text === "vuoto";
  }

  function motivoProtezioneSpecialeOSussidiaria(value) {
    var testo = norm(value);
    if (testo.indexOf("protezione speciale") >= 0) return true;
    if (testo.indexOf("prot speciale") >= 0) return true;
    if (testo.indexOf("art 32") >= 0 && testo.indexOf("speciale") >= 0) return true;
    if (testo.indexOf("protezione sussidiaria") >= 0) return true;
    return false;
  }

  function motivoProtezioneSpeciale(value) {
    var testo = norm(value);
    if (testo.indexOf("protezione speciale") >= 0) return true;
    if (testo.indexOf("prot speciale") >= 0) return true;
    if (testo.indexOf("art 32") >= 0 && testo.indexOf("speciale") >= 0) return true;
    return false;
  }

  function categoriaConversioneProtezioneLavoro(value) {
    var categoria = categoriaMotivo(value);
    return categoria === "lavoro subordinato" || categoria === "lavoro autonomo";
  }

  function motiviEquivalenti(a, b) {
    var ca = categoriaMotivo(a);
    var cb = categoriaMotivo(b);

    if (ca && cb) return ca === cb;
    return normConfronto(a) === normConfronto(b);
  }

  function categoriaMotivo(value) {
    var testo = norm(value);

    if (testo.indexOf("attesa occupazione") >= 0) return "attesa occupazione";
    if (testo.indexOf("lavoro subordinato") >= 0) return "lavoro subordinato";
    if (testo.indexOf("lavoro sub") >= 0) return "lavoro subordinato";
    if (testo.indexOf("motivi familiari") >= 0) return "motivi familiari";
    if (testo.indexOf("studente") >= 0) return "studente";
    if (testo.indexOf("lavoro autonomo") >= 0 || testo.indexOf("motivi commerciali") >= 0) return "lavoro autonomo";
    if (motivoProtezioneSpecialeOSussidiaria(value)) return "protezione";
    return "";
  }

  function applicaRegolaPermesso(fixes, avvisi, critici, dati) {
    var motivo = document.getElementsByName("motivoSoggiorno")[0] || document.getElementById("motivoSoggiorno");
    var docSoggiorno = document.getElementsByName("docSoggiorno")[0] || document.getElementById("docSoggiorno");
    var note = document.getElementsByName("note")[0] || document.getElementById("note");
    var ctx;
    var regola;
    var motivoTesto;
    var template;

    if (!motivo) return;
    motivoTesto = valoreCampo(motivo);
    ctx = creaContestoPermesso(motivo, docSoggiorno, dati);
    regola = trovaRegolaPermesso(ctx);

    if (!regola) return;
    applicaAvvisiRegola(regola, motivo, avvisi);
    applicaAvvisiSpecialiRegola(regola, ctx, motivo, avvisi);
    applicaCriticiRegola(regola, motivo, critici);

    if (!note || !regola.note || !regola.note.length) return;
    template = creaChecklist(regola.note);
    if (trim(note.value)) {
      avvisi.push("Campo note gia' compilato: checklist tecnica non inserita.");
      evidenziaAvviso(note);
      return;
    }

    note.value = template;
    evidenzia(note, "incollato");
    fire(note);
    if (typeof window.maxLengthNote === "function") window.maxLengthNote(note);
    fixes.push("Checklist tecnica " + regola.codice + " inserita nel campo note per " + motivoTesto + ".");
  }

  function applicaAvvisiRegola(regola, campoMotivo, avvisi) {
    var i;

    if (!regola.avvisi || !regola.avvisi.length) return;
    for (i = 0; i < regola.avvisi.length; i = i + 1) {
      avvisi.push(regola.avvisi[i]);
    }
    evidenziaAvviso(campoMotivo);
  }

  function applicaAvvisiSpecialiRegola(regola, ctx, campoMotivo, avvisi) {
    var lista;
    var i;

    if (typeof regola.avvisiSpeciali !== "function") return;
    lista = regola.avvisiSpeciali(ctx) || [];
    if (!lista.length) return;
    for (i = 0; i < lista.length; i = i + 1) {
      avvisi.push(lista[i]);
    }
    evidenziaAvviso(campoMotivo);
  }

  function applicaCriticiRegola(regola, campoMotivo, critici) {
    var i;

    if (!critici || !regola.critici || !regola.critici.length) return;
    for (i = 0; i < regola.critici.length; i = i + 1) {
      critici.push(regola.critici[i]);
    }
    evidenziaCritico(campoMotivo);
  }

  function creaContestoPermesso(motivo, docSoggiorno, dati) {
    var motivoTesto = valoreCampo(motivo);
    var docTesto = docSoggiorno ? valoreCampo(docSoggiorno) : "";
    var motivoVecchio = valoreMotivoPrecedente(dati);

    return {
      motivoTesto: motivoTesto,
      motivoNorm: norm(motivoTesto),
      categoria: categoriaMotivo(motivoTesto),
      motivoVecchio: motivoVecchio,
      motivoVecchioNorm: norm(motivoVecchio),
      conversioneAssistenzaMinori: motivoAssistenzaMinori(motivoVecchio),
      conversioneProtezione: motivoProtezioneSpecialeOSussidiaria(motivoVecchio),
      conversioneProtezioneSpeciale: motivoProtezioneSpeciale(motivoVecchio),
      docSoggiorno: docSoggiorno ? docSoggiorno.value : "",
      docTesto: docTesto,
      lungoPeriodo: !!(docSoggiorno && (docSoggiorno.value === "L" || norm(docTesto).indexOf("perm sogg lungo periodo") >= 0))
    };
  }

  function valoreMotivoPrecedente(dati) {
    var origine = dati && dati["motivo soggiorno"];
    if (!origine) return "";
    return origine.text || origine.value || "";
  }

  function contestoPermessoCorrente(dati) {
    var motivo = document.getElementsByName("motivoSoggiorno")[0] || document.getElementById("motivoSoggiorno");
    var docSoggiorno = document.getElementsByName("docSoggiorno")[0] || document.getElementById("docSoggiorno");

    if (!motivo) return null;
    return creaContestoPermesso(motivo, docSoggiorno, dati);
  }

  function trovaRegolaPermesso(ctx) {
    var regole = regolePermesso();
    var i;

    for (i = 0; i < regole.length; i = i + 1) {
      if (regole[i].quando(ctx)) return regole[i];
    }
    return null;
  }

  function creaChecklist(campi) {
    return campi.join(" \\ ");
  }

  function campoChecklist(nome) {
    return nome + ": [________]";
  }

  function regolePermesso() {
    return [
      {
        codice: "CONV PROTEZIONE LAV. SUB.",
        quando: function (ctx) {
          return ctx.conversioneProtezione && ctx.categoria === "lavoro subordinato";
        },
        critici: [
          "Lo straniero sta convertendo permesso di soggiorno da protezione speciale/sussidiaria!"
        ],
        avvisiSpeciali: function (ctx) {
          return ctx.conversioneProtezioneSpeciale ? ["Verificare data riconoscimento protezione"] : [];
        },
        note: [
          "CONVERSIONE DA PROTEZIONE",
          "LAV. SUB.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("TIPO CONTRATTO"),
          campoChecklist("RICHIESTA DI CONVERSIONE")
        ]
      },
      {
        codice: "CONV PROTEZIONE AUTONOMO",
        quando: function (ctx) {
          return ctx.conversioneProtezione && ctx.categoria === "lavoro autonomo";
        },
        critici: [
          "Lo straniero sta convertendo permesso di soggiorno da protezione speciale/sussidiaria!"
        ],
        avvisiSpeciali: function (ctx) {
          return ctx.conversioneProtezioneSpeciale ? ["Verificare data riconoscimento protezione"] : [];
        },
        note: [
          "CONVERSIONE DA PROTEZIONE",
          "AUTONOMO",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("DITTA ATTIVA"),
          campoChecklist("RICHIESTA DI CONVERSIONE")
        ]
      },
      {
        codice: "CONV ASS. MINORI LAV. SUB.",
        quando: function (ctx) {
          return ctx.conversioneAssistenzaMinori && ctx.categoria === "lavoro subordinato";
        },
        critici: [
          "Attenzione conversione da assistenza minori!"
        ],
        note: [
          "CONVERSIONE DA ASSISTENZA MINORI",
          "LAV. SUB.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("TIPO CONTRATTO")
        ]
      },
      {
        codice: "CONV ASS. MINORI AUTONOMO",
        quando: function (ctx) {
          return ctx.conversioneAssistenzaMinori && ctx.categoria === "lavoro autonomo";
        },
        critici: [
          "Attenzione conversione da assistenza minori!"
        ],
        note: [
          "CONVERSIONE DA ASSISTENZA MINORI",
          "AUTONOMO",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("DITTA ATTIVA")
        ]
      },
      {
        codice: "CONV ASS. MINORI FAM.",
        quando: function (ctx) {
          return ctx.conversioneAssistenzaMinori && ctx.categoria === "motivi familiari";
        },
        critici: [
          "Attenzione conversione da assistenza minori! Deve fare coesione!"
        ],
        note: [
          "CONVERSIONE DA ASSISTENZA MINORI",
          "FAM.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("CF TRAINANTE"),
          campoChecklist("PRATICA TRAINANTE"),
          campoChecklist("NR FAMILIARI"),
          campoChecklist("ID. ALLOGGIO"),
          campoChecklist("ESTRATTI NASCITA/MATRIMONIO")
        ]
      },
      {
        codice: "PSLP LAV. SUB.",
        quando: function (ctx) {
          return ctx.lungoPeriodo && ctx.categoria === "lavoro subordinato";
        },
        note: [
          "PSLP LAV. SUB.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("TIPO CONTRATTO"),
          campoChecklist("CASELLARIO"),
          campoChecklist("5 ANNI"),
          campoChecklist("TEST")
        ]
      },
      {
        codice: "PSLP MOT. FAM.",
        quando: function (ctx) {
          return ctx.lungoPeriodo && ctx.categoria === "motivi familiari";
        },
        avvisi: [
          "Verificare scadenza trainante."
        ],
        note: [
          "PSLP MOT. FAM.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("CF TRAINANTE"),
          campoChecklist("PRATICA TRAINANTE"),
          campoChecklist("NR FAMILIARI"),
          campoChecklist("CASELLARIO"),
          campoChecklist("TEST"),
          campoChecklist("ID. ALLOGGIO"),
          campoChecklist("5 ANNI")
        ]
      },
      {
        codice: "ATT. OCC.",
        quando: function (ctx) {
          return ctx.categoria === "attesa occupazione";
        },
        note: [
          "ATT. OCC.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("ISCRIZ. CENTRO IMPIEGO")
        ]
      },
      {
        codice: "LAV. SUB.",
        quando: function (ctx) {
          return ctx.categoria === "lavoro subordinato";
        },
        note: [
          "LAV. SUB.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("TIPO CONTRATTO")
        ]
      },
      {
        codice: "AUTONOMO",
        quando: function (ctx) {
          return ctx.categoria === "lavoro autonomo";
        },
        note: [
          "AUTONOMO",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("DITTA ATTIVA")
        ]
      },
      {
        codice: "FAM.",
        quando: function (ctx) {
          return ctx.categoria === "motivi familiari";
        },
        avvisi: [
          "Verificare scadenza trainante."
        ],
        note: [
          "FAM.",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("CF TRAINANTE"),
          campoChecklist("PRATICA TRAINANTE"),
          campoChecklist("NR FAMILIARI")
        ]
      },
      {
        codice: "STUDIO",
        quando: function (ctx) {
          return ctx.categoria === "studente";
        },
        note: [
          "STUDIO",
          campoChecklist("RES./OSP."),
          campoChecklist("MEZZI DI SOST."),
          campoChecklist("ASS. SAN."),
          campoChecklist("ISCRIZ."),
          campoChecklist("ESAMI SUPERATI")
        ]
      }
    ];
  }

  function confrontaValoriSensibili(dati, avvisi) {
    var controlli = dati.__controlli || {};

    confrontaCampoPagina(
      ["indirizzo"],
      controlli.indirizzo,
      "La residenza e' diversa da quella precedente.",
      avvisi
    );
    confrontaCampoPagina(
      ["numdoc", "numero documento"],
      controlli.numeroDocumento,
      "Attenzione: nuovo passaporto.",
      avvisi
    );
  }

  function checkFinale() {
    var avvisi = [];
    var critici = [];
    var fixes = [];
    var ctx = contestoPermessoCorrente();
    var regola = ctx ? trovaRegolaPermesso(ctx) : null;

    pulisciEvidenziazioni();
    if (!ctx) {
      critici.push("Motivazione del soggiorno non trovata: impossibile determinare la regola pratica.");
    } else {
      if (!regola) avvisi.push("Nessuna regola tecnica riconosciuta per la motivazione selezionata.");
      controllaNoteFinali(regola, avvisi);
      controllaCoerenzaImportoFinale(avvisi, critici);
      controllaRinnovoFinale(avvisi);
    }

    msg("Check finale completato: " + avvisi.length + " avvisi, " + critici.length + " critici.");
    logTecnico({
      modalita: "Check finale",
      stato: critici.length ? "Critico" : (avvisi.length ? "Con avvisi" : "OK"),
      regola: regola ? regola.codice : "",
      incollati: [],
      nonTrovati: [],
      avvisi: avvisi,
      critici: critici,
      fixes: fixes
    });
    mostraAvvisi(avvisi);
    mostraCritici(critici);
    mostraFixes(fixes);
  }

  function controllaNoteFinali(regola, avvisi) {
    var note = document.getElementsByName("note")[0] || document.getElementById("note");

    if (!regola || !regola.note || !regola.note.length) return;
    if (!note) {
      avvisi.push("Campo note non trovato.");
      return;
    }
    if (!trim(note.value)) {
      avvisi.push("Campo note vuoto: checklist tecnica non presente.");
      evidenziaAvviso(note);
    }
  }

  function controllaCoerenzaImportoFinale(avvisi, critici) {
    var importo = leggiImportoPagina();
    var doc = document.getElementsByName("docSoggiorno")[0] || document.getElementById("docSoggiorno");
    var tipo = document.getElementsByName("tipoPratica")[0] || document.getElementById("tipoPratica");
    var validita = document.getElementsByName("validitaSoggiorno")[0] || document.getElementById("validitaSoggiorno");

    if (!importo) return;
    if (importo === "130,46") {
      verificaSelectFinale(doc, "L", "PERM. SOGG. LUNGO PERIODO", "Importo 130,46: documento soggiorno non impostato su PERM. SOGG. LUNGO PERIODO.", critici, true);
      verificaSelectFinale(tipo, "R", "RINNOVO SOGGIORNO", "Importo 130,46: tipo pratica non impostato su RINNOVO SOGGIORNO.", avvisi);
      verificaSelectFinale(validita, "Y", "10 ANNI", "Importo 130,46: validita soggiorno non impostata su 10 ANNI.", avvisi);
    }
    if (importo === "80,46") {
      verificaSelectFinale(validita, "T", "2 ANNI", "Importo 80,46: validita soggiorno non impostata su 2 ANNI.", avvisi);
    }
    if (importo === "70,46") {
      verificaSelectFinale(validita, "S", "12 MESI", "Importo 70,46: validita soggiorno non impostata su 12 MESI.", avvisi);
    }
  }

  function verificaSelectFinale(el, value, testo, messaggio, lista, critico) {
    if (!el) {
      lista.push(messaggio + " Campo non trovato.");
      return;
    }
    if (el.value === value || norm(valoreCampo(el)) === norm(testo)) return;
    lista.push(messaggio);
    if (critico) evidenziaCritico(el);
    else evidenziaAvviso(el);
  }

  function controllaRinnovoFinale(avvisi) {
    var tipo = document.getElementsByName("tipoPratica")[0] || document.getElementById("tipoPratica");
    var dataRinnovo = document.getElementsByName("dataRinnovo")[0] || document.getElementById("dataRinnovo");
    var dataScadenzaRinnovo = document.getElementsByName("dataScadenzaRinnovo")[0] || document.getElementById("dataScadenzaRinnovo");

    if (!tipo || tipo.value !== "R") return;
    if (!dataRinnovo || !trim(dataRinnovo.value)) {
      avvisi.push("Tipo pratica rinnovo: data rinnovo non compilata.");
      if (dataRinnovo) evidenziaAvviso(dataRinnovo);
    }
    if (!dataScadenzaRinnovo || !trim(dataScadenzaRinnovo.value)) {
      avvisi.push("Tipo pratica rinnovo: data scadenza rinnovo non compilata.");
      if (dataScadenzaRinnovo) evidenziaAvviso(dataScadenzaRinnovo);
    }
  }

  function confrontaCampoPagina(alias, valoreVecchio, messaggio, avvisi) {
    var el;
    var attuale;

    if (!valoreVecchio) return;
    el = trovaCampoPagina(alias);
    if (!el) return;
    attuale = valoreCampo(el);
    if (!attuale) return;
    if (normConfronto(attuale) === normConfronto(valoreVecchio)) return;

    avvisi.push(messaggio + " Prima: " + valoreVecchio + " | Adesso: " + attuale + ".");
    evidenziaAvviso(el);
  }

  function trovaCampoPagina(alias) {
    var controls = allControls();
    var i;
    var el;
    var raw;
    var j;

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      raw = norm((el.getAttribute("name") || "") + " " + (el.getAttribute("id") || "") + " " + (el.getAttribute("title") || ""));
      for (j = 0; j < alias.length; j = j + 1) {
        if (raw.indexOf(norm(alias[j])) >= 0) return el;
      }
    }
    return null;
  }

  function valoreCampo(el) {
    if (el.tagName && el.tagName.toLowerCase() === "select") return selectedText(el) || el.value;
    return trim(el.value);
  }

  function normConfronto(value) {
    return norm(value).replace(/\s+/g, "");
  }

  function testoAvvisi(avvisi) {
    if (!avvisi.length) return "";
    return " ATTENZIONE: " + avvisi.join(" | ");
  }

  function riempiDataNascita(el, key, dati) {
    var origine = dati["data nascita"];
    var m;

    if (dati[key] && dati[key].value) {
      el.value = dati[key].value;
      return true;
    }

    if (!origine || !origine.value) return false;
    m = String(origine.value).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return false;

    if (key === "giorno nascita") el.value = m[1].length === 1 ? "0" + m[1] : m[1];
    if (key === "mese nascita") el.value = m[2].length === 1 ? "0" + m[2] : m[2];
    if (key === "anno nascita") el.value = m[3];
    return true;
  }

  function salvaDataNascitaSpezzata(dati, value) {
    var m = String(value || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return;
    dati["giorno nascita"] = { value: m[1].length === 1 ? "0" + m[1] : m[1], tag: "text" };
    dati["mese nascita"] = { value: m[2].length === 1 ? "0" + m[2] : m[2], tag: "text" };
    dati["anno nascita"] = { value: m[3], tag: "text" };
  }

  function incollaDataNascitaDiretta(dati) {
    impostaCampoNascita("giornoDiNascita", dati["giorno nascita"]);
    impostaCampoNascita("meseDiNascita", dati["mese nascita"]);
    impostaCampoNascita("annoDiNascita", dati["anno nascita"]);
  }

  function impostaCampoNascita(name, dato) {
    var el;
    if (!dato || !dato.value) return;
    el = document.getElementsByName(name)[0] || document.getElementById(name);
    if (!el) return;
    el.value = dato.value;
    evidenzia(el, "incollato");
    fire(el);
  }

  function evidenzia(el, stato) {
    var colore = stato === "incollato" ? "#9ff0ad" : "#c5f7ce";
    var bordo = stato === "incollato" ? "#087b2f" : "#159447";

    pulisciTitleAutoacq(el);
    if (el.getAttribute("data-autoacquisitore-avviso")) return;

    salvaStileOriginale(el);
    el.style.backgroundColor = colore;
    el.style.outline = "2px solid " + bordo;
    el.style.outlineOffset = "1px";
    el.setAttribute("data-autoacquisitore", stato);
  }

  function evidenziaAvviso(el) {
    pulisciTitleAutoacq(el);
    salvaStileOriginale(el);
    el.style.backgroundColor = "#fff3cd";
    el.style.outline = "3px solid #d97706";
    el.style.outlineOffset = "1px";
    el.setAttribute("data-autoacquisitore-avviso", "luogo-nascita");
  }

  function evidenziaCritico(el) {
    pulisciTitleAutoacq(el);
    salvaStileOriginale(el);
    el.style.backgroundColor = "#fee2e2";
    el.style.outline = "3px solid #dc2626";
    el.style.outlineOffset = "1px";
    el.setAttribute("data-autoacquisitore-critico", "conversione-protezione");
  }

  function salvaStileOriginale(el) {
    if (el.getAttribute("data-autoacq-original-style") === "1") return;
    el.setAttribute("data-autoacq-original-style", "1");
    el.setAttribute("data-autoacq-bg", el.style.backgroundColor || "");
    el.setAttribute("data-autoacq-outline", el.style.outline || "");
    el.setAttribute("data-autoacq-outline-offset", el.style.outlineOffset || "");
  }

  function pulisciEvidenziazioni() {
    var els = document.querySelectorAll("[data-autoacquisitore], [data-autoacquisitore-avviso], [data-autoacquisitore-critico]");
    var i;
    var el;

    for (i = 0; i < els.length; i = i + 1) {
      el = els[i];
      el.style.backgroundColor = el.getAttribute("data-autoacq-bg") || "";
      el.style.outline = el.getAttribute("data-autoacq-outline") || "";
      el.style.outlineOffset = el.getAttribute("data-autoacq-outline-offset") || "";
      el.removeAttribute("data-autoacquisitore");
      el.removeAttribute("data-autoacquisitore-avviso");
      el.removeAttribute("data-autoacquisitore-critico");
      pulisciTitleAutoacq(el);
    }
    msg("Evidenziazioni rimosse.");
  }

  function resetCopilot() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_PRIMA_COPIA);
    pulisciEvidenziazioni();
    svuotaBoxHud();
    msg("Reset completato: dati e clipboard Stranieri WEB - Copilot svuotati.");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText("").catch(function () {});
    }
  }

  function nuovaPratica() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_PRIMA_COPIA);
    pulisciEvidenziazioni();
    svuotaBoxHud();
    msg("Nuova pratica: sessione operativa pulita.");
    logTecnico({
      modalita: "Nuova pratica",
      stato: "Pronto",
      incollati: [],
      nonTrovati: [],
      avvisi: [],
      critici: [],
      fixes: []
    });
  }

  function svuotaBoxHud() {
    var log = document.getElementById("autoacq_log");
    var warn = document.getElementById("autoacq_warn");
    var fix = document.getElementById("autoacq_fix");
    var crit = document.getElementById("autoacq_crit");

    if (log) log.innerHTML = "Log campi";
    if (warn) {
      warn.innerHTML = "";
      warn.style.display = "none";
    }
    if (fix) {
      fix.innerHTML = "";
      fix.style.display = "none";
    }
    if (crit) {
      crit.innerHTML = "";
      crit.style.display = "none";
    }
    aggiornaAltezzaHud();
  }

  function pulisciTitleAutoacq(el) {
    var title = el.getAttribute("title");
    if (!title) return;
    title = title.replace(/(\s*-\s*Autoacquisitore:\s*(copiato|incollato))+/gi, "");
    el.setAttribute("title", trim(title));
  }

  function msg(testo) {
    var box = document.getElementById("autoacq_msg");
    if (box) box.innerHTML = testo;
    else alert(testo);
  }

  function logCampi(titolo, campi, dati) {
    var box = document.getElementById("autoacq_log");
    var righe = [];
    var i;
    var key;
    var valore;

    if (!box) return;
    for (i = 0; i < campi.length; i = i + 1) {
      key = campi[i];
      valore = dati && dati[key] ? (dati[key].text || dati[key].value || "") : "";
      righe.push("<div><strong>" + escapeHtml(key) + "</strong>" + (valore ? ": " + escapeHtml(valore) : "") + "</div>");
    }
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">" + escapeHtml(titolo) + " (" + campi.length + ")</div>" + righe.join("");
  }

  function logTecnico(info) {
    var box = document.getElementById("autoacq_log");
    var righe = [];
    var incollati = info.incollati || [];
    var nonTrovati = info.nonTrovati || [];
    var avvisi = info.avvisi || [];
    var critici = info.critici || [];
    var fixes = info.fixes || [];

    if (!box) return;
    righe.push("<div style=\"font-weight:700;margin-bottom:5px;\">Report lavorazione</div>");
    righe.push(rigaLog("Modalita", info.modalita || ""));
    righe.push(rigaLog("Stato", info.stato || ""));
    if (info.regola) righe.push(rigaLog("Regola", info.regola));
    righe.push(rigaLog("Campi incollati", String(incollati.length)));
    righe.push(rigaLog("Campi non trovati", String(nonTrovati.length)));
    righe.push(rigaLog("Avvisi", String(avvisi.length)));
    righe.push(rigaLog("Critici", String(critici.length)));
    righe.push(rigaLog("Automatic-Fix", String(fixes.length)));
    if (nonTrovati.length) righe.push(rigaListaLog("Non trovati", nonTrovati));
    if (incollati.length) righe.push(rigaListaLog("Incollati", incollati.slice(0, 12)));
    box.innerHTML = righe.join("");
  }

  function rigaLog(label, value) {
    return "<div><strong>" + escapeHtml(label) + "</strong>: " + escapeHtml(value) + "</div>";
  }

  function rigaListaLog(label, values) {
    return "<div style=\"margin-top:4px;\"><strong>" + escapeHtml(label) + "</strong>: " + escapeHtml(values.join(", ")) + "</div>";
  }

  function mostraAvvisi(avvisi) {
    var box = document.getElementById("autoacq_warn");
    var i;
    var righe = [];

    if (!box) return;
    if (!avvisi.length) {
      box.innerHTML = "";
      box.style.display = "none";
      aggiornaAltezzaHud();
      return;
    }
    for (i = 0; i < avvisi.length; i = i + 1) {
      righe.push("<li>" + escapeHtml(avvisi[i]) + "</li>");
    }
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">ATTENZIONE:</div><ul style=\"margin:0;padding-left:18px;\">" + righe.join("") + "</ul>";
    box.style.display = "block";
    aggiornaAltezzaHud();
  }

  function mostraCritici(critici) {
    var box = document.getElementById("autoacq_crit");
    var i;
    var righe = [];

    if (!box) return;
    if (!critici.length) {
      box.innerHTML = "";
      box.style.display = "none";
      aggiornaAltezzaHud();
      return;
    }
    for (i = 0; i < critici.length; i = i + 1) {
      righe.push("<li>" + escapeHtml(critici[i]) + "</li>");
    }
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">ATTENZIONE:</div><ul style=\"margin:0;padding-left:18px;\">" + righe.join("") + "</ul>";
    box.style.display = "block";
    aggiornaAltezzaHud();
  }

  function mostraFixes(fixes) {
    var box = document.getElementById("autoacq_fix");
    var i;
    var righe = [];

    if (!box) return;
    if (!fixes.length) {
      box.innerHTML = "";
      box.style.display = "none";
      aggiornaAltezzaHud();
      return;
    }
    for (i = 0; i < fixes.length; i = i + 1) {
      righe.push("<li>" + escapeHtml(fixes[i]) + "</li>");
    }
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">Automatic-Fix:</div><ul style=\"margin:0;padding-left:18px;\">" + righe.join("") + "</ul>";
    box.style.display = "block";
    aggiornaAltezzaHud();
  }

  function aggiornaAltezzaHud() {
    var hud = document.getElementById("autoacq_hud");
    var content = document.getElementById("autoacq_content");
    var warn = document.getElementById("autoacq_warn");
    var fix = document.getElementById("autoacq_fix");
    var crit = document.getElementById("autoacq_crit");
    var aperta;

    if (!hud || !content || content.style.display === "none") return;
    aperta = (warn && warn.style.display !== "none") ||
      (fix && fix.style.display !== "none") ||
      (crit && crit.style.display !== "none");
    hud.style.height = aperta ? "auto" : "500px";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debug() {
    var raw = localStorage.getItem(KEY);
    var dati;
    var salvati = [];
    var riconosciuti = [];
    var controls = allControls();
    var i;
    var key;
    var el;
    var testo;

    if (raw) {
      dati = JSON.parse(raw);
      for (key in dati) {
        if (dati.hasOwnProperty(key)) {
          salvati.push(key + " = " + (dati[key].text || dati[key].value || ""));
        }
      }
    }

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      key = getKey(el);
      if (key) {
        riconosciuti.push(key + " <= " + (el.getAttribute("name") || el.getAttribute("id") || el.getAttribute("title") || getLabel(el)));
      }
    }

    testo = "DATI SALVATI (" + salvati.length + ")\n" + salvati.sort().join("\n");
    testo = testo + "\n\nCAMPI RICONOSCIUTI IN QUESTA PAGINA (" + riconosciuti.length + ")\n" + riconosciuti.sort().join("\n");
    alert(testo);
  }

  function bottone(testo, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.appendChild(document.createTextNode(testo));
    b.onclick = fn;
    b.style.display = "block";
    b.style.width = "100%";
    b.style.marginTop = "5px";
    b.style.padding = "6px 7px";
    b.style.minHeight = "32px";
    b.style.font = "700 11px Arial";
    b.style.lineHeight = "1.15";
    b.style.border = "1px solid #7fa6c9";
    b.style.borderRadius = "5px";
    b.style.background = "#f5f9fd";
    b.style.color = "#003b66";
    b.style.cursor = "pointer";
    b.style.textAlign = "center";
    b.style.whiteSpace = "normal";
    b.style.overflowWrap = "break-word";
    return b;
  }

  function applicaPosizioneHud(p) {
    var raw = localStorage.getItem(HUD_POS_KEY);
    var pos;

    p.style.left = "10px";
    p.style.bottom = "10px";
    p.style.top = "";
    p.style.right = "";

    if (!raw) return;
    try {
      pos = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (typeof pos.left === "number" && typeof pos.top === "number") {
      p.style.left = Math.max(0, pos.left) + "px";
      p.style.top = Math.max(0, pos.top) + "px";
      p.style.right = "";
      p.style.bottom = "";
    }
  }

  function rendiHudMobile(p, header) {
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;
    var dragging = false;

    header.style.cursor = "move";
    header.title = "Trascina per spostare Stranieri WEB - Copilot";

    header.onmousedown = function (eventObject) {
      eventObject = eventObject || window.event;
      if (eventObject.target && eventObject.target.tagName && eventObject.target.tagName.toLowerCase() === "button") return;
      if (eventObject.target && eventObject.target.tagName && eventObject.target.tagName.toLowerCase() === "input") return;
      dragging = true;
      startX = eventObject.clientX;
      startY = eventObject.clientY;
      startLeft = p.offsetLeft;
      startTop = p.offsetTop;
      p.style.left = startLeft + "px";
      p.style.top = startTop + "px";
      p.style.right = "";
      p.style.bottom = "";
      if (eventObject.preventDefault) eventObject.preventDefault();
      return false;
    };

    document.addEventListener("mousemove", function (eventObject) {
      var left;
      var top;
      var maxLeft;
      var maxTop;

      if (!dragging) return;
      eventObject = eventObject || window.event;
      left = startLeft + eventObject.clientX - startX;
      top = startTop + eventObject.clientY - startY;
      maxLeft = Math.max(0, window.innerWidth - p.offsetWidth - 6);
      maxTop = Math.max(0, window.innerHeight - p.offsetHeight - 6);
      left = Math.min(Math.max(6, left), maxLeft);
      top = Math.min(Math.max(6, top), maxTop);
      p.style.left = left + "px";
      p.style.top = top + "px";
    });

    document.addEventListener("mouseup", function () {
      if (!dragging) return;
      dragging = false;
      localStorage.setItem(HUD_POS_KEY, JSON.stringify({ left: p.offsetLeft, top: p.offsetTop }));
    });
  }

  function hud() {
    var host;
    var p;
    var m;
    var riga;
    var toggle;
    var header;
    var body;
    var content;
    var log;
    var warn;
    var fix;
    var crit;
    var autore;

    if (document.getElementById("autoacq_hud")) return;
    host = document.body || document.documentElement;
    if (!host) {
      alert("Stranieri WEB - Copilot avviato, ma BODY non disponibile.");
      return;
    }

    p = document.createElement("div");
    p.id = "autoacq_hud";
    p.style.position = "fixed";
    applicaPosizioneHud(p);
    p.style.zIndex = "2147483647";
    p.style.background = "rgba(246,250,253,0.98)";
    p.style.color = "#0f2f4a";
    p.style.border = "1px solid #2f6f9f";
    p.style.borderRadius = "8px";
    p.style.padding = "0";
    p.style.font = "13px Arial";
    p.style.boxShadow = "0 8px 22px rgba(0,59,102,0.25)";
    p.style.width = "390px";
    p.style.height = "500px";
    p.style.minWidth = "390px";
    p.style.maxWidth = "390px";
    p.style.overflowX = "hidden";
    p.style.overflowY = "hidden";

    toggle = bottone("-", function () {
      content.style.display = content.style.display === "none" ? "block" : "none";
      toggle.textContent = content.style.display === "none" ? "+" : "-";
      p.style.width = content.style.display === "none" ? "230px" : "390px";
      p.style.height = content.style.display === "none" ? "38px" : "500px";
      p.style.minWidth = content.style.display === "none" ? "230px" : "390px";
      p.style.maxWidth = content.style.display === "none" ? "230px" : "390px";
      aggiornaAltezzaHud();
    });
    toggle.style.fontWeight = "700";
    toggle.style.display = "inline-block";
    toggle.style.width = "30px";
    toggle.style.margin = "0";
    toggle.style.padding = "3px 0";
    toggle.style.textAlign = "center";
    toggle.style.borderColor = "#b7d3e8";
    toggle.style.background = "#e6f1fa";

    riga = document.createElement("div");
    riga.style.display = "block";
    riga.style.width = "145px";
    riga.style.minWidth = "145px";
    riga.style.padding = "6px 0 6px 8px";
    riga.appendChild(bottone("1. Copia da Assicurata", primaCopia));
    riga.appendChild(bottone("2. Ricerca vecchia anagrafica", incollaPrimaCopia));
    riga.appendChild(bottone("3. Copia dati da Vecchia Anagrafica", copia));
    riga.appendChild(bottone("4. Incolla su nuova pratica", incolla));
    riga.appendChild(bottone("Check finale", checkFinale));
    riga.appendChild(bottone("Nuova pratica", nuovaPratica));
    riga.appendChild(bottone("Reset", resetCopilot));

    header = document.createElement("div");
    header.style.background = "#005c9d";
    header.style.color = "#ffffff";
    header.style.padding = "7px 9px";
    header.style.fontWeight = "700";
    header.style.letterSpacing = "0";
    header.style.minHeight = "20px";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.appendChild(document.createTextNode("Stranieri WEB - Copilot"));
    autore = document.createElement("span");
    autore.appendChild(document.createTextNode("\u00A9 Jurij Rella"));
    autore.style.font = "11px Arial";
    autore.style.fontWeight = "400";
    autore.style.marginLeft = "auto";
    autore.style.opacity = "0.88";
    header.appendChild(autore);
    header.appendChild(toggle);
    p.appendChild(header);
    rendiHudMobile(p, header);

    content = document.createElement("div");
    content.id = "autoacq_content";
    content.style.display = "block";

    body = document.createElement("div");
    body.style.display = "flex";
    body.style.alignItems = "stretch";
    body.style.gap = "8px";
    body.style.height = "285px";

    log = document.createElement("div");
    log.id = "autoacq_log";
    log.style.flex = "1";
    log.style.margin = "6px 8px 6px 0";
    log.style.padding = "7px";
    log.style.height = "261px";
    log.style.maxHeight = "261px";
    log.style.overflowY = "auto";
    log.style.background = "#ffffff";
    log.style.border = "1px solid #c6dced";
    log.style.borderRadius = "5px";
    log.style.font = "12px Arial";
    log.style.lineHeight = "1.35";
    log.style.color = "#0f2f4a";
    log.appendChild(document.createTextNode("Log campi"));

    body.appendChild(riga);
    body.appendChild(log);
    content.appendChild(body);

    m = document.createElement("span");
    m.id = "autoacq_msg";
    m.appendChild(document.createTextNode("pronto"));
    m.style.display = "block";
    m.style.margin = "8px 8px 6px 8px";
    m.style.padding = "6px 7px";
    m.style.background = "#eaf3fb";
    m.style.border = "1px solid #c6dced";
    m.style.borderRadius = "5px";
    m.style.whiteSpace = "normal";
    m.style.lineHeight = "1.35";
    m.style.color = "#0f2f4a";
    m.style.height = "28px";
    m.style.overflowY = "auto";
    content.appendChild(m);

    fix = document.createElement("div");
    fix.id = "autoacq_fix";
    fix.style.display = "none";
    fix.style.margin = "0 8px 6px 8px";
    fix.style.padding = "6px 7px";
    fix.style.background = "#dcfce7";
    fix.style.border = "1px solid #16a34a";
    fix.style.borderRadius = "5px";
    fix.style.color = "#14532d";
    fix.style.font = "12px Arial";
    fix.style.lineHeight = "1.35";
    fix.style.overflowY = "visible";
    content.appendChild(fix);

    crit = document.createElement("div");
    crit.id = "autoacq_crit";
    crit.style.display = "none";
    crit.style.margin = "0 8px 6px 8px";
    crit.style.padding = "6px 7px";
    crit.style.background = "#fee2e2";
    crit.style.border = "1px solid #dc2626";
    crit.style.borderRadius = "5px";
    crit.style.color = "#7f1d1d";
    crit.style.font = "12px Arial";
    crit.style.lineHeight = "1.35";
    crit.style.overflowY = "visible";
    content.appendChild(crit);

    warn = document.createElement("div");
    warn.id = "autoacq_warn";
    warn.style.display = "none";
    warn.style.margin = "0 8px 6px 8px";
    warn.style.padding = "6px 7px";
    warn.style.background = "#fff3cd";
    warn.style.border = "1px solid #d97706";
    warn.style.borderRadius = "5px";
    warn.style.color = "#7c2d12";
    warn.style.font = "12px Arial";
    warn.style.lineHeight = "1.35";
    warn.style.overflowY = "visible";
    content.appendChild(warn);
    p.appendChild(content);

    host.insertBefore(p, host.firstChild);
  }

  window.STRANIERI_WEB_COPILOT_TEST = hud;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hud);
  } else {
    hud();
  }
  setTimeout(hud, 1000);
}());
