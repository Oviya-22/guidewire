let policies = JSON.parse(localStorage.getItem("gigshield_policies") || "[]");
let payoutQueue = JSON.parse(localStorage.getItem("gigshield_payout_queue") || "[]");
let triggerCount = Number(localStorage.getItem("gigshield_trigger_count") || 0);
let monitoringInterval = null;

function getUsers() {
  return JSON.parse(localStorage.getItem("gigshield_users") || "[]");
}

function saveUsers(users) {
  localStorage.setItem("gigshield_users", JSON.stringify(users));
}

function showMessage(msg, good = false) {
  const box = document.getElementById("authMessage");
  if (!box) return;
  box.style.color = good ? "#15803d" : "#b45309";
  box.textContent = msg;
}

function switchTab(tab) {
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginBtn = document.getElementById("loginTabBtn");
  const registerBtn = document.getElementById("registerTabBtn");

  if (!loginTab || !registerTab || !loginBtn || !registerBtn) return;

  loginTab.classList.remove("active");
  registerTab.classList.remove("active");
  loginBtn.classList.remove("active");
  registerBtn.classList.remove("active");

  if (tab === "login") {
    loginTab.classList.add("active");
    loginBtn.classList.add("active");
  } else {
    registerTab.classList.add("active");
    registerBtn.classList.add("active");
  }
}

function registerUser() {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const password = document.getElementById("regPassword").value.trim();
  const platform = document.getElementById("regPlatform").value;
  const cityZone = document.getElementById("regCityZone").value;

  if (!name || !email || !password) {
    showMessage("Please fill all registration fields.");
    return;
  }

  const users = getUsers();
  const exists = users.find(u => u.email === email);

  if (exists) {
    showMessage("Account already exists with this email.");
    return;
  }

  users.push({ name, email, password, platform, cityZone });
  saveUsers(users);

  showMessage("Account created successfully. You can login now.", true);
  switchTab("login");
  document.getElementById("loginEmail").value = email;
}

function loginUser() {
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showMessage("Please enter email and password.");
    return;
  }

  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    showMessage("Invalid email or password. Create an account if you are new.");
    return;
  }

  localStorage.setItem("gigshield_current_user", JSON.stringify(user));
  window.location.href = "./dashboard.html";
}

function logout() {
  localStorage.removeItem("gigshield_current_user");
  window.location.href = "./index.html";
}

window.onload = function () {
  const currentUser = JSON.parse(localStorage.getItem("gigshield_current_user") || "null");
  const welcomeUser = document.getElementById("welcomeUser");

  if (welcomeUser && currentUser) {
    welcomeUser.textContent = currentUser.name;

    const platform = document.getElementById("platform");
    if (platform) platform.value = currentUser.platform || "Swiggy";

    const zone = document.getElementById("zone");
    if (zone && currentUser.cityZone) zone.value = currentUser.cityZone;

    const holder = document.getElementById("holderName");
    if (holder) holder.value = currentUser.name;
  }

  renderPolicies();
  renderQueue();
  updateSummary();
};

function calculatePremium() {
  const income = Number(document.getElementById("weeklyIncome").value);
  const days = Number(document.getElementById("workingDays").value);
  const hours = Number(document.getElementById("hoursPerDay").value);
  const exposure = Number(document.getElementById("exposureScore").value);
  const zone = document.getElementById("zone").value;

  let zoneFactor = 1;
  if (zone === "Central Chennai") zoneFactor = 1.12;
  if (zone === "North Chennai") zoneFactor = 1.22;
  if (zone === "South Chennai") zoneFactor = 1.08;

  const workIntensity = (days * hours) / 54;
  const basePremium = income * 0.045;
  const premium = Math.round((basePremium + exposure * 12) * zoneFactor * workIntensity);
  const coverage = Math.round(Math.min(income * 0.6, income - premium));
  const lossRatio = Math.round((coverage / Math.max(premium * 8, 1)) * 100);

  let riskBand = "Low";
  if (premium >= 300) riskBand = "High";
  else if (premium >= 200) riskBand = "Moderate";

  document.getElementById("premiumOut").textContent = `₹ ${premium}`;
  document.getElementById("coverageOut").textContent = `₹ ${coverage}`;
  document.getElementById("riskBandOut").textContent = riskBand;
  document.getElementById("lossRatioOut").textContent = `${lossRatio}%`;

  updateSummary();
}

