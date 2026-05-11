    p.style.width = "390px";
    p.style.height = "500px";
    p.style.minWidth = "390px";
    p.style.maxWidth = "390px";
    p.style.overflowX = "hidden";
    p.style.overflowY = "hidden";

    function impostaHudRidotta(ridotta) {
      content.style.display = ridotta ? "none" : "block";
      toggle.textContent = ridotta ? "+" : "-";
      p.style.width = ridotta ? "330px" : "390px";
      p.style.height = ridotta ? "38px" : "500px";
      p.style.minWidth = ridotta ? "330px" : "390px";
      p.style.maxWidth = ridotta ? "330px" : "390px";
      salvaStatoHudRidotta(ridotta);
      aggiornaAltezzaHud();
    }

    toggle = bottone("-", function () {
      impostaHudRidotta(content.style.display !== "none");
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
    riga.appendChild(bottone("F1 - Copia da Assicurata", primaCopia));
    riga.appendChild(bottone("F2 - Ricerca vecchia anagrafica", incollaPrimaCopia));
    riga.appendChild(bottone("F3 - Copia dati da Vecchia Anagrafica", copia));
    riga.appendChild(bottone("F4 - Incolla su nuova pratica", incolla));
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
    header.style.whiteSpace = "nowrap";
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
    if (leggiStatoHudRidotta()) {
      content.style.display = "none";
      toggle.textContent = "+";
      p.style.width = "330px";
      p.style.height = "38px";
      p.style.minWidth = "330px";
      p.style.maxWidth = "330px";
    }

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
