    autore.style.opacity = "0.88";
    header.appendChild(autore);
    header.appendChild(toggle);
    p.appendChild(header);
    rendiHudMobile(p, header);

    content = document.createElement("div");
    content.id = "autoacq_content";
    content.style.display = "block";
    if (localStorage.getItem(HUD_MIN_KEY) === "1") {
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