function createPolicy() {
  const name = document.getElementById("holderName").value.trim();
  const partnerId = document.getElementById("partnerId").value.trim();
  const startDate = document.getElementById("startDate").value;
  const duration = document.getElementById("duration").value;
  const premiumText = document.getElementById("premiumOut").textContent;
  const coverageText = document.getElementById("coverageOut").textContent;
  const zone = document.getElementById("zone").value;
  const platform = document.getElementById("platform").value;

  if (!name || !partnerId || !startDate || premiumText === "₹ --") {
    alert("Please complete profile, calculate premium, and fill policy details.");
    return;
  }

  const premium = Number(premiumText.replace(/[^\d]/g, ""));
  const coverage = Number(coverageText.replace(/[^\d]/g, ""));

  const existing = policies.find(p => p.partnerId === partnerId);
  if (existing) {
    alert("A policy with this Partner ID already exists.");
    return;
  }

  const policy = {
    holderName: name,
    partnerId,
    startDate,
    duration,
    premium,
    coverage,
    zone,
    platform,
    status: "Active"
  };

  policies.push(policy);
  localStorage.setItem("gigshield_policies", JSON.stringify(policies));

  const card = document.getElementById("policyCard");
  card.classList.remove("hidden");
  card.innerHTML = `
    <h4 style="margin-top:0;">Policy Created</h4>
    <p><strong>Holder:</strong> ${name}</p>
    <p><strong>Partner ID:</strong> ${partnerId}</p>
    <p><strong>Zone:</strong> ${zone}</p>
    <p><strong>Platform:</strong> ${platform}</p>
    <p><strong>Duration:</strong> ${duration}</p>
    <p><strong>Start Date:</strong> ${startDate}</p>
    <p><strong>Weekly Premium:</strong> ₹ ${premium}</p>
    <p><strong>Coverage Limit:</strong> ₹ ${coverage}</p>
  `;

  addLog(`Policy created for ${name} in ${zone}.`);
  renderPolicies();
  updateSummary();
}

function generateSensorData(mode) {
  if (mode === "Heavy Rain Pattern") {
    return {
      rainfall: randomInt(65, 95),
      waterlogging: randomInt(42, 70),
      wind: randomInt(20, 38)
    };
  }

  if (mode === "Flood Pattern") {
    return {
      rainfall: randomInt(75, 110),
      waterlogging: randomInt(62, 90),
      wind: randomInt(18, 34)
    };
  }

  if (mode === "Storm Pattern") {
    return {
      rainfall: randomInt(52, 82),
      waterlogging: randomInt(35, 58),
      wind: randomInt(46, 72)
    };
  }

  return {
    rainfall: randomInt(12, 45),
    waterlogging: randomInt(10, 30),
    wind: randomInt(8, 25)
  };
}

function evaluateTrigger(data) {
  let signals = 0;
  if (data.rainfall > 70) signals++;
  if (data.waterlogging > 60) signals++;
  if (data.wind > 45) signals++;
  return signals >= 2;
}

function deriveTriggerType(data) {
  if (data.rainfall > 70 && data.waterlogging > 60) return "Flood / Extreme Rain";
  if (data.wind > 45) return "Storm Impact";
  return "Rain Disruption";
}

function runSingleCycle() {
  const zone = document.getElementById("monitorZone").value;
  const mode = document.getElementById("monitorMode").value;
  const data = generateSensorData(mode);
  const triggered = evaluateTrigger(data);

  document.getElementById("rainfallOut").textContent = `${data.rainfall} mm`;
  document.getElementById("waterloggingOut").textContent = `${data.waterlogging}%`;
  document.getElementById("windOut").textContent = `${data.wind} km/h`;
  document.getElementById("zoneTriggerOut").textContent = triggered ? "Active" : "Inactive";
  document.getElementById("globalTriggerOut").textContent = triggered ? "Triggered" : "Monitoring";

  const banner = document.getElementById("monitorBanner");

  if (triggered) {
    banner.className = "decision-banner trusted";
    banner.textContent = `Parametric event activated for ${zone}. Eligible policies are being moved to payout queue.`;
    triggerCount += 1;
    localStorage.setItem("gigshield_trigger_count", triggerCount);
    processTriggeredPolicies(zone, data);
    addLog(`Trigger activated in ${zone}: Rainfall ${data.rainfall} mm, Waterlogging ${data.waterlogging}%, Wind ${data.wind} km/h.`);
  } else {
    banner.className = "decision-banner neutral";
    banner.textContent = `Monitoring completed for ${zone}. Trigger conditions were not met in this cycle.`;
    addLog(`No trigger in ${zone}: Rainfall ${data.rainfall} mm, Waterlogging ${data.waterlogging}%, Wind ${data.wind} km/h.`);
  }

  updateSummary();
}

