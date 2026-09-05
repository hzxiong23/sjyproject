"use strict";

const CASES = [
  {
    id: "elderly-speaker",
    number: "01",
    format: "Portrait source",
    title: "The reveal",
    short: "Shock · emphasis · resolve",
    summary: "Surprise turns to delight as an emphatic two-hand gesture resolves into a composed close.",
    video: "assets/videos/elderly-speaker.mp4",
    poster: "assets/posters/elderly-speaker.jpg",
    manifest: "assets/manifests/elderly-speaker.json"
  },
  {
    id: "home-kitchen",
    number: "02",
    format: "Landscape source",
    title: "Kitchen notes",
    short: "Surprise · open palm · settle",
    summary: "A kitchen presenter moves from a held stance to an open-palm explanation, then returns to neutral.",
    video: "assets/videos/home-kitchen.mp4",
    poster: "assets/posters/home-kitchen.jpg",
    manifest: "assets/manifests/home-kitchen.json"
  },
  {
    id: "pottery-studio",
    number: "03",
    format: "Landscape source",
    title: "Craft in motion",
    short: "Welcome · point · return",
    summary: "A warm studio introduction shifts into focused direction and closes with both hands grounded on the table.",
    video: "assets/videos/pottery-studio.mp4",
    poster: "assets/posters/pottery-studio.jpg",
    manifest: "assets/manifests/pottery-studio.json"
  },
  {
    id: "video-call",
    number: "04",
    format: "Landscape source",
    title: "Plan, revised",
    short: "Smile · explain · refocus",
    summary: "A home video call progresses from confident update to open-handed realization and a focused final plan.",
    video: "assets/videos/video-call.mp4",
    poster: "assets/posters/video-call.jpg",
    manifest: "assets/manifests/video-call.json"
  }
];

const TRACKS = {
  FACE: { label: "Face", color: "var(--face)" },
  BODY: { label: "Body", color: "var(--body)" },
  MUSIC: { label: "Music", color: "var(--music)" },
  SPEECH: { label: "Speech", color: "var(--speech)" }
};

const video = document.querySelector("#demo-video");
const caseList = document.querySelector("#case-list");
const caseKicker = document.querySelector("#case-kicker");
const caseTitle = document.querySelector("#case-title");
const caseSummary = document.querySelector("#case-summary");
const timeline = document.querySelector("#timeline");
const cueReadout = document.querySelector("#cue-readout");
const currentTimeLabel = document.querySelector("#current-time");
const playerCard = document.querySelector(".player-card");
const loadError = document.querySelector("#load-error");

