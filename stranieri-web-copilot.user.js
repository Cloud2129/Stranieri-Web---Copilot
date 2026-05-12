// ==UserScript==
// @name         Stranieri WEB - Copilot
// @namespace    stranieri-web-copilot
// @version      0.22.1
// @description  Assistente operativo per pratiche Stranieri WEB.
// @include      file:///*
// @include      http://*/StranieriWeb/*
// @include      https://*/StranieriWeb/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  var VERSIONE = "0.22.1";
  var KEY = "STRANIERI_WEB_COPILOT_DATI";
  var KEY_PRIMA_COPIA = "STRANIERI_WEB_COPILOT_PRIMA_COPIA";
  var KEY_LOG_VECCHIA = "STRANIERI_WEB_COPILOT_LOG_VECCHIA";
  var HUD_POS_KEY = "STRANIERI_WEB_COPILOT_HUD_POS";
  var HUD_OPEN_KEY = "STRANIERI_WEB_COPILOT_HUD_OPEN";
  var _pillAvvisi = null;
  var _pillCritici = null;

  // ─── CONFIG ──────────────────────────────────────────────────────────────────
  var CONFIG = {
    ufficio: "",
    passaportoScadutoMesiCritico: 6,
    checklistExtra: {
      "lavoro subordinato": [],
      "lavoro autonomo":    [],
      "motivi familiari":   [],
      "attesa occupazione": [],
      "studente":           [],
      "protezione":         []
    }
  };

  // ─── COSTANTI E DIZIONARIO CAMPI ───────────────────────────────────────────
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

  // ─── NORMALIZZAZIONE E RICONOSCIMENTO CAMPI ─────────────────────────────────
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

    // dataScadenzaRinnovo va sempre calcolata dalle funzioni impostaScadenza*,
    // non copiata dalla vecchia pratica (altrimenti il loop di incolla
    // sovrascrive il valore già correttamente impostato da applicaControlloRinnovo)
    if (norm(el.getAttribute("name") || "") === "datascadenzarinnovo") {
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

  // ─── COPIA / INCOLLA ─────────────────────────────────────────────────────────
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
    var box = document.getElementById("autoacq_log_assicurata");
    if (!box) return;
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;color:#003b66;\">DATI ASSICURATA</div>" +
      "<div><strong>cognome</strong>: " + escapeHtml(dati.cognome) + "</div>" +
      "<div><strong>nome</strong>: " + escapeHtml(dati.nome) + "</div>" +
      "<div><strong>data nascita</strong>: " + escapeHtml(dati.giorno + "/" + dati.mese + "/" + dati.anno) + "</div>";
  }

  function logDatiAssicurataPrima(datiVecchi) {
    var box = document.getElementById("autoacq_log_assicurata");
    var controls = allControls();
    var righe = [];
    var visti = {};
    var i;
    var el;
    var key;
    var value;

    if (!box) return;
    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      key = getKey(el);
      if (!key || visti[key]) continue;
      if (!trovaOrigine(datiVecchi, key) && key !== "giorno nascita" && key !== "mese nascita" && key !== "anno nascita") continue;
      value = valoreCampoLog(el);
      righe.push("<div><strong>" + escapeHtml(key) + "</strong>: " + escapeHtml(value || "vuoto") + "</div>");
      visti[key] = true;
    }
    box.innerHTML = titoloLog("DATI ASSICURATA") +
      "<div style=\"font-size:11px;color:#587089;margin-bottom:5px;\">Valori presenti nella pratica nuova prima dell'import dalla vecchia anagrafica.</div>" +
      (righe.length ? righe.join("") : "<div style=\"color:#587089;\">Nessun dato rilevato prima dell'import.</div>");
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
    salvaLogVecchiaPratica(copiati, dati);
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
      if (campoDocSoggiorno(el)) dati.__controlli.docSoggiorno = valoreCampo(el);
    }
  }

  function campoDocSoggiorno(el) {
    return norm((el.getAttribute("name") || "") + " " + (el.getAttribute("id") || "") + " " + (el.getAttribute("title") || "")).indexOf("doc soggiorno") >= 0 ||
      norm((el.getAttribute("name") || "") + " " + (el.getAttribute("id") || "") + " " + (el.getAttribute("title") || "")).indexOf("docsoggiorno") >= 0 ||
      norm((el.getAttribute("name") || "") + " " + (el.getAttribute("id") || "") + " " + (el.getAttribute("title") || "")).indexOf("documento di soggiorno") >= 0;
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
    var anteprima = [];
    var ctxPermesso;
    var regolaPermesso;

    if (!raw) {
      applicaControlli(null, fixes);
      applicaRegolaPermesso(fixes, avvisi, critici, null);
      controllaBollettinoIntegrativo(critici, null);
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
    ripristinaLogVecchiaPratica();
    logDatiAssicurataPrima(dati);
    incollaDataNascitaDiretta(dati, anteprima);
    applicaControlli(dati, fixes);
    confrontaValoriSensibili(dati, avvisi);
    controllaDocumenti(avvisi, critici);
    controls = allControls();

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      key = getKey(el);
      if (!key) continue;

      if (key === "giorno nascita" || key === "mese nascita" || key === "anno nascita") {
        var primaData = valoreCampo(el);
        if (riempiDataNascita(el, key, dati)) {
          ok = ok + 1;
          evidenzia(el, "incollato");
          fire(el);
          if (incollati.indexOf(key) < 0) incollati.push(key);
          registraAnteprima(anteprima, key, primaData, valoreCampo(el));
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
        var primaMotivo = valoreCampo(el);
        if (applicaConversioneFamiliareUE(el, origine, critici, fixes)) {
          ok = ok + 1;
          if (incollati.indexOf(key) < 0) incollati.push(key);
          fire(el);
          registraAnteprima(anteprima, key, primaMotivo, valoreCampo(el));
        } else if (motivoSoggiornoVuoto(el)) {
          if (el.tagName.toLowerCase() === "select") {
            if (scegliSelect(el, origine)) {
              ok = ok + 1;
              evidenzia(el, "incollato");
              if (incollati.indexOf(key) < 0) incollati.push(key);
              fire(el);
              fixes.push("Motivazione soggiorno compilata perche' era vuota.");
              registraAnteprima(anteprima, key, primaMotivo, valoreCampo(el));
            }
          } else {
            el.value = origine.value || "";
            ok = ok + 1;
            evidenzia(el, "incollato");
            if (incollati.indexOf(key) < 0) incollati.push(key);
            fire(el);
            fixes.push("Motivazione soggiorno compilata perche' era vuota.");
            registraAnteprima(anteprima, key, primaMotivo, valoreCampo(el));
          }
        } else {
          controllaMotivoSoggiorno(el, origine, avvisi, critici);
        }
        continue;
      }

      var prima = valoreCampoLog(el);
      if (el.tagName.toLowerCase() === "select") {
        if (scegliSelect(el, origine)) {
          ok = ok + 1;
          evidenzia(el, "incollato");
          if (incollati.indexOf(key) < 0) incollati.push(key);
          registraAnteprima(anteprima, key, prima, valoreCampoLog(el));
          if (key === "stato civile") controllaCambioStatoCivile(el, prima, valoreCampoLog(el), avvisi);
        }
      } else if (origine.checked !== undefined) {
        el.checked = origine.checked;
        ok = ok + 1;
        evidenzia(el, "incollato");
        if (incollati.indexOf(key) < 0) incollati.push(key);
        registraAnteprima(anteprima, key, prima, valoreCampoLog(el));
        if (key === "stato civile") controllaCambioStatoCivile(el, prima, valoreCampoLog(el), avvisi);
      } else {
        el.value = origine.value || "";
        ok = ok + 1;
        evidenzia(el, "incollato");
        if (incollati.indexOf(key) < 0) incollati.push(key);
        registraAnteprima(anteprima, key, prima, valoreCampoLog(el));
        if (key === "stato civile") controllaCambioStatoCivile(el, prima, valoreCampoLog(el), avvisi);
      }
      fire(el);
    }
    applicaRegolaPermesso(fixes, avvisi, critici, dati);
    controllaBollettinoIntegrativo(critici, dati);
    ctxPermesso = contestoPermessoCorrente(dati);
    regolaPermesso = ctxPermesso ? trovaRegolaPermesso(ctxPermesso) : null;
    msg(critici.length ? "Controllo completato con avvisi critici." : (avvisi.length ? "Controllo completato con avvisi." : "Incolla completato."));
    logTecnico({
      modalita: "Con vecchia pratica",
      stato: critici.length ? "Critico" : (avvisi.length ? "Con avvisi" : "OK"),
      regola: regolaPermesso ? regolaPermesso.codice : "",
      incollati: incollati,
      nonTrovati: nonTrovati,
      avvisi: avvisi,
      critici: critici,
      fixes: fixes,
      anteprima: anteprima,
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

  // ─── CONTROLLI AUTOMATICI ────────────────────────────────────────────────────
  function applicaControlli(dati, fixes) {
    var importo = leggiImportoPagina();
    var mesiValidita = 0;

    if (importo === "30,46" && tipoPraticaCorrente() === "A" && permessoPrecedenteLungoPeriodo(dati)) {
      impostaSelectPerValore("docSoggiorno", "L", "Documento di soggiorno impostato su PERM. SOGG. LUNGO PERIODO per aggiornamento con importo 30,46", fixes);
      impostaValiditaSoggiorno("Y", "10 ANNI", "Validita soggiorno impostata su 10 ANNI per aggiornamento con importo 30,46", fixes);
      ripetiValiditaSoggiorno("Y", "10 ANNI");
      impostaDataRinnovoDaDataPresentazione(fixes, "Data rinnovo valorizzata con data presentazione per aggiornamento 30,46.");
      impostaScadenzaRinnovoDaDataPresentazione(120, fixes);
    }

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

  function controllaBollettinoIntegrativo(critici, dati) {
    var motivo = document.getElementsByName("motivoSoggiorno")[0] || document.getElementById("motivoSoggiorno");
    var categoria;

    if (leggiImportoPagina() !== "30,46" || !motivo) return;
    if (tipoPraticaCorrente() === "A") return;
    if (permessoPrecedenteLungoPeriodo(dati || datiSalvati())) return;
    categoria = categoriaMotivo(valoreCampo(motivo));
    if (categoria !== "lavoro subordinato" && categoria !== "lavoro autonomo" && categoria !== "motivi familiari") return;
    critici.push("Bollettino 30,46 su pratica da acquisire con motivazione lavoro/famiglia: manca bollettino da 40/50 euro.");
    evidenziaCritico(motivo);
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

  function tipoPraticaCorrente() {
    var tipo = document.getElementsByName("tipoPratica")[0] || document.getElementById("tipoPratica");
    if (!tipo) return "";
    return tipo.value || "";
  }

  function isAggiornamentoLungoPeriodo30(dati) {
    var doc = document.getElementsByName("docSoggiorno")[0] || document.getElementById("docSoggiorno");
    return leggiImportoPagina() === "30,46" &&
      tipoPraticaCorrente() === "A" &&
      permessoPrecedenteLungoPeriodo(dati) &&
      !!(doc && (doc.value === "L" || norm(valoreCampo(doc)).indexOf("perm sogg lungo periodo") >= 0));
  }

  function permessoPrecedenteLungoPeriodo(dati) {
    var controlli = dati && dati.__controlli;
    var doc = controlli ? controlli.docSoggiorno : "";
    return norm(doc).indexOf("perm sogg lungo periodo") >= 0 ||
      norm(doc).indexOf("permesso soggiorno lungo periodo") >= 0 ||
      norm(doc) === "l";
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

  function impostaScadenzaRinnovoDaDataPresentazione(mesi, fixes) {
    var dataPresentazione = document.getElementsByName("dataPresentazione")[0] || document.getElementById("dataPresentazione");
    var dataScadenzaRinnovo = document.getElementsByName("dataScadenzaRinnovo")[0] || document.getElementById("dataScadenzaRinnovo");
    var base;

    if (!dataPresentazione || !trim(dataPresentazione.value) || !dataScadenzaRinnovo) return;
    base = parseDataItaliana(dataPresentazione.value);
    if (!base) return;

    dataScadenzaRinnovo.value = formattaDataItaliana(aggiungiMesi(base, mesi));
    evidenzia(dataScadenzaRinnovo, "incollato");
    fire(dataScadenzaRinnovo);
    fixes.push("Data scadenza rinnovo calcolata da data presentazione +10 anni per aggiornamento 30,46.");
  }

  function impostaScadenzaRinnovoDaOggi(mesi, messaggio, fixes) {
    var dataScadenzaRinnovo = document.getElementsByName("dataScadenzaRinnovo")[0] || document.getElementById("dataScadenzaRinnovo");

    if (!dataScadenzaRinnovo) return;
    dataScadenzaRinnovo.value = formattaDataItaliana(aggiungiMesi(new Date(), mesi));
    evidenzia(dataScadenzaRinnovo, "incollato");
    fire(dataScadenzaRinnovo);
    fixes.push(messaggio);
  }

  function impostaDataRinnovoDaDataPresentazione(fixes, messaggio) {
    var dataPresentazione = document.getElementsByName("dataPresentazione")[0] || document.getElementById("dataPresentazione");
    var dataRinnovo = document.getElementsByName("dataRinnovo")[0] || document.getElementById("dataRinnovo");

    if (!dataPresentazione || !trim(dataPresentazione.value) || !dataRinnovo) return;
    dataRinnovo.value = dataPresentazione.value;
    evidenzia(dataRinnovo, "incollato");
    fire(dataRinnovo);
    fixes.push(messaggio);
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

  function mesiTra(prima, dopo) {
    return (dopo.getFullYear() - prima.getFullYear()) * 12 + (dopo.getMonth() - prima.getMonth());
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

  function controllaCambioStatoCivile(el, prima, dopo, avvisi) {
    if (!prima || !dopo) return;
    if (normConfronto(prima) === normConfronto(dopo)) return;
    avvisi.push("Stato civile cambiato. Prima: " + prima + " | Dopo: " + dopo + ".");
    evidenziaAvviso(el);
  }

  function controllaMotivoSoggiorno(el, origine, avvisi, critici) {
    var attuale = valoreCampo(el);
    var nuovo = origine.text || origine.value || "";

    if (!attuale || !nuovo) return;
    if (normConfronto(attuale) === normConfronto(nuovo)) return;

    if (categoriaMotivo(attuale) === "attesa occupazione" && categoriaMotivo(nuovo) === "lavoro subordinato") {
      return;
    }

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

  function motivoFamiliareUE(value) {
    var testo = norm(value);
    return testo.indexOf("familiare ue") >= 0 ||
      testo.indexOf("uea10") >= 0 ||
      testo.indexOf("uea20") >= 0;
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

    if (testo === "lavau") return "lavoro autonomo";
    if (testo === "famig" || testo === "fami2" || testo === "famb2" || testo === "famb3" || testo === "bifam") return "motivi familiari";
    if (testo === "lavor" || testo === "lre20") return "lavoro subordinato";
    if (testo === "lavo3" || testo === "lavo4") return "attesa occupazione";
    if (testo === "stud0" || testo === "stud1" || testo === "sturl") return "studente";
    if (testo.indexOf("attesa occupazione") >= 0) return "attesa occupazione";
    if (testo.indexOf("lavoro subordinato") >= 0) return "lavoro subordinato";
    if (testo.indexOf("lavoro sub") >= 0) return "lavoro subordinato";
    if (testo.indexOf("lavoro autonomo") >= 0 || testo.indexOf("motivi commerciali") >= 0) return "lavoro autonomo";
    if (testo.indexOf("motivi familiari") >= 0) return "motivi familiari";
    if (testo.indexOf("studente") >= 0) return "studente";
    if (motivoProtezioneSpecialeOSussidiaria(value)) return "protezione";
    return "";
  }

  // ─── REGOLE PERMESSO ─────────────────────────────────────────────────────────
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
    applicaAutomaticFixRegola(regola, ctx, fixes);

    if (!note || !regola.note || !regola.note.length) return;
    template = creaChecklist(regola.note, ctx ? ctx.categoria : "");
    if (trim(note.value)) {
      if (notaChecklistCopilotVuota(note.value)) {
        if (trim(note.value) !== template) {
          note.value = template;
          evidenzia(note, "incollato");
          fire(note);
          if (typeof window.maxLengthNote === "function") window.maxLengthNote(note);
          fixes.push("Checklist tecnica aggiornata a " + regola.codice + " in base alla motivazione finale.");
        }
        return;
      }
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

  function applicaAutomaticFixRegola(regola, ctx, fixes) {
    if (typeof regola.automaticFix === "function") regola.automaticFix(ctx, fixes);
  }

  function rilevaPrimoRilascio() {
    var tipo = document.getElementsByName("tipoPratica")[0] || document.getElementById("tipoPratica");
    if (!tipo) return false;
    var v = norm(tipo.value + " " + valoreCampo(tipo));
    return tipo.value === "P" || v.indexOf("primo rilascio") >= 0;
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
      aggiornamentoLungoPeriodo30: isAggiornamentoLungoPeriodo30(dati),
      docSoggiorno: docSoggiorno ? docSoggiorno.value : "",
      docTesto: docTesto,
      // Se dati vecchia pratica disponibili, usa il docSoggiorno della vecchia pratica
      // (il campo corrente potrebbe essere stato incollato erroneamente dal loop di incolla)
      lungoPeriodo: dati
        ? permessoPrecedenteLungoPeriodo(dati)
        : !!(docSoggiorno && (docSoggiorno.value === "L" || norm(docTesto).indexOf("perm sogg lungo periodo") >= 0)),
      primoRilascio: rilevaPrimoRilascio()
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

  function creaChecklist(campi, categoria) {
    var extra = categoria && CONFIG.checklistExtra[categoria] ? CONFIG.checklistExtra[categoria] : [];
    var tutti = campi.concat(extra);
    return tutti.join(" \\ ");
  }

  function notaChecklistCopilotVuota(value) {
    var testo = trim(value).toUpperCase();
    var codici = [
      "AGG.TO PSLP",
      "CONVERSIONE DA PROTEZIONE",
      "CONVERSIONE DA ASSISTENZA MINORI",
      "PSLP LAV. SUB.",
      "PSLP MOT. FAM.",
      "LAV. SUB. - PRIMO RILASCIO",
      "AUTONOMO - PRIMO RILASCIO",
      "FAM. - PRIMO RILASCIO",
      "ATT. OCC. - PRIMO RILASCIO",
      "STUDIO - PRIMO RILASCIO",
      "ATT. OCC.",
      "LAV. SUB.",
      "AUTONOMO",
      "FAM.",
      "STUDIO"
    ];
    var i;

    if (testo.indexOf("[________]") < 0) return false;
    for (i = 0; i < codici.length; i = i + 1) {
      if (testo.indexOf(codici[i]) === 0) return true;
    }
    return false;
  }

  function campoChecklist(nome) {
    return nome + ": [________]";
  }

  function guidaPrimoRilascio(codice) {
    var guide = {
      "LAV. SUB. - PRIMO RILASCIO": [
        "Verificare nulla osta lavoro",
        "Controllare data ingresso dal visto",
        "Verificare passaporto valido e non scaduto",
        "Controllare residenza dichiarata",
        "Verificare tipo contratto"
      ],
      "AUTONOMO - PRIMO RILASCIO": [
        "Verificare autorizzazione attivita' commerciale",
        "Controllare data ingresso dal visto",
        "Verificare passaporto valido e non scaduto",
        "Controllare residenza dichiarata",
        "Verificare ditta attiva"
      ],
      "FAM. - PRIMO RILASCIO": [
        "Verificare codice fiscale del trainante",
        "Controllare pratica trainante e scadenza",
        "Verificare reddito trainante",
        "Controllare estratti nascita / matrimonio",
        "Verificare idoneita' alloggio",
        "Controllare numero familiari a carico"
      ],
      "ATT. OCC. - PRIMO RILASCIO": [
        "Verificare iscrizione al centro per l'impiego",
        "Controllare data ingresso dal visto",
        "Verificare passaporto valido e non scaduto",
        "Controllare residenza dichiarata"
      ],
      "STUDIO - PRIMO RILASCIO": [
        "Verificare iscrizione universitaria o scolastica",
        "Controllare polizza assicurativa sanitaria",
        "Verificare mezzi di sostentamento",
        "Controllare residenza o ospitalita'"
      ]
    };
    return guide[codice] || [];
  }

  function regolePermesso() {
    return [
      {
        codice: "Agg.to PSLP",
        quando: function (ctx) {
          return ctx.aggiornamentoLungoPeriodo30;
        },
        note: [
          "Agg.to PSLP",
          campoChecklist("PRESENZA SUL TERRITORIO"),
          campoChecklist("RESIDENZA")
        ]
      },
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
          return ctx.categoria === "attesa occupazione" && !ctx.primoRilascio;
        },
        automaticFix: function (ctx, fixes) {
          impostaValiditaSoggiorno("S", "12 MESI", "Validita soggiorno impostata su 12 MESI per attesa occupazione.", fixes);
          ripetiValiditaSoggiorno("S", "12 MESI");
          impostaScadenzaRinnovoDaOggi(12, "Data scadenza rinnovo calcolata da oggi +12 mesi per attesa occupazione.", fixes);
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
          return ctx.categoria === "lavoro subordinato" && !ctx.primoRilascio;
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
          return ctx.categoria === "lavoro autonomo" && !ctx.primoRilascio;
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
          return ctx.categoria === "motivi familiari" && !ctx.primoRilascio;
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
          return ctx.categoria === "studente" && !ctx.primoRilascio;
        },
        note: [
          "STUDIO",
          campoChecklist("RES./OSP."),
          campoChecklist("MEZZI DI SOST."),
          campoChecklist("ASS. SAN."),
          campoChecklist("ISCRIZ."),
          campoChecklist("ESAMI SUPERATI")
        ]
      },
      {
        codice: "LAV. SUB. - PRIMO RILASCIO",
        quando: function (ctx) {
          return ctx.categoria === "lavoro subordinato" && ctx.primoRilascio;
        },
        note: [
          "LAV. SUB. - PRIMO RILASCIO",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("TIPO CONTRATTO"),
          campoChecklist("NULLA OSTA"),
          campoChecklist("DATA INGRESSO")
        ]
      },
      {
        codice: "AUTONOMO - PRIMO RILASCIO",
        quando: function (ctx) {
          return ctx.categoria === "lavoro autonomo" && ctx.primoRilascio;
        },
        note: [
          "AUTONOMO - PRIMO RILASCIO",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("DITTA ATTIVA"),
          campoChecklist("DATA INGRESSO")
        ]
      },
      {
        codice: "FAM. - PRIMO RILASCIO",
        quando: function (ctx) {
          return ctx.categoria === "motivi familiari" && ctx.primoRilascio;
        },
        avvisi: [
          "Verificare scadenza trainante."
        ],
        note: [
          "FAM. - PRIMO RILASCIO",
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
        codice: "ATT. OCC. - PRIMO RILASCIO",
        quando: function (ctx) {
          return ctx.categoria === "attesa occupazione" && ctx.primoRilascio;
        },
        automaticFix: function (ctx, fixes) {
          impostaValiditaSoggiorno("S", "12 MESI", "Validita soggiorno impostata su 12 MESI per attesa occupazione.", fixes);
          ripetiValiditaSoggiorno("S", "12 MESI");
          impostaScadenzaRinnovoDaOggi(12, "Data scadenza rinnovo calcolata da oggi +12 mesi per attesa occupazione.", fixes);
        },
        note: [
          "ATT. OCC. - PRIMO RILASCIO",
          campoChecklist("RESIDENZA"),
          campoChecklist("REDDITO"),
          campoChecklist("ISCRIZ. CENTRO IMPIEGO"),
          campoChecklist("DATA INGRESSO")
        ]
      },
      {
        codice: "STUDIO - PRIMO RILASCIO",
        quando: function (ctx) {
          return ctx.categoria === "studente" && ctx.primoRilascio;
        },
        note: [
          "STUDIO - PRIMO RILASCIO",
          campoChecklist("RES./OSP."),
          campoChecklist("MEZZI DI SOST."),
          campoChecklist("ASS. SAN."),
          campoChecklist("ISCRIZ."),
          campoChecklist("DATA INGRESSO")
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

  function mostraGuidaPrimoRilascio(regola) {
    var box = document.getElementById("autoacq_log_generati");
    var guida = guidaPrimoRilascio(regola.codice);
    var righe;
    var i;

    if (!box || !guida || !guida.length) return;
    righe = ["<ol style=\"margin:4px 0 0 0;padding-left:18px;\">"];
    for (i = 0; i < guida.length; i = i + 1) {
      righe.push("<li style=\"margin-bottom:3px;\">" + escapeHtml(guida[i]) + "</li>");
    }
    righe.push("</ol>");
    box.innerHTML += "<div style=\"margin-top:7px;background:#fffbe6;border:1px solid #d97706;border-radius:5px;padding:7px;\">" +
      "<div style=\"font-weight:800;color:#92400e;margin-bottom:4px;\">Guida primo rilascio</div>" +
      righe.join("") + "</div>";
  }

  function controllaDocumenti(avvisi, critici) {
    var dataPresentazione = document.getElementsByName("dataPresentazione")[0] || document.getElementById("dataPresentazione");
    var controls = allControls();
    var i;
    var el;
    var title;
    var dataScadenza;
    var dataInizio;
    var diffMesi;
    var numDoc;

    for (i = 0; i < controls.length; i = i + 1) {
      el = controls[i];
      if (!usable(el)) continue;
      title = norm(el.getAttribute("title") || "");
      if (
        title === "data scadenza documento" ||
        title === "scadenza passaporto" ||
        title === "data scadenza passaporto"
      ) {
        if (!trim(el.value)) continue;
        dataScadenza = parseDataItaliana(trim(el.value));
        if (!dataScadenza) continue;
        dataInizio = (dataPresentazione && trim(dataPresentazione.value))
          ? parseDataItaliana(dataPresentazione.value)
          : new Date();
        if (!dataInizio) dataInizio = new Date();
        if (dataScadenza < dataInizio) {
          diffMesi = mesiTra(dataScadenza, dataInizio);
          if (diffMesi >= CONFIG.passaportoScadutoMesiCritico) {
            critici.push("Documento scaduto da " + diffMesi + " mesi (oltre la soglia di " + CONFIG.passaportoScadutoMesiCritico + " mesi).");
            evidenziaCritico(el);
          } else {
            avvisi.push("Documento scaduto alla data di presentazione.");
            evidenziaAvviso(el);
          }
        }
      }
    }

    numDoc = trovaCampoPagina(["numero documento", "numdoc"]);
    if (numDoc && !trim(numDoc.value)) {
      avvisi.push("Numero documento non compilato.");
      evidenziaAvviso(numDoc);
    }
  }

  function controllaPratica() {
    var avvisi = [];
    var critici = [];
    var fixes = [];
    var ctx = contestoPermessoCorrente();
    var regola;

    pulisciEvidenziazioni();
    svuotaBoxHud();

    if (!ctx) {
      msg("Motivazione del soggiorno non trovata.");
      return;
    }
    if (!ctx.motivoTesto) {
      msg("Compilare prima il motivo soggiorno per ottenere la checklist corretta.");
      return;
    }

    regola = trovaRegolaPermesso(ctx);
    applicaRegolaPermesso(fixes, avvisi, critici, null);
    controllaDocumenti(avvisi, critici);
    controllaBollettinoIntegrativo(critici, null);

    if (ctx.primoRilascio && regola) {
      mostraGuidaPrimoRilascio(regola);
    }

    msg(critici.length ? "Controllo completato con avvisi critici." : (avvisi.length ? "Controllo completato con avvisi." : "Controllo completato."));
    logTecnico({
      modalita: ctx.primoRilascio ? "Primo rilascio" : "Controllo pratica",
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

  // ─── CHECK FINALE ────────────────────────────────────────────────────────────
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
      controllaBollettinoIntegrativo(critici, datiSalvati());
      controllaRinnovoFinale(avvisi);
      controllaDocumenti(avvisi, critici);
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
    var dati = datiSalvati();
    var doc = document.getElementsByName("docSoggiorno")[0] || document.getElementById("docSoggiorno");
    var motivo = document.getElementsByName("motivoSoggiorno")[0] || document.getElementById("motivoSoggiorno");
    var tipo = document.getElementsByName("tipoPratica")[0] || document.getElementById("tipoPratica");
    var validita = document.getElementsByName("validitaSoggiorno")[0] || document.getElementById("validitaSoggiorno");

    if (!importo) return;
    if (importo === "30,46" && tipo && tipo.value === "A") {
      if (motivo && motivoFamiliareUE(valoreCampo(motivo))) return;
      if (!permessoPrecedenteLungoPeriodo(dati) || !selectFinaleValido(doc, "L", "PERM. SOGG. LUNGO PERIODO")) {
        critici.push("Importo 30,46 con aggiornamento: verificare che il permesso precedente e il documento soggiorno siano PERM. SOGG. LUNGO PERIODO.");
        if (doc) evidenziaCritico(doc);
      }
      verificaSelectFinale(validita, "Y", "10 ANNI", "Importo 30,46 con aggiornamento: validita soggiorno non impostata su 10 ANNI.", avvisi);
      controllaDataRinnovoDaPresentazioneFinale(avvisi);
      controllaScadenzaDaPresentazioneFinale(120, avvisi);
    }
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

  function datiSalvati() {
    var raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
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

  function selectFinaleValido(el, value, testo) {
    if (!el) return false;
    return el.value === value || norm(valoreCampo(el)) === norm(testo);
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

  function controllaScadenzaDaPresentazioneFinale(mesi, avvisi) {
    var dataPresentazione = document.getElementsByName("dataPresentazione")[0] || document.getElementById("dataPresentazione");
    var dataScadenzaRinnovo = document.getElementsByName("dataScadenzaRinnovo")[0] || document.getElementById("dataScadenzaRinnovo");
    var base;
    var attesa;

    if (!dataPresentazione || !trim(dataPresentazione.value)) {
      avvisi.push("Data presentazione non compilata: impossibile verificare scadenza rinnovo.");
      if (dataPresentazione) evidenziaAvviso(dataPresentazione);
      return;
    }
    if (!dataScadenzaRinnovo || !trim(dataScadenzaRinnovo.value)) {
      avvisi.push("Data scadenza rinnovo non compilata.");
      if (dataScadenzaRinnovo) evidenziaAvviso(dataScadenzaRinnovo);
      return;
    }
    base = parseDataItaliana(dataPresentazione.value);
    if (!base) return;
    attesa = formattaDataItaliana(aggiungiMesi(base, mesi));
    if (trim(dataScadenzaRinnovo.value) !== attesa) {
      avvisi.push("Data scadenza rinnovo non coerente con data presentazione +10 anni. Attesa: " + attesa + ".");
      evidenziaAvviso(dataScadenzaRinnovo);
    }
  }

  function controllaDataRinnovoDaPresentazioneFinale(avvisi) {
    var dataPresentazione = document.getElementsByName("dataPresentazione")[0] || document.getElementById("dataPresentazione");
    var dataRinnovo = document.getElementsByName("dataRinnovo")[0] || document.getElementById("dataRinnovo");

    if (!dataPresentazione || !trim(dataPresentazione.value)) return;
    if (!dataRinnovo || !trim(dataRinnovo.value)) {
      avvisi.push("Data rinnovo non compilata.");
      if (dataRinnovo) evidenziaAvviso(dataRinnovo);
      return;
    }
    if (trim(dataRinnovo.value) !== trim(dataPresentazione.value)) {
      avvisi.push("Data rinnovo diversa dalla data presentazione.");
      evidenziaAvviso(dataRinnovo);
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

  function valoreCampoLog(el) {
    if (el.checked !== undefined && (el.type === "checkbox" || el.type === "radio")) return el.checked ? "SI" : "NO";
    return valoreCampo(el);
  }

  function registraAnteprima(lista, campo, prima, dopo) {
    var item;

    if (!lista) return;
    prima = trim(prima);
    dopo = trim(dopo);
    if (normConfronto(prima) === normConfronto(dopo)) return;
    item = {
      campo: campo,
      prima: prima,
      dopo: dopo,
      tipo: prima ? "Modificato" : "Inserito"
    };
    lista.push(item);
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

  function incollaDataNascitaDiretta(dati, anteprima) {
    impostaCampoNascita("giornoDiNascita", dati["giorno nascita"], "giorno nascita", anteprima);
    impostaCampoNascita("meseDiNascita", dati["mese nascita"], "mese nascita", anteprima);
    impostaCampoNascita("annoDiNascita", dati["anno nascita"], "anno nascita", anteprima);
  }

  function impostaCampoNascita(name, dato, key, anteprima) {
    var el;
    var prima;
    if (!dato || !dato.value) return;
    el = document.getElementsByName(name)[0] || document.getElementById(name);
    if (!el) return;
    prima = valoreCampo(el);
    el.value = dato.value;
    evidenzia(el, "incollato");
    fire(el);
    registraAnteprima(anteprima, key, prima, valoreCampo(el));
  }

  // ─── EVIDENZIAZIONI ─────────────────────────────────────────────────────────
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

  function nuovaPratica() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_PRIMA_COPIA);
    localStorage.removeItem(KEY_LOG_VECCHIA);
    pulisciEvidenziazioni();
    svuotaBoxHud();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText("").catch(function () {});
    }
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
    resetStatoPill();
  }

  function svuotaBoxHud() {
    var logAssicurata = document.getElementById("autoacq_log_assicurata");
    var logVecchia = document.getElementById("autoacq_log_vecchia");
    var logGenerati = document.getElementById("autoacq_log_generati");
    var warn = document.getElementById("autoacq_warn");
    var fix = document.getElementById("autoacq_fix");
    var crit = document.getElementById("autoacq_crit");

    if (logAssicurata) logAssicurata.innerHTML = titoloLog("DATI ASSICURATA") + "<div style=\"color:#587089;\">In attesa di F1/F2.</div>";
    if (logVecchia) logVecchia.innerHTML = titoloLog("DATI VECCHIA PRATICA") + "<div style=\"color:#587089;\">In attesa di F3.</div>";
    if (logGenerati) logGenerati.innerHTML = titoloLog("DATI GENERATI", true) + "<div style=\"color:#587089;\">In attesa di incolla o controlli.</div>";
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
    var box = document.getElementById("autoacq_log_vecchia");
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
    box.innerHTML = titoloLog("DATI VECCHIA PRATICA") + "<div style=\"font-weight:700;margin-bottom:4px;\">" + escapeHtml(titolo) + " (" + campi.length + ")</div>" + righe.join("");
  }

  function salvaLogVecchiaPratica(campi, dati) {
    var snap = [];
    var i;
    var key;
    var valore;

    for (i = 0; i < campi.length; i = i + 1) {
      key = campi[i];
      valore = dati && dati[key] ? (dati[key].text || dati[key].value || "") : "";
      snap.push({ key: key, value: valore });
    }
    localStorage.setItem(KEY_LOG_VECCHIA, JSON.stringify(snap));
  }

  function ripristinaLogVecchiaPratica() {
    var raw = localStorage.getItem(KEY_LOG_VECCHIA);
    var box = document.getElementById("autoacq_log_vecchia");
    var snap;
    var righe = [];
    var i;

    if (!box || !raw) return;
    try {
      snap = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!snap || !snap.length) return;
    for (i = 0; i < snap.length; i = i + 1) {
      righe.push("<div><strong>" + escapeHtml(snap[i].key) + "</strong>" + (snap[i].value ? ": " + escapeHtml(snap[i].value) : "") + "</div>");
    }
    box.innerHTML = titoloLog("DATI VECCHIA PRATICA") +
      "<div style=\"font-size:11px;color:#587089;margin-bottom:5px;\">Dati copiati con F3 dalla finestra della vecchia pratica.</div>" +
      righe.join("");
  }

  function logTecnico(info) {
    var box = document.getElementById("autoacq_log_generati");
    var righe = [];
    var incollati = info.incollati || [];
    var nonTrovati = info.nonTrovati || [];
    var avvisi = info.avvisi || [];
    var critici = info.critici || [];
    var fixes = info.fixes || [];
    var anteprima = info.anteprima || [];
    var titolo = info.titolo || (info.modalita === "Con vecchia pratica" ? "Dati Incollati" : "Report lavorazione");

    if (!box) return;
    righe.push(titoloLog("DATI GENERATI", true));
    righe.push("<div style=\"font-weight:700;margin-bottom:5px;color:#003b66;\">" + escapeHtml(titolo) + "</div>");
    righe.push(rigaLog("Modalita", info.modalita || ""));
    if (info.regola) righe.push(rigaLog("Regola", info.regola));
    if (anteprima.length) righe.push(rigaAnteprimaLog(anteprima));
    if (nonTrovati.length) righe.push(rigaListaLog("Non trovati", nonTrovati));
    box.innerHTML = righe.join("");
  }

  function rigaLog(label, value) {
    return "<div><strong>" + escapeHtml(label) + "</strong>: " + escapeHtml(value) + "</div>";
  }

  function titoloLog(testo, evidenza) {
    if (evidenza) {
      return "<div style=\"font-weight:800;margin:-1px -1px 7px -1px;color:#ffffff;background:#006eb6;border-radius:4px;padding:5px 7px;letter-spacing:0;font-size:13px;\">OUTPUT COPILOT - " + escapeHtml(testo) + "</div>";
    }
    return "<div style=\"font-weight:700;margin-bottom:6px;color:#003b66;border-bottom:1px solid #d7e7f3;padding-bottom:4px;\">" + escapeHtml(testo) + "</div>";
  }

  function rigaListaLog(label, values) {
    return "<div style=\"margin-top:4px;\"><strong>" + escapeHtml(label) + "</strong>: " + escapeHtml(values.join(", ")) + "</div>";
  }

  function rigaAnteprimaLog(items) {
    var righe = [];
    var visto = [];
    var trainante = [];
    var durata = [];
    var i;
    var item;
    var max = Math.min(items.length, 10);

    for (i = 0; i < items.length; i = i + 1) {
      item = items[i];
      if (campoVisto(item.campo)) {
        visto.push(item);
      } else if (campoTrainante(item.campo)) {
        trainante.push(item);
      } else if (campoDurataPs(item.campo)) {
        durata.push(item);
      }
    }
    if (visto.length) righe.push(rigaGruppoAnteprima("DATI VISTO", visto));
    if (trainante.length) righe.push(rigaGruppoAnteprima("TRAINANTE", trainante));
    if (durata.length) righe.push(rigaGruppoAnteprima("MOTIVO E DURATA PS", durata));

    for (i = 0; i < items.length && righe.length < max + (visto.length ? 1 : 0) + (trainante.length ? 1 : 0) + (durata.length ? 1 : 0); i = i + 1) {
      item = items[i];
      if (campoVisto(item.campo)) continue;
      if (campoTrainante(item.campo)) continue;
      if (campoDurataPs(item.campo)) continue;
      righe.push("<div style=\"border-top:1px solid #d7e7f3;padding:4px 0;\">" +
        "<div><strong>" + escapeHtml(etichettaCampoAnteprima(item.campo)) + "</strong> <span style=\"color:#587089;\">(" + escapeHtml(item.tipo) + ")</span></div>" +
        "<div style=\"font-size:11px;color:#6b7280;\">Prima: " + escapeHtml(item.prima || "vuoto") + "</div>" +
        "<div style=\"font-size:11px;color:#0f5f2a;\">Dopo: " + escapeHtml(item.dopo || "vuoto") + "</div>" +
        "</div>");
    }
    return "<div style=\"margin-top:7px;background:#ffffff;border:1px solid #8cc5ec;border-radius:5px;padding:7px;box-shadow:0 1px 3px rgba(0,80,140,0.12);\">" +
      "<div style=\"font-weight:800;margin-bottom:4px;color:#005c9d;\">Anteprima modifiche</div>" +
      righe.join("") +
      "</div>";
  }

  function campoVisto(campo) {
    return campo === "data frontiera" ||
      campo === "frontiera" ||
      campo === "tipo visto" ||
      campo === "numero visto" ||
      campo === "data visto" ||
      campo === "data scadenza visto" ||
      campo === "visto rilasciato da" ||
      campo === "motivo visto";
  }

  function campoTrainante(campo) {
    return campo === "stato civile" ||
      campo === "coniuge" ||
      campo === "referenze";
  }

  function campoDurataPs(campo) {
    return campo === "motivo soggiorno" ||
      campo === "data prima dichiarazione" ||
      campo === "data scadenza pd";
  }

  function rigaGruppoAnteprima(titolo, items) {
    var righe = [];
    var i;
    var item;

    for (i = 0; i < items.length; i = i + 1) {
      item = items[i];
      righe.push("<div style=\"padding:3px 0;border-top:1px solid #d7e7f3;\">" +
        "<strong>" + escapeHtml(etichettaCampoAnteprima(item.campo)) + "</strong>" +
        "<div style=\"font-size:11px;color:#6b7280;\">Prima: " + escapeHtml(item.prima || "vuoto") + "</div>" +
        "<div style=\"font-size:11px;color:#0f5f2a;\">Dopo: " + escapeHtml(item.dopo || "vuoto") + "</div>" +
        "</div>");
    }
    return "<div style=\"margin-top:5px;border:1px solid #b7d3e8;background:#f7fbff;border-radius:5px;padding:6px;\">" +
      "<div style=\"font-weight:800;color:#003b66;margin-bottom:3px;\">" + escapeHtml(titolo) + "</div>" +
      righe.join("") +
      "</div>";
  }

  function etichettaCampoAnteprima(campo) {
    if (campo === "data prima dichiarazione") {
      return praticaRinnovoOAggiornamento() ? "data rinnovo" : "data presentazione istanza";
    }
    if (campo === "data scadenza pd") return "data scadenza ps";
    return campo;
  }

  function praticaRinnovoOAggiornamento() {
    var tipo = document.getElementsByName("tipoPratica")[0] || document.getElementById("tipoPratica");
    var testo;

    if (!tipo) return false;
    if (tipo.value === "R" || tipo.value === "A") return true;
    testo = valoreCampo(tipo);
    return norm(testo).indexOf("rinnovo") >= 0 || norm(testo).indexOf("aggiornamento") >= 0;
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
      aggiornaStatoPill(avvisi, null);
      return;
    }
    for (i = 0; i < avvisi.length; i = i + 1) {
      righe.push("<li>" + escapeHtml(avvisi[i]) + "</li>");
    }
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">ATTENZIONE:</div><ul style=\"margin:0;padding-left:18px;\">" + righe.join("") + "</ul>";
    box.style.display = "block";
    aggiornaAltezzaHud();
    aggiornaStatoPill(avvisi, null);
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
      aggiornaStatoPill(null, critici);
      return;
    }
    for (i = 0; i < critici.length; i = i + 1) {
      righe.push("<li>" + escapeHtml(critici[i]) + "</li>");
    }
    box.innerHTML = "<div style=\"font-weight:700;margin-bottom:4px;\">ATTENZIONE:</div><ul style=\"margin:0;padding-left:18px;\">" + righe.join("") + "</ul>";
    box.style.display = "block";
    aggiornaAltezzaHud();
    aggiornaStatoPill(null, critici);
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
    // Gestione altezza automatica nel design a pill
  }

  // ─── UTILITÀ HTML ────────────────────────────────────────────────────────────
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

  // ─── HUD / PILL ──────────────────────────────────────────────────────────────
  function bottone(testo, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.appendChild(document.createTextNode(testo));
    b.onclick = fn;
    b.style.display = "block";
    b.style.width = "100%";
    b.style.marginTop = "5px";
    b.style.padding = "4px 5px";
    b.style.minHeight = "26px";
    b.style.font = "700 11px Arial";
    b.style.lineHeight = "1.15";
    b.style.border = "1px solid #7fa6c9";
    b.style.borderRadius = "5px";
    b.style.background = "#f5f9fd";
    b.style.color = "#003b66";
    b.style.cursor = "pointer";
    b.style.outline = "none";
    b.style.textAlign = "center";
    b.style.whiteSpace = "normal";
    b.style.overflowWrap = "break-word";
    b.onfocus = function () {
      b.blur();
    };
    return b;
  }

  function bottoneConTasto(tasto, testo, fn) {
    var b = bottone("", fn);
    var badge = document.createElement("span");
    var label = document.createElement("span");
    b.style.display = "flex";
    b.style.alignItems = "center";
    b.style.textAlign = "left";
    b.style.gap = "5px";
    badge.appendChild(document.createTextNode(tasto));
    badge.style.display = "inline-block";
    badge.style.flexShrink = "0";
    badge.style.background = "#003b66";
    badge.style.color = "#ffffff";
    badge.style.borderRadius = "3px";
    badge.style.padding = "1px 4px";
    badge.style.font = "700 10px Arial";
    badge.style.lineHeight = "1.4";
    label.appendChild(document.createTextNode(testo));
    b.appendChild(badge);
    b.appendChild(label);
    return b;
  }

  function creaPannelloLog(id, titolo, placeholder, evidenza) {
    var box = document.createElement("div");
    box.id = id;
    box.style.flex = evidenza ? "2 1 0" : "1 1 0";
    box.style.minWidth = "0";
    box.style.margin = "6px 8px 6px 0";
    box.style.padding = "7px";
    box.style.height = "261px";
    box.style.maxHeight = "261px";
    box.style.overflowY = "auto";
    box.style.overflowX = "hidden";
    box.style.background = evidenza ? "#f1f8ff" : "#ffffff";
    box.style.border = evidenza ? "2px solid #2f8ac7" : "1px solid #c6dced";
    box.style.borderRadius = "5px";
    box.style.font = evidenza ? "12.5px Arial" : "12px Arial";
    box.style.lineHeight = "1.35";
    box.style.color = "#0f2f4a";
    box.innerHTML = titoloLog(titolo, evidenza) + "<div style=\"color:#587089;\">" + escapeHtml(placeholder) + "</div>";
    return box;
  }

  function applicaPosizioneHud(p) {
    var raw = localStorage.getItem(HUD_POS_KEY);
    var pos;

    p.style.left = "10px";
    p.style.top = "10px";
    p.style.bottom = "";
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
      p.style.bottom = "";
      p.style.right = "";
    } else if (typeof pos.left === "number" && typeof pos.bottom === "number") {
      // legacy: posizione salvata con bottom, reset a default
      p.style.left = Math.max(0, pos.left) + "px";
      p.style.top = "10px";
      p.style.bottom = "";
      p.style.right = "";
    }
  }

  function abilitaTastiRapidi() {
    if (window.__STRANIERI_WEB_COPILOT_HOTKEYS === "1") return;
    window.__STRANIERI_WEB_COPILOT_HOTKEYS = "1";
    document.addEventListener("keydown", function (eventObject) {
      var key = eventObject.key || "";
      var azione = null;

      if (key === "F1") azione = primaCopia;
      if (key === "F2") azione = incollaPrimaCopia;
      if (key === "F3") azione = copia;
      if (key === "F4") azione = incolla;
      if (key === "F5") azione = controllaPratica;
      if (!azione) return;
      if (eventObject.preventDefault) eventObject.preventDefault();
      if (eventObject.stopPropagation) eventObject.stopPropagation();
      azione();
      return false;
    }, true);
  }

  function aggiornaStatoPill(avvisi, critici) {
    var pill = document.getElementById("autoacq_pill");
    var statoEl = document.getElementById("autoacq_pill_stato");
    var contatore = document.getElementById("autoacq_pill_count");
    var totale;

    if (avvisi !== null) { _pillAvvisi = avvisi; }
    if (critici !== null) { _pillCritici = critici; }
    avvisi = _pillAvvisi;
    critici = _pillCritici;

    totale = (avvisi ? avvisi.length : 0) + (critici ? critici.length : 0);

    if (!pill || !statoEl) return;

    if (critici && critici.length) {
      statoEl.style.background = "#dc2626";
      statoEl.title = critici.length + " avvisi critici";
    } else if (avvisi && avvisi.length) {
      statoEl.style.background = "#d97706";
      statoEl.title = avvisi.length + " avvisi";
    } else {
      statoEl.style.background = "#16a34a";
      statoEl.title = "OK";
    }

    if (contatore) {
      contatore.textContent = totale > 0 ? String(totale) : "";
      contatore.style.display = totale > 0 ? "inline-block" : "none";
    }
  }

  function resetStatoPill() {
    _pillAvvisi = null;
    _pillCritici = null;
    aggiornaStatoPill([], []);
  }

  function hud() {
    var host;
    var pill;
    var pillTesto;
    var pillStato;
    var pillCount;
    var panel;
    var header;
    var toggle;
    var body;
    var content;
    var riga;
    var logAssicurata;
    var logVecchia;
    var logGenerati;
    var m;
    var fix;
    var crit;
    var warn;
    var panelAperto = false;
    var hasMoved = false;
    var pillToggleBtn;

    var esistente = document.getElementById("autoacq_hud");
    if (esistente) {
      if (esistente.getAttribute("data-stranieri-web-copilot") === "1") return;
      if (esistente.parentNode) esistente.parentNode.removeChild(esistente);
    }
    var pillEsistente = document.getElementById("autoacq_pill");
    if (pillEsistente && pillEsistente.parentNode) pillEsistente.parentNode.removeChild(pillEsistente);

    host = document.body || document.documentElement;
    if (!host) {
      alert("Stranieri WEB - Copilot avviato, ma BODY non disponibile.");
      return;
    }

    pill = document.createElement("div");
    pill.id = "autoacq_pill";
    pill.style.position = "fixed";
    pill.style.left = "10px";
    pill.style.top = "10px";
    pill.style.zIndex = "2147483647";
    pill.style.background = "#005c9d";
    pill.style.color = "#ffffff";
    pill.style.borderRadius = "20px";
    pill.style.padding = "6px 12px";
    pill.style.font = "700 12px Arial";
    pill.style.display = "flex";
    pill.style.alignItems = "center";
    pill.style.gap = "7px";
    pill.style.cursor = "pointer";
    pill.style.boxShadow = "0 4px 12px rgba(0,59,102,0.35)";
    pill.style.userSelect = "none";
    pill.style.minWidth = "180px";
    pill.style.flexDirection = "column";
    pill.style.alignItems = "flex-start";
    pill.style.gap = "1px";
    pill.title = "Clicca per aprire Stranieri WEB - Copilot";
    applicaPosizioneHud(pill);

    // Riga superiore: nome + dot + count
    var pillRiga = document.createElement("div");
    pillRiga.style.display = "flex";
    pillRiga.style.alignItems = "center";
    pillRiga.style.gap = "7px";
    pillRiga.style.width = "100%";

    pillTesto = document.createElement("span");
    pillTesto.appendChild(document.createTextNode("Stranieri WEB - Copilot"));
    pillRiga.appendChild(pillTesto);
    pill.appendChild(pillRiga);

    pillStato = document.createElement("span");
    pillStato.id = "autoacq_pill_stato";
    pillStato.style.display = "inline-block";
    pillStato.style.width = "10px";
    pillStato.style.height = "10px";
    pillStato.style.borderRadius = "50%";
    pillStato.style.background = "#16a34a";
    pillStato.style.flexShrink = "0";
    pillRiga.appendChild(pillStato);

    pillCount = document.createElement("span");
    pillCount.id = "autoacq_pill_count";
    pillCount.style.display = "none";
    pillCount.style.background = "#dc2626";
    pillCount.style.color = "#fff";
    pillCount.style.borderRadius = "10px";
    pillCount.style.padding = "1px 6px";
    pillCount.style.font = "700 10px Arial";
    pillRiga.appendChild(pillCount);

    pillToggleBtn = document.createElement("button");
    pillToggleBtn.type = "button";
    pillToggleBtn.appendChild(document.createTextNode("▾"));
    pillToggleBtn.style.marginLeft = "auto";
    pillToggleBtn.style.background = "rgba(255,255,255,0.18)";
    pillToggleBtn.style.border = "none";
    pillToggleBtn.style.borderRadius = "3px";
    pillToggleBtn.style.color = "#ffffff";
    pillToggleBtn.style.font = "bold 13px Arial";
    pillToggleBtn.style.lineHeight = "1";
    pillToggleBtn.style.padding = "1px 4px";
    pillToggleBtn.style.cursor = "pointer";
    pillToggleBtn.style.outline = "none";
    pillToggleBtn.style.flexShrink = "0";
    pillToggleBtn.title = "Apri / chiudi pannello";
    pillToggleBtn.onfocus = function () { pillToggleBtn.blur(); };
    pillRiga.appendChild(pillToggleBtn);

    var pillAutore = document.createElement("span");
    pillAutore.appendChild(document.createTextNode("© Jurij Rella · v" + VERSIONE));
    pillAutore.style.font = "10px Arial";
    pillAutore.style.fontWeight = "400";
    pillAutore.style.opacity = "0.72";
    pill.appendChild(pillAutore);

    panel = document.createElement("div");
    panel.id = "autoacq_hud";
    panel.setAttribute("data-stranieri-web-copilot", "1");
    panel.style.position = "fixed";
    panel.style.zIndex = "2147483646";
    panel.style.background = "rgba(246,250,253,0.98)";
    panel.style.color = "#0f2f4a";
    panel.style.border = "1px solid #2f6f9f";
    panel.style.borderRadius = "8px";
    panel.style.padding = "0";
    panel.style.font = "13px Arial";
    panel.style.boxShadow = "0 8px 22px rgba(0,59,102,0.25)";
    panel.style.width = "790px";
    panel.style.minWidth = "790px";
    panel.style.maxWidth = "790px";
    panel.style.overflowX = "hidden";
    panel.style.overflowY = "hidden";
    panel.style.display = "none";

    toggle = bottone("\u2715", function () {
      chiudiPanel();
    });
    toggle.style.fontWeight = "700";
    toggle.style.display = "inline-block";
    toggle.style.width = "30px";
    toggle.style.margin = "0";
    toggle.style.padding = "3px 0";
    toggle.style.textAlign = "center";
    toggle.style.borderColor = "#b7d3e8";
    toggle.style.background = "#e6f1fa";

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
    header.style.whiteSpace = "nowrap";
    header.appendChild(document.createTextNode("Stranieri WEB - Copilot"));
    toggle.style.marginLeft = "auto";
    header.appendChild(toggle);
    panel.appendChild(header);

    content = document.createElement("div");
    content.id = "autoacq_content";
    content.style.display = "block";

    body = document.createElement("div");
    body.style.display = "flex";
    body.style.alignItems = "stretch";
    body.style.gap = "8px";
    body.style.height = "285px";

    riga = document.createElement("div");
    riga.style.display = "block";
    riga.style.width = "120px";
    riga.style.minWidth = "120px";
    riga.style.padding = "6px 0 6px 8px";
    riga.appendChild(bottoneConTasto("F1", "Copia da Assicurata", primaCopia));
    riga.appendChild(bottoneConTasto("F2", "Incolla vecchia anagrafica", incollaPrimaCopia));
    riga.appendChild(bottoneConTasto("F3", "Copia dati PS precedente", copia));
    riga.appendChild(bottoneConTasto("F4", "Incolla su nuova pratica", incolla));
    riga.appendChild(bottoneConTasto("F5", "Controlla pratica", controllaPratica));
    riga.appendChild(bottone("Check finale", checkFinale));
    riga.appendChild(bottone("Nuova pratica", nuovaPratica));

    logAssicurata = creaPannelloLog("autoacq_log_assicurata", "DATI ASSICURATA", "In attesa di F1/F2.", false);
    logVecchia = creaPannelloLog("autoacq_log_vecchia", "DATI VECCHIA PRATICA", "In attesa di F3.", false);
    logGenerati = creaPannelloLog("autoacq_log_generati", "DATI GENERATI", "In attesa di incolla o controlli.", true);

    body.appendChild(riga);
    body.appendChild(logAssicurata);
    body.appendChild(logVecchia);
    body.appendChild(logGenerati);
    content.appendChild(body);

    m = document.createElement("span");
    m.id = "autoacq_msg";
    m.appendChild(document.createTextNode("pronto"));
    m.style.display = "block";
    m.style.margin = "6px 8px 4px 8px";
    m.style.padding = "3px 7px";
    m.style.background = "transparent";
    m.style.border = "none";
    m.style.borderTop = "1px solid #c6dced";
    m.style.borderRadius = "0";
    m.style.whiteSpace = "normal";
    m.style.lineHeight = "1.35";
    m.style.color = "#4a6a84";
    m.style.font = "italic 11px Arial";
    m.style.height = "22px";
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
    content.appendChild(warn);

    panel.appendChild(content);

    function aggiornaPillToggle() {
      if (pillToggleBtn) {
        pillToggleBtn.textContent = panelAperto ? "▴" : "▾";
        pillToggleBtn.title = panelAperto ? "Chiudi pannello" : "Apri pannello";
      }
    }

    function apriPanel() {
      var pillRect = pill.getBoundingClientRect();
      panel.style.display = "block";
      panel.style.left = Math.max(6, pillRect.left) + "px";
      panel.style.top = (pillRect.bottom + 8) + "px";
      panel.style.bottom = "";
      panel.style.right = "";
      panelAperto = true;
      aggiornaPillToggle();
      localStorage.setItem(HUD_OPEN_KEY, "1");
    }

    function chiudiPanel() {
      panel.style.display = "none";
      panelAperto = false;
      aggiornaPillToggle();
      localStorage.removeItem(HUD_OPEN_KEY);
    }

    pillToggleBtn.onclick = function (e) {
      e.stopPropagation();
      if (panelAperto) { chiudiPanel(); } else { apriPanel(); }
    };

    pill.addEventListener("click", function () {
      if (hasMoved) { hasMoved = false; return; }
      if (panelAperto) {
        chiudiPanel();
      } else {
        apriPanel();
      }
    });

    (function () {
      var dragging = false;
      var startX = 0;
      var startY = 0;
      var startLeft = 0;
      var startTop = 0;

      pill.addEventListener("mousedown", function (e) {
        if (e.target.tagName && e.target.tagName.toLowerCase() === "button") return;
        dragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = pill.offsetLeft;
        startTop = pill.offsetTop;
        e.preventDefault();
      });

      document.addEventListener("mousemove", function (e) {
        var left;
        var top;
        if (!dragging) return;
        if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) { hasMoved = true; }
        left = startLeft + e.clientX - startX;
        top = startTop + e.clientY - startY;
        left = Math.min(Math.max(6, left), window.innerWidth - pill.offsetWidth - 6);
        top = Math.min(Math.max(6, top), window.innerHeight - pill.offsetHeight - 6);
        pill.style.left = left + "px";
        pill.style.top = top + "px";
        pill.style.bottom = "";
        pill.style.right = "";
        if (panelAperto) {
          panel.style.left = Math.max(6, left) + "px";
          panel.style.top = (top + pill.offsetHeight + 8) + "px";
          panel.style.bottom = "";
          panel.style.right = "";
        }
      });

      document.addEventListener("mouseup", function () {
        if (!dragging) return;
        dragging = false;
        localStorage.setItem(HUD_POS_KEY, JSON.stringify({ left: pill.offsetLeft, top: pill.offsetTop }));
      });
    }());

    // Drag dalla barra blu — sposta pill + pannello insieme
    (function () {
      var dragging = false;
      var startX = 0;
      var startY = 0;
      var startPanelLeft = 0;
      var startPanelTop = 0;

      header.style.cursor = "move";

      header.addEventListener("mousedown", function (e) {
        if (e.target.tagName && e.target.tagName.toLowerCase() === "button") return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startPanelLeft = panel.offsetLeft;
        startPanelTop = panel.offsetTop;
        e.preventDefault();
      });

      document.addEventListener("mousemove", function (e) {
        var left, panelTop, pillTop;
        if (!dragging) return;
        left = startPanelLeft + e.clientX - startX;
        panelTop = startPanelTop + e.clientY - startY;
        left = Math.min(Math.max(6, left), window.innerWidth - panel.offsetWidth - 6);
        panelTop = Math.min(Math.max(pill.offsetHeight + 14, panelTop), window.innerHeight - panel.offsetHeight - 6);
        pillTop = panelTop - pill.offsetHeight - 8;
        panel.style.left = left + "px";
        panel.style.top = panelTop + "px";
        panel.style.bottom = "";
        panel.style.right = "";
        pill.style.left = left + "px";
        pill.style.top = pillTop + "px";
        pill.style.bottom = "";
        pill.style.right = "";
      });

      document.addEventListener("mouseup", function () {
        if (!dragging) return;
        dragging = false;
        localStorage.setItem(HUD_POS_KEY, JSON.stringify({ left: pill.offsetLeft, top: pill.offsetTop }));
      });
    }());

    host.insertBefore(panel, host.firstChild);
    host.insertBefore(pill, host.firstChild);
    if (localStorage.getItem(HUD_OPEN_KEY) === "1") { apriPanel(); }
    abilitaTastiRapidi();
  }

  window.STRANIERI_WEB_COPILOT_TEST = hud;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hud);
  } else {
    hud();
  }
  setTimeout(hud, 1000);
}());