function processTriggeredPolicies(zone, data) {
  const affectedPolicies = policies.filter(policy => policy.zone === zone && policy.status === "Active");

  affectedPolicies.forEach(policy => {
    const estimatedPayout = Math.min(Math.round(policy.coverage * 0.6), policy.coverage);

    const entry = {
      partnerId: policy.partnerId,
      holderName: policy.holderName,
      zone: policy.zone,
      triggerType: deriveTriggerType(data),
      payout: estimatedPayout
    };

    const alreadyQueued = payoutQueue.find(item =>
      item.partnerId === entry.partnerId &&
      item.zone === entry.zone &&
      item.triggerType === entry.triggerType
    );

    if (!alreadyQueued) {
      payoutQueue.push(entry);
      addLog(`Policy ${policy.partnerId} added to payout queue with estimated payout ₹ ${estimatedPayout}.`);
    }
  });

  localStorage.setItem("gigshield_payout_queue", JSON.stringify(payoutQueue));
  renderQueue();
}

function startMonitoring() {
  if (monitoringInterval) {
    addLog("Monitoring is already running.");
    return;
  }

  runSingleCycle();
  monitoringInterval = setInterval(runSingleCycle, 4000);
  addLog("Continuous monitoring started.");
}

function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    addLog("Continuous monitoring stopped.");
  }
}

function renderPolicies() {
  const box = document.getElementById("policyTable");
  if (!box) return;

  if (policies.length === 0) {
    box.innerHTML = `<div class="empty-note">No policies created yet.</div>`;
    document.getElementById("activePoliciesOut").textContent = "0";
    return;
  }

  let html = `
    <div class="table-row header">
      <div>Partner ID</div>
      <div>Holder</div>
      <div>Zone</div>
      <div>Premium</div>
      <div>Coverage</div>
    </div>
  `;

  policies.forEach(policy => {
    html += `
      <div class="table-row">
        <div>${policy.partnerId}</div>
        <div>${policy.holderName}</div>
        <div>${policy.zone}</div>
        <div>₹ ${policy.premium}</div>
        <div>₹ ${policy.coverage}</div>
      </div>
    `;
  });

  box.innerHTML = html;
  document.getElementById("activePoliciesOut").textContent = policies.length;
}

function renderQueue() {
  const box = document.getElementById("payoutQueue");
  if (!box) return;

  if (payoutQueue.length === 0) {
    box.innerHTML = `<div class="empty-note">No payout entries generated yet.</div>`;
    return;
  }

  let html = `
    <div class="table-row header">
      <div>Partner ID</div>
      <div>Holder</div>
      <div>Zone</div>
      <div>Trigger</div>
      <div>Payout</div>
    </div>
  `;

  payoutQueue.forEach(entry => {
    html += `
      <div class="table-row">
        <div>${entry.partnerId}</div>
        <div>${entry.holderName}</div>
        <div>${entry.zone}</div>
        <div>${entry.triggerType}</div>
        <div>₹ ${entry.payout}</div>
      </div>
    `;
  });

  box.innerHTML = html;
}

function updateSummary() {
  const totalPremium = policies.reduce((sum, p) => sum + Number(p.premium || 0), 0);
  const totalCoverage = policies.reduce((sum, p) => sum + Number(p.coverage || 0), 0);
  const queueLoad = payoutQueue.reduce((sum, q) => sum + Number(q.payout || 0), 0);

  const premiumCollectedOut = document.getElementById("premiumCollectedOut");
  const reserveOut = document.getElementById("reserveOut");
  const triggerCountOut = document.getElementById("triggerCountOut");
  const queueLoadOut = document.getElementById("queueLoadOut");

  if (premiumCollectedOut) premiumCollectedOut.textContent = `₹ ${totalPremium}`;
  if (reserveOut) reserveOut.textContent = `₹ ${Math.round(totalPremium * 0.55)}`;
  if (triggerCountOut) triggerCountOut.textContent = triggerCount;
  if (queueLoadOut) queueLoadOut.textContent = `₹ ${queueLoad}`;
}

function addLog(message) {
  const logBox = document.getElementById("eventLog");
  if (!logBox) return;

  if (logBox.textContent.includes("No monitoring events recorded yet.")) {
    logBox.innerHTML = "";
  }

  const item = document.createElement("div");
  item.className = "log-item";
  item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logBox.prepend(item);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}