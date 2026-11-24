
const $ = (id) => document.getElementById(id);

const screens = [
  "home",
  "audio-setup",
  "player-setup",
  "game",
  "winner"
];

let files = {
  soundtrack: null,
  winner: null,
  shot: null
};

let players = [
  { name: "", lives: 4 },
  { name: "", lives: 4 }
];

let setupPlayer = 0;
let winnerTimer = null;
let winnerAudio = null;
let backgroundAudio = null;
let shotAudio = null;
let winnerLocked = false;

let db;

// ---------- DATABASE ----------

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ArcadeDuel", 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore("audio");
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFile(name, blob) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("audio", "readwrite");
    transaction.objectStore("audio").put(blob, name);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function loadFile(name) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("audio", "readonly");
    const request = transaction.objectStore("audio").get(name);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFiles() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("audio", "readwrite");
    transaction.objectStore("audio").clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------- SCREEN CONTROL ----------

function showScreen(id) {
  screens.forEach(screen => {
    $(screen).classList.toggle("hidden", screen !== id);
  });
}

// ---------- AUDIO ----------

function stopAudio(audio) {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function playLoop(blob) {
  stopAudio(backgroundAudio);

  if (!blob) return;

  backgroundAudio = new Audio(URL.createObjectURL(blob));
  backgroundAudio.loop = true;
  backgroundAudio.play().catch(() => {});
}

function playSound(blob) {
  if (!blob) return;

  const audio = new Audio(URL.createObjectURL(blob));
  audio.play().catch(() => {});
}

function playWinnerMusic() {
  if (!files.winner) {
    returnHome();
    return;
  }

  winnerAudio = new Audio(URL.createObjectURL(files.winner));

  winnerAudio.addEventListener("ended", () => {
    returnHome();
  }, { once: true });

  winnerAudio.addEventListener("error", () => {
    returnHome();
  }, { once: true });

  winnerAudio.play().catch(() => {
    // Wait for the user to skip if playback is blocked.
  });
}

// ---------- FILE IMPORT ----------

function getMP3(input) {
  const file = input.files[0];

  if (!file) return null;

  if (
    !file.name.toLowerCase().endsWith(".mp3") ||
    file.type !== "audio/mpeg"
  ) {
    alert("Please select a valid MP3 file.");
    input.value = "";
    return null;
  }

  return file;
}

async function saveAudio() {
  try {
    const soundtrack = getMP3($("soundtrack-file"));
    const winner = getMP3($("winner-file"));
    const shot = getMP3($("shot-file"));

    if (!soundtrack || !winner || !shot) {
      alert("Please select all three MP3 files.");
      return;
    }

    await saveFile("soundtrack", soundtrack);
    await saveFile("winner", winner);
    await saveFile("shot", shot);

    files = { soundtrack, winner, shot };

    alert("Audio saved successfully!");
    showScreen("home");
    playLoop(files.soundtrack);

  } catch (error) {
    console.error(error);
    alert("Could not save audio. Please try again.");
  }
}

async function resetAudio() {
  if (!confirm("Delete all saved soundtracks?")) return;

  stopAudio(backgroundAudio);
  stopAudio(winnerAudio);
  stopAudio(shotAudio);

  await deleteFiles();

  files = {
    soundtrack: null,
    winner: null,
    shot: null
  };

  showScreen("audio-setup");
}

// ---------- PLAYER SETUP ----------

function startSetup() {
  stopAudio(backgroundAudio);
  setupPlayer = 0;
  $("setup-heading").textContent = "PLAYER 1";
  $("player-name").value = "";
  showScreen("player-setup");
}

function nextPlayer() {
  const name = $("player-name").value.trim();

  if (!name) {
    alert("Please enter a player name.");
    return;
  }

  if (setupPlayer === 0) {
    players[0].name = name;
    setupPlayer = 1;
    $("setup-heading").textContent = "PLAYER 2";
    $("player-name").value = "";
    return;
  }

  players[1].name = name;
  startGame();
}

// ---------- GAME ----------

function startGame() {
  players.forEach(player => {
    player.lives = 4;
  });

  winnerLocked = false;

  $("player-one-name").textContent = players[0].name;
  $("player-two-name").textContent = players[1].name;

  updateLives();

  showScreen("game");
  playLoop(files.soundtrack);
}

function updateLives() {
  players.forEach((player, index) => {
    const number = index + 1;

    $(`player-${number}-lives`).textContent = player.lives;

    $(`player-${number}-indicators`).textContent =
      "● ".repeat(player.lives).trim();

    $(`player-${number}-button`).disabled =
      player.lives <= 0;
  });
}

function loseLife(index) {
  if (winnerLocked) return;

  if (players[index].lives <= 0) return;

  playSound(files.shot);

  players[index].lives--;

  updateLives();

  if (players[index].lives === 0) {
    finishMatch(index === 0 ? 1 : 0);
  }
}

// ---------- WINNER SEQUENCE ----------

function finishMatch(winnerIndex) {
  if (winnerLocked) return;

  winnerLocked = true;

  stopAudio(backgroundAudio);

  const winner = players[winnerIndex];

  const color = winnerIndex === 0 ? "red" : "blue";

  showScreen("winner");

  const name = $("winner-name");

  name.textContent = winner.name + "!";
  name.className = "";
  name.classList.add("visible");

  name.style.opacity = "0";

  requestAnimationFrame(() => {
    name.style.opacity = "1";
  });

  $("skip-winner").classList.add("hidden");

  clearTimeout(winnerTimer);

  // Wait exactly 9 seconds before the colour reveal.
  winnerTimer = setTimeout(() => {

    name.classList.add(color);

    // Ambient colour glow.
    $("winner").style.background =
      color === "red"
        ? "radial-gradient(circle, #3a0808 0%, #000 65%)"
        : "radial-gradient(circle, #081a3a 0%, #000 65%)";

    // Fade the ambient glow away.
    setTimeout(() => {
      $("winner").style.background = "#000";

      // Start winner music after the glow fades.
      setTimeout(() => {
        playWinnerMusic();
        $("skip-winner").classList.remove("hidden");
      }, 2200);

    }, 1500);

  }, 9000);
}

// ---------- RETURN HOME ----------

function returnHome() {
  clearTimeout(winnerTimer);

  stopAudio(winnerAudio);
  stopAudio(backgroundAudio);

  winnerAudio = null;
  backgroundAudio = null;

  $("winner").style.background = "#000";
  $("winner-name").className = "";
  $("winner-name").style.opacity = "0";

  $("skip-winner").classList.add("hidden");

  winnerLocked = false;

  showScreen("home");
  playLoop(files.soundtrack);
}

// ---------- BUTTONS ----------

$("new-game").addEventListener("click", startSetup);

$("reset-audio").addEventListener("click", resetAudio);

$("save-audio").addEventListener("click", saveAudio);

$("next-player").addEventListener("click", nextPlayer);

$("player-name").addEventListener("keydown", event => {
  if (event.key === "Enter") nextPlayer();
});

$("player-one-button").addEventListener("click", () => {
  loseLife(0);
});

$("player-two-button").addEventListener("click", () => {
  loseLife(1);
});

$("skip-winner").addEventListener("click", returnHome);

// ---------- STARTUP ----------

async function initialize() {
  try {
    db = await openDatabase();

    files.soundtrack = await loadFile("soundtrack");
    files.winner = await loadFile("winner");
    files.shot = await loadFile("shot");

    if (
      files.soundtrack &&
      files.winner &&
      files.shot
    ) {
      showScreen("home");
    } else {
      showScreen("audio-setup");
    }

  } catch (error) {
    console.error(error);
    alert("Your browser could not initialize Arcade Duel storage.");
  }
}

initialize();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error("Service worker registration failed:", error));
  });
}
