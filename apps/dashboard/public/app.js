const serviceIds = ["tier-1", "tier-2", "tier-3"];
const demoButton = document.querySelector("#simulate-button");
const resetButton = document.querySelector("#reset-button");
const banner = document.querySelector("#simulation-banner");
const eventList = document.querySelector("#event-list");
const simulationNote = document.querySelector(".simulation-note");
let simulationActive = false;
let refreshInProgress = false;

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long"
}).format(new Date()).toLocaleUpperCase("pt-BR");

function setStatus(serviceId, status, label) {
  const statusPill = document.querySelector(`#status-${serviceId}`);
  statusPill.className = `status-pill ${status}`;
  statusPill.querySelector("span").textContent = label;
}

function addEvent(title, detail, success = false) {
  const currentEmpty = eventList.querySelector(".empty-events");
  if (currentEmpty) {
    currentEmpty.remove();
  }

  const now = new Date();
  const row = document.createElement("div");
  row.className = `event-row${success ? " event-success" : ""}`;
  const dot = document.createElement("span");
  dot.className = "event-dot";
  const copy = document.createElement("span");
  copy.className = "event-copy";
  const eventTitle = document.createElement("strong");
  eventTitle.textContent = title;
  const eventDetail = document.createElement("small");
  eventDetail.textContent = detail;
  const time = document.createElement("time");
  time.className = "event-time";
  time.dateTime = now.toISOString();
  time.textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  copy.append(eventTitle, eventDetail);
  row.append(dot, copy, time);
  eventList.prepend(row);
  document.querySelector("#event-count").textContent = `${eventList.querySelectorAll(".event-row").length} eventos`;
}

async function refreshHealth() {
  if (refreshInProgress) {
    return;
  }
  refreshInProgress = true;
  document.querySelector("#refresh-button").disabled = true;

  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Healthcheck do dashboard retornou HTTP ${response.status}`);
    }
    const payload = await response.json();
    const onlineCount = payload.services.filter((service) => service.online).length;
    document.querySelector("#availability-value").innerHTML = `${Math.round((onlineCount / payload.services.length) * 100)}<small>%</small>`;
    document.querySelector("#last-check").textContent = `Verificado às ${new Date(payload.checkedAt).toLocaleTimeString("pt-BR")}`;

    for (const serviceId of serviceIds) {
      const service = payload.services.find((item) => item.id === serviceId);
      const detail = document.querySelector(`#real-${serviceId}`);
      const dot = detail.previousElementSibling;
      const link = document.querySelector(`#link-${serviceId}`);
      if (service.url) {
        link.href = service.url;
        link.hidden = false;
      } else {
        link.removeAttribute("href");
        link.hidden = true;
      }

      if (simulationActive) {
        dot.className = service.online ? "meta-dot online" : "meta-dot offline";
        detail.textContent = `Real: ${service.online ? "online" : "offline"} · ${service.port}`;
        setStatus(serviceId, serviceId === "tier-1" ? "status-simulated" : "", serviceId === "tier-1" ? "Falha simulada" : "Operacional");
        continue;
      }

      if (service.online) {
        dot.className = "meta-dot online";
        detail.textContent = `Real: online · ${service.port}`;
        setStatus(serviceId, "", "Operacional");
      } else {
        dot.className = "meta-dot offline";
        detail.textContent = `Real: offline · ${service.port}`;
        setStatus(serviceId, "status-offline", "Indisponível");
      }
    }
  } catch (error) {
    document.querySelector("#last-check").textContent = "Falha ao consultar os serviços";
    addEvent("Erro de monitoramento", error.message);
  } finally {
    refreshInProgress = false;
    document.querySelector("#refresh-button").disabled = false;
  }
}

function runSimulation() {
  if (simulationActive) {
    return;
  }

  simulationActive = true;
  document.body.classList.add("scenario-failed");
  setStatus("tier-1", "status-simulated", "Falha simulada");
  setStatus("tier-2", "", "Operacional");
  setStatus("tier-3", "", "Operacional");
  banner.className = "simulation-banner banner-active";
  document.querySelector("#banner-title").textContent = "Falha no Tier 1 — isolamento preservado";
  document.querySelector("#banner-message").textContent = "Os serviços Tier 2 e Tier 3 continuam operacionais neste cenário.";
  demoButton.classList.add("button-reset");
  demoButton.querySelector("span").textContent = "Demonstração em andamento";
  demoButton.disabled = true;
  resetButton.hidden = false;
  simulationNote.innerHTML = "<span>i</span> Cenário visual: processos reais e healthchecks não são alterados.";
  addEvent("Falha simulada no Tier 1", "API de pedidos indisponível; os demais tiers permanecem ativos.");
  addEvent("Isolamento confirmado", "Tier 2 continua operacional apesar da falha no serviço crítico.", true);
}

function resetSimulation() {
  if (!simulationActive) {
    return;
  }
  simulationActive = false;
  document.body.classList.remove("scenario-failed");
  banner.className = "simulation-banner";
  document.querySelector("#banner-title").textContent = "Cenário restaurado";
  document.querySelector("#banner-message").textContent = "Estados reais atualizados pelos healthchecks dos serviços.";
  demoButton.querySelector("span").textContent = "Simular falha do Tier 1";
  demoButton.classList.remove("button-reset");
  demoButton.disabled = false;
  resetButton.hidden = true;
  simulationNote.innerHTML = "<span>i</span> A simulação é apenas visual: não interrompe nem altera os processos reais.";
  addEvent("Cenário restaurado", "Exibição retornou ao estado dos healthchecks reais.", true);
  refreshHealth();
}

demoButton.addEventListener("click", runSimulation);
resetButton.addEventListener("click", resetSimulation);
document.querySelector("#refresh-button").addEventListener("click", refreshHealth);

refreshHealth();
setInterval(refreshHealth, 5000);