const manifests = new Map();
let activeCase = CASES[0];
let activeManifest = null;
let playhead = null;
let animationFrame = 0;
let lastCueSignature = "";

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = (safe - minutes * 60).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${remainder}`;
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
  const tasks = CASES.map(async (item) => {
    const response = await fetch(item.manifest);
    if (!response.ok) throw new Error(`Could not load ${item.manifest}`);
    manifests.set(item.id, await response.json());
  });
  await Promise.all(tasks);
}

function segmentStatus(event, time) {
  if (time >= event.start && time < event.end) return "is-active";
  if (time >= event.end) return "is-past";
  return "";
}

function renderTimeline(manifest) {
  timeline.replaceChildren();
  const duration = manifest.duration || 15;
  Object.entries(TRACKS).forEach(([track, meta]) => {
    const row = document.createElement("div");
    row.className = "timeline-row";
    row.style.setProperty("--track-color", meta.color);
    const label = document.createElement("div");
    label.className = "timeline-label";
    label.innerHTML = `<i></i><span>${track}</span>`;
    const rail = document.createElement("div");
    rail.className = "timeline-rail";
    rail.setAttribute("role", "group");
    rail.setAttribute("aria-label", `${meta.label} cue intervals`);
    rail.addEventListener("click", (event) => {
      if (event.target.closest(".timeline-segment")) return;
      const bounds = rail.getBoundingClientRect();
      video.currentTime = Math.max(0, Math.min(duration, ((event.clientX - bounds.left) / bounds.width) * duration));
      updatePlaybackUI();
    });

    manifest.events.filter((event) => event.track === track).forEach((event) => {
      const segment = document.createElement("button");
      segment.type = "button";
      segment.className = `timeline-segment ${segmentStatus(event, video.currentTime)}`;
      segment.style.setProperty("--start", `${(event.start / duration) * 100}%`);
      segment.style.setProperty("--width", `${((event.end - event.start) / duration) * 100}%`);
      segment.dataset.start = event.start;
      segment.dataset.end = event.end;
      segment.title = `${meta.label} ${formatTime(event.start)}–${formatTime(event.end)}: ${stripPrefix(event.text)}`;
      segment.setAttribute("aria-label", segment.title);
      segment.addEventListener("click", () => {
        video.currentTime = event.start;
        updatePlaybackUI();
      });
      rail.append(segment);
    });
    row.append(label, rail);
    timeline.append(row);
  });

  playhead = document.createElement("span");
  playhead.className = "timeline-playhead";
  timeline.append(playhead);
  renderCueReadout(0);
  updatePlaybackUI();
}

function renderCueReadout(time) {
  if (!activeManifest) return;
  const activeEvents = Object.keys(TRACKS).map((track) =>
    activeManifest.events.find((event) => event.track === track && time >= event.start && time < event.end)
  );
  const signature = `${activeCase.id}:${activeEvents.map((event) => event?.id || "gap").join("|")}`;
  if (signature === lastCueSignature) return;
  lastCueSignature = signature;
  cueReadout.replaceChildren();
  Object.entries(TRACKS).forEach(([track, meta], index) => {
    const current = activeEvents[index];
    const card = document.createElement("article");
    card.className = "cue-card";
    card.style.setProperty("--track-color", meta.color);
    const timing = current ? `${formatTime(current.start)}–${formatTime(current.end)}` : "between cues";
    const copy = current ? stripPrefix(current.text) : "No authored interval at this instant; the scene carries its current context forward.";
    const header = document.createElement("header");
    const trackName = document.createElement("span");
    const cueTiming = document.createElement("span");
    const body = document.createElement("p");
    trackName.textContent = track;
    cueTiming.textContent = timing;
    body.textContent = copy;
    header.append(trackName, cueTiming);
    card.append(header, body);
    cueReadout.append(card);
  });
}

function updatePlaybackUI() {
  if (!activeManifest) return;
  const duration = activeManifest.duration || video.duration || 15;
  const time = Math.min(video.currentTime || 0, duration);
  currentTimeLabel.textContent = formatTime(time);
  if (playhead) {
    const timelineWidth = timeline.querySelector(".timeline-rail")?.clientWidth || 0;
    playhead.style.setProperty("--playhead-x", `${(time / duration) * timelineWidth}px`);
  }
  timeline.querySelectorAll(".timeline-segment").forEach((segment) => {
    const start = Number(segment.dataset.start);
    const end = Number(segment.dataset.end);
    segment.classList.toggle("is-active", time >= start && time < end);
    segment.classList.toggle("is-past", time >= end);
  });
  renderCueReadout(time);
}

function animatePlayback() {
  updatePlaybackUI();
  if (!video.paused && !video.ended) animationFrame = requestAnimationFrame(animatePlayback);
}

function selectCase(caseId) {
  const next = CASES.find((item) => item.id === caseId);
  if (!next || next.id === activeCase.id) return;
  const resume = !video.paused;
  cancelAnimationFrame(animationFrame);
  video.pause();
  activeCase = next;
  activeManifest = manifests.get(next.id);
  lastCueSignature = "";
  video.poster = next.poster;
  video.src = next.video;
  video.load();
  caseKicker.textContent = `CASE ${next.number} · ${next.format.toUpperCase()}`;
  caseTitle.textContent = next.title;
  caseSummary.textContent = next.summary;
  document.querySelectorAll(".case-button").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.caseId === next.id));
  });
  renderTimeline(activeManifest);
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
    renderTimeline(activeManifest);
  } catch (error) {
    loadError.hidden = false;
    loadError.textContent = "The cue manifests could not be loaded. Serve this folder over HTTP (for example, bash serve.sh) instead of opening index.html as a file.";
    console.error(error);
  }
}

video.addEventListener("play", () => {
  playerCard.classList.add("is-playing");
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animatePlayback);
});
video.addEventListener("pause", () => {
  playerCard.classList.remove("is-playing");
  cancelAnimationFrame(animationFrame);
  updatePlaybackUI();
});
video.addEventListener("seeked", updatePlaybackUI);
video.addEventListener("loadedmetadata", updatePlaybackUI);
video.addEventListener("ended", () => {
  playerCard.classList.remove("is-playing");
  cancelAnimationFrame(animationFrame);
  updatePlaybackUI();
});
window.addEventListener("resize", updatePlaybackUI, { passive: true });

init();
