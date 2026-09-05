"use strict";

const CASES = [
  {
    id: "elderly-speaker",
    number: "01",
    format: "Portrait source",
    title: "The reveal",
    short: "Shock · emphasis · resolve",
    summary: "Surprise turns to delight as an emphatic two-hand gesture resolves into a composed close.",
    video: "assets/videos/elderly-speaker-live-v4.mp4",
    poster: "assets/posters/elderly-speaker-live-v4.jpg",
    manifest: "assets/manifests/elderly-speaker.json?v=4"
  },
  {
    id: "home-kitchen",
    number: "02",
    format: "Landscape source",
    title: "Kitchen notes",
    short: "Surprise · open palm · settle",
    summary: "A kitchen presenter moves from a held stance to an open-palm explanation, then returns to neutral.",
    video: "assets/videos/home-kitchen-live-v4.mp4",
    poster: "assets/posters/home-kitchen-live-v4.jpg",
    manifest: "assets/manifests/home-kitchen.json?v=4"
  },
  {
    id: "pottery-studio",
    number: "03",
    format: "Landscape source",
    title: "Craft in motion",
    short: "Welcome · point · return",
    summary: "A warm studio introduction shifts into focused direction and closes with both hands grounded on the table.",
    video: "assets/videos/pottery-studio-live-v4.mp4",
    poster: "assets/posters/pottery-studio-live-v4.jpg",
    manifest: "assets/manifests/pottery-studio.json?v=4"
  },
  {
    id: "video-call",
    number: "04",
    format: "Landscape source",
    title: "Plan, revised",
    short: "Smile · explain · refocus",
    summary: "A home video call progresses from confident update to open-handed realization and a focused final plan.",
    video: "assets/videos/video-call-live-v4.mp4",
    poster: "assets/posters/video-call-live-v4.jpg",
    manifest: "assets/manifests/video-call.json?v=4"
  }
];

const TRACKS = {
  FACE: { label: "表情", english: "FACE", color: "var(--face)" },
  BODY: { label: "动作", english: "BODY", color: "var(--body)" },
  MUSIC: { label: "音乐", english: "MUSIC", color: "var(--music)" },
  SPEECH: { label: "台词", english: "SPEECH", color: "var(--speech)" }
};

const STATE_LABELS = {
  received: "已接收",
  active: "生效中",
  history: "历史",
  evicted: "已移出"
};

// Same normalized geometry as the 405 px-wide upstream compositor panel.
// NOW is 72% across the usable 377 px lane; one second spans 52 px.
const NOW_POSITION = 0.72;
const SECOND_SPAN = 52 / 377;

const video = document.querySelector("#demo-video");
const mediaSurface = document.querySelector("#media-surface");
const promptConsole = document.querySelector("#prompt-console");
const flowConsole = document.querySelector("#flow-console");
const flowRuler = document.querySelector("#flow-ruler");
const promptTracks = document.querySelector("#prompt-tracks");
const anchorText = document.querySelector("#anchor-text");
const caseList = document.querySelector("#case-list");
const caseKicker = document.querySelector("#case-kicker");
const caseTitle = document.querySelector("#case-title");
const caseSummary = document.querySelector("#case-summary");
const currentTimeLabel = document.querySelector("#current-time");
const consoleCurrentTime = document.querySelector("#console-current-time");
const playerCard = document.querySelector(".player-card");
const loadError = document.querySelector("#load-error");

const manifests = new Map();
let activeCase = CASES[0];
let activeManifest = null;
let playbackHandle = 0;
let playbackHandleType = "";

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function easeOutCubic(value) {
  const t = clamp(value, 0, 1);
  return 1 - ((1 - t) ** 3);
}

function formatTime(seconds, decimals = 2) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const scale = 10 ** decimals;
  const units = Math.round(safe * scale);
  const minutes = Math.floor(units / (60 * scale));
  const remainder = (units - minutes * 60 * scale) / scale;
  const width = decimals ? 3 + decimals : 2;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(decimals).padStart(width, "0")}`;
}

function stripPrefix(text) {
  return String(text || "").replace(/^[^:]+:\s*/, "");
}

function createCaseButtons() {
  caseList.replaceChildren();
  CASES.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "case-button";
    button.dataset.caseId = item.id;
    button.disabled = true;
    button.setAttribute("aria-current", item.id === activeCase.id ? "true" : "false");
    button.innerHTML = `
      <img src="${item.poster}" alt="" loading="lazy">
      <span>
        <small>CASE ${item.number}</small>
        <strong>${item.title}</strong>
        <span>${item.short}</span>
      </span>`;
    button.addEventListener("click", () => selectCase(item.id));
    caseList.append(button);
  });
}

async function loadManifests() {
  await Promise.all(CASES.map(async (item) => {
    const response = await fetch(item.manifest);
    if (!response.ok) throw new Error(`Could not load ${item.manifest}`);
    manifests.set(item.id, await response.json());
  }));
}

function eventState(event, time) {
  const admission = Number.isFinite(event.admitted_at) ? event.admitted_at : event.start;
  const eviction = Number.isFinite(event.evicted_at) ? event.evicted_at : null;
  if (time < admission) return { name: null, opacity: 0 };

  const admissionOpacity = admission <= 0 ? 1 : easeOutCubic((time - admission) / 0.28);
  if (eviction !== null && time >= eviction) {
    const fade = 1 - clamp((time - eviction) / 0.42, 0, 1);
    return fade > 0 ? { name: "evicted", opacity: fade } : { name: null, opacity: 0 };
  }
  if (time >= event.start && time < event.end) return { name: "active", opacity: admissionOpacity };
  if (time < event.start) return { name: "received", opacity: admissionOpacity };
  return { name: "history", opacity: admissionOpacity };
}

function createTimeMarker(second, className) {
  const marker = document.createElement("span");
  marker.className = className;
  marker.dataset.second = String(second);
  if (className === "flow-tick") marker.textContent = formatTime(second, 0);
  return marker;
}

function seekFromRail(event, duration) {
  if (event.target.closest(".prompt-packet")) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const position = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
  const targetTime = video.currentTime + ((NOW_POSITION - position) / SECOND_SPAN);
  video.currentTime = clamp(targetTime, 0, duration);
  updatePlaybackUI();
}

function renderPromptPanel(manifest) {
  const duration = manifest.duration || 15;
  promptConsole.dataset.caseId = activeCase.id;
  anchorText.textContent = manifest.anchor_text || "全局场景提示";
  flowRuler.replaceChildren();
  promptTracks.replaceChildren();

  for (let second = 0; second <= duration; second += 2) {
    flowRuler.append(createTimeMarker(second, "flow-tick"));
  }

  Object.entries(TRACKS).forEach(([track, meta]) => {
    const section = document.createElement("section");
    section.className = "prompt-track";
    section.style.setProperty("--track-color", meta.color);

    const header = document.createElement("header");
    header.className = "prompt-track-head";
    const stripe = document.createElement("i");
    const label = document.createElement("strong");
    const english = document.createElement("span");
    label.textContent = meta.label;
    english.textContent = meta.english;
    header.append(stripe, label, english);

    const rail = document.createElement("div");
    rail.className = "prompt-rail";
    rail.dataset.track = track;
    rail.setAttribute("aria-label", `${meta.label} ${meta.english} 提示时间轴`);
    rail.addEventListener("click", (event) => seekFromRail(event, duration));

    for (let second = 0; second <= duration; second += 2) {
      rail.append(createTimeMarker(second, "rail-grid-line"));
    }

    manifest.events.filter((item) => item.track === track).forEach((item) => {
      const packet = document.createElement("button");
      packet.type = "button";
      packet.className = "prompt-packet";
      packet.dataset.eventId = item.id;
      packet.eventData = item;

      const packetMeta = document.createElement("span");
      packetMeta.className = "packet-meta";
      const packetCopy = document.createElement("span");
      packetCopy.className = "packet-copy";
      packetCopy.textContent = stripPrefix(item.text);
      packet.append(packetMeta, packetCopy);
      packet.addEventListener("click", (event) => {
        event.stopPropagation();
        video.currentTime = item.start;
        updatePlaybackUI();
      });
      rail.append(packet);
    });

    section.append(header, rail);
    promptTracks.append(section);
  });

  updatePlaybackUI(0);
}

function updateMarkers(time) {
  flowConsole.querySelectorAll("[data-second]").forEach((marker) => {
    const second = Number(marker.dataset.second);
    const position = NOW_POSITION + ((time - second) * SECOND_SPAN);
    marker.hidden = position < 0 || position > 1;
    marker.style.left = `${position * 100}%`;
  });
}

function updatePackets(time) {
  promptTracks.querySelectorAll(".prompt-packet").forEach((packet) => {
    const event = packet.eventData;
    const state = eventState(event, time);
    const leading = NOW_POSITION + ((time - event.start) * SECOND_SPAN);
    const trailing = NOW_POSITION + ((time - event.end) * SECOND_SPAN);
    const isVisible = state.name && leading >= 0 && trailing <= 1;
    packet.hidden = !isVisible;
    if (!isVisible) return;

    packet.style.left = `${trailing * 100}%`;
    packet.style.width = `${(leading - trailing) * 100}%`;
    packet.classList.toggle("is-received", state.name === "received");
    packet.classList.toggle("is-active", state.name === "active");
    packet.classList.toggle("is-history", state.name === "history");
    packet.classList.toggle("is-evicted", state.name === "evicted");
    packet.style.setProperty("--eviction-opacity", state.opacity);
    packet.dataset.state = state.name;

    const packetMeta = packet.querySelector(".packet-meta");
    const nextMeta = `${STATE_LABELS[state.name]}  ${formatTime(event.start, 1)}–${formatTime(event.end, 1)}`;
    if (packetMeta.textContent !== nextMeta) packetMeta.textContent = nextMeta;
    packet.title = `${TRACKS[event.track].label} · ${nextMeta} · ${stripPrefix(event.text)}`;
    packet.setAttribute("aria-label", packet.title);
  });
}

function updatePlaybackUI(mediaTime) {
  if (!activeManifest) return;
  const duration = activeManifest.duration || 15;
  const candidate = Number.isFinite(mediaTime) ? mediaTime : video.currentTime;
  const time = clamp(candidate || 0, 0, duration);
  currentTimeLabel.textContent = formatTime(time, 1);
  consoleCurrentTime.textContent = formatTime(time, 2);
  flowConsole.dataset.mediaTime = time.toFixed(6);
  updateMarkers(time);
  updatePackets(time);
}

function cancelPlaybackUpdates() {
  if (!playbackHandle) return;
  if (playbackHandleType === "video" && typeof video.cancelVideoFrameCallback === "function") {
    video.cancelVideoFrameCallback(playbackHandle);
  } else {
    cancelAnimationFrame(playbackHandle);
  }
  playbackHandle = 0;
  playbackHandleType = "";
}

function schedulePlaybackUpdate() {
  if (video.paused || video.ended) return;
  if (typeof video.requestVideoFrameCallback === "function") {
    playbackHandleType = "video";
    playbackHandle = video.requestVideoFrameCallback((_now, metadata) => {
      playbackHandle = 0;
      updatePlaybackUI(metadata.mediaTime);
      schedulePlaybackUpdate();
    });
  } else {
    playbackHandleType = "animation";
    playbackHandle = requestAnimationFrame(() => {
      playbackHandle = 0;
      updatePlaybackUI();
      schedulePlaybackUpdate();
    });
  }
}

function setCaseCopy(item, manifest) {
  const media = manifest.media || {};
  caseKicker.textContent = `CASE ${item.number} · ${item.format.toUpperCase()}`;
  caseTitle.textContent = item.title;
  caseSummary.textContent = item.summary;
  mediaSurface.style.setProperty("--media-aspect", `${media.width || 16} / ${media.height || 9}`);
  document.querySelectorAll(".case-button").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.caseId === item.id));
  });
}

function selectCase(caseId) {
  const next = CASES.find((item) => item.id === caseId);
  const nextManifest = manifests.get(caseId);
  if (!next || !nextManifest || next.id === activeCase.id) return;

  const resume = !video.paused;
  cancelPlaybackUpdates();
  video.pause();
  activeCase = next;
  activeManifest = nextManifest;
  video.poster = next.poster;
  video.src = next.video;
  video.load();
  setCaseCopy(next, nextManifest);
  renderPromptPanel(nextManifest);
  if (resume) video.play().catch(() => {});
}

function setupReveal() {
  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  items.forEach((item) => item.classList.add("will-reveal"));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
}

async function init() {
  createCaseButtons();
  setupReveal();
  try {
    await loadManifests();
    activeManifest = manifests.get(activeCase.id);
    setCaseCopy(activeCase, activeManifest);
    renderPromptPanel(activeManifest);
    document.querySelectorAll(".case-button").forEach((button) => { button.disabled = false; });
  } catch (error) {
    loadError.hidden = false;
    loadError.textContent = "The cue manifests could not be loaded. Serve this folder over HTTP (for example, bash serve.sh) instead of opening index.html as a file.";
    console.error(error);
  }
}

video.addEventListener("play", () => {
  playerCard.classList.add("is-playing");
  cancelPlaybackUpdates();
  schedulePlaybackUpdate();
});
video.addEventListener("pause", () => {
  playerCard.classList.remove("is-playing");
  cancelPlaybackUpdates();
  updatePlaybackUI();
});
video.addEventListener("timeupdate", () => updatePlaybackUI());
video.addEventListener("seeking", () => updatePlaybackUI());
video.addEventListener("seeked", () => updatePlaybackUI());
video.addEventListener("loadedmetadata", () => updatePlaybackUI());
video.addEventListener("ended", () => {
  playerCard.classList.remove("is-playing");
  cancelPlaybackUpdates();
  updatePlaybackUI();
});

init();
