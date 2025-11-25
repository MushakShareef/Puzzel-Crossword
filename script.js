// script.js — Crossword with Save/Load by Date (Tamil-aware)


// 🔗 BK Spiritual backend base URL (Render)
const BACKEND_URL = "https://bk-spiritual-backend.onrender.com";


async function savePuzzleToBackend(key, puzzleData) {
  // Debug – function call நடந்ததா என்பதை பார்க்க
  alert("🔔 savePuzzleToBackend called! Trying to send to backend...");

  try {
    const res = await fetch(`${BACKEND_URL}/api/crossword/today`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(puzzleData),
    });

    if (!res.ok) {
      let msg = `Backend save failed: ${res.status}`;
      try {
        const err = await res.json();
        if (err && err.message) msg = err.message;
      } catch (e) {
        // ignore JSON parse error
      }
      console.error("❌", msg);
      alert("❌ Backend save failed: " + msg);
      return false;
    }

    console.log("✅ Crossword saved to backend for", key);
    alert("✅ Crossword saved to backend!");
    return true;
  } catch (err) {
    console.error("❌ Error calling backend:", err);
    alert("❌ Error calling backend (check console)");
    return false;
  }
}



async function loadPuzzleFromBackend(dateKey) {
  alert("📥 Trying to load from BACKEND...");  // 👈 Debug alert

  try {
    const key = dateKey || getTodayKey();
    const res = await fetch(`${BACKEND_URL}/api/crossword/today?date=${encodeURIComponent(key)}`);
    if (!res.ok) {
      console.warn("⚠️ No puzzle found on backend for date:", dateKey);
      return null;
    }
    const data = await res.json();
    console.log("📥 Loaded puzzle from backend:", data);
    return data;
  } catch (err) {
    console.error("❌ Backend load error:", err);
    return null;
  }
}


const gridSize = 10;
let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
let questions = [];
let inputModeEnded = false;

let currentPuzzleDate = null;
let lastEvaluation = null; // மதிப்பெண் + per-question result சேமிக்க



const directions = [
  { name: "➡", dr: 0, dc: 1 },
  { name: "⬇", dr: 1, dc: 0 }
];

function boxNoToRowCol(boxNo) {
  const index = boxNo - 1;
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;
  return { row, col };
}


// Split a Tamil word into visual letters (grapheme clusters)
function splitTamilLetters(str) {
  if (window.Intl && Intl.Segmenter) {
    const seg = new Intl.Segmenter("ta", { granularity: "grapheme" });
    return Array.from(seg.segment(str), s => s.segment);
  }
  return [...str]; // fallback
}

// Place the first word in the centre
function placeFirstWord(word, qText) {
  const letters = splitTamilLetters(word);
  const row = Math.floor(gridSize / 2);
  const col = Math.floor((gridSize - letters.length) / 2);

  for (let i = 0; i < letters.length; i++) {
    grid[row][col + i] = { char: letters[i], qIndex: questions.length };
  }

  questions.push({
    q: qText,
    a: word,
    letters: letters,
    row,
    col,
    dir: "➡"
  });
  return true;
}

// Find a crossing point for a new word
function findCrossPoint(word) {
  const newLetters = splitTamilLetters(word);

  for (let existing of questions) {
    const existingLetters = existing.letters || splitTamilLetters(existing.a);

    for (let i = 0; i < existingLetters.length; i++) {
      for (let j = 0; j < newLetters.length; j++) {
        if (existingLetters[i] === newLetters[j]) {
          const r = existing.row + (existing.dir === "⬇" ? i : 0);
          const c = existing.col + (existing.dir === "➡" ? i : 0);

          const crossDir =
            existing.dir === "➡" ? directions[1] : directions[0];
          const startR = r - crossDir.dr * j;
          const startC = c - crossDir.dc * j;

          let canPlace = true;
          for (let k = 0; k < newLetters.length; k++) {
            const nr = startR + crossDir.dr * k;
            const nc = startC + crossDir.dc * k;

            if (
              nr < 0 || nr >= gridSize ||
              nc < 0 || nc >= gridSize ||
              (grid[nr][nc] && grid[nr][nc].char !== newLetters[k])
            ) {
              canPlace = false;
              break;
            }
          }

          if (canPlace) {
            return { r: startR, c: startC, dir: crossDir.name };
          }
        }
      }
    }
  }
  return null;
}

// Place any word (after the first)
function placeWord(word, qText,direction) {
  if (questions.length === 0) {
    return placeFirstWord(word, qText);
  }

  const letters = splitTamilLetters(word);
  const cross = findCrossPoint(word);
  if (!cross) return false;

  const { r, c, dir } = cross;
  const dirObj = directions.find(d => d.name === dir);

  for (let i = 0; i < letters.length; i++) {
    const nr = r + dirObj.dr * i;
    const nc = c + dirObj.dc * i;
    grid[nr][nc] = { char: letters[i], qIndex: questions.length };
  }

  questions.push({
    q: qText,
    a: word,
    letters: letters,
    row: r,
    col: c,
    dir
  });
  return true;
}


function canPlaceManual(word, row, col, dirName) {
  const letters = splitTamilLetters(word);

  // row, col are already 0-based
  if (dirName === "➡") {
    if (col + letters.length > gridSize) return false;
  } else if (dirName === "⬇") {
    if (row + letters.length > gridSize) return false;
  }

  for (let i = 0; i < letters.length; i++) {
    const r = row + (dirName === "⬇" ? i : 0);
    const c = col + (dirName === "➡" ? i : 0);

    const cell = grid[r][c];
    if (cell && cell.char !== letters[i]) {
      return false;
    }
  }
  return true;
}

function placeWordManual(word, qText, row, col, dirName) {
  const letters = splitTamilLetters(word);

  if (!canPlaceManual(word, row, col, dirName)) {
    return false;
  }

  const qIndex = questions.length;

  for (let i = 0; i < letters.length; i++) {
    const r = row + (dirName === "⬇" ? i : 0);
    const c = col + (dirName === "➡" ? i : 0);
    grid[r][c] = { char: letters[i], qIndex };
  }

  questions.push({
    q: qText,
    a: word,
    letters,
    row,   // already 0-based
    col,   // already 0-based
    dir: dirName
  });

  return true;
}


// Render crossword grid
function renderGrid() {
  const container = document.getElementById("crossword-grid");
  container.innerHTML = "";
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      if (grid[r][c]) {
        const cellData = grid[r][c];
        const input = document.createElement("input");
        input.className = "grid-input";
        input.maxLength = 3;
        input.dataset.row = r;
        input.dataset.col = c;
        input.dataset.qIndex = cellData.qIndex;
        input.addEventListener("input", checkAnswer);
        cell.appendChild(input);

        // start as empty (no user input yet)
        cell.classList.add("grid-empty");
         const q = questions[cellData.qIndex];
        questions.forEach((q, qi) => {
        if (q.row === r && q.col === c) {
          const tag = document.createElement("div");
          tag.className = "cell-tag";
          tag.textContent = `${qi + 1} ${q.dir}`;
          cell.appendChild(tag);
        }
       });
        // (If you already added clue number span, keep that code here too.)
      } else {
        cell.style.background = "#eee";
        cell.style.pointerEvents = "none";
      }
   

      container.appendChild(cell);
    }
  }
}

// Render questions list (clues)
function renderQuestions() {
  const ul = document.getElementById("question-list");
  ul.innerHTML = "";
  questions.forEach((q, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. (${q.dir}) ${q.q}`;
    ul.appendChild(li);
  });
}

// Check answers for all words
function checkAnswer() {
  const allInputs = document.querySelectorAll(".grid-input");

  // 1) எல்லா cellக்களுக்கும் basic empty/filled state set பண்ணுறது
  allInputs.forEach(input => {
    const cell = input.parentElement;
    const val = input.value.trim();

    cell.classList.remove(
      "grid-empty",
      "grid-filled",
      "grid-correct",
      "grid-wrong"
    );

    if (val.length === 0) {
      cell.classList.add("grid-empty");
    } else {
      cell.classList.add("grid-filled");
    }
  });

  // 2) Admin "முடிந்தது" அழுத்தல முன்னாடி நிறம் check பண்ணவேண்டாம்
  if (!inputModeEnded) {
    lastEvaluation = null; // இன்னும் final evaluation இல்லை
    return;
  }

  // 3) இப்போ தான் முழு crosswordக்கு evaluation செய்கிறோம்
  const evalResult = evaluatePuzzle(); // கீழே define பண்ணிருக்கோம்
  lastEvaluation = evalResult;

  const { cellStatus } = evalResult;

  // 4) ஒவ்வொரு cellக்கும் final correct/wrong colour apply பண்ணுறது
  allInputs.forEach(input => {
    const cell = input.parentElement;
    const r = Number(input.dataset.row);
    const c = Number(input.dataset.col);
    const key = `${r},${c}`;

    const status = cellStatus[key];
    if (!status) return;

    cell.classList.remove("grid-correct", "grid-wrong");

    if (status.wrongCount > 0) {
      // எந்த ஒரு word ஆனாலும் இந்த cell wrong ஆனால் → Red
      cell.classList.remove("grid-empty", "grid-filled");
      cell.classList.add("grid-wrong");
    } else if (status.correctCount > 0) {
      // எல்லா words–மும் இந்த cell–ஐச் சரியா வைத்திருந்தா → Green
      cell.classList.remove("grid-empty", "grid-filled");
      cell.classList.add("grid-correct");
    }
    // இல்லனா அந்த cell grid-filled / grid-empty நிறத்திலேயே இருக்கும்
  });
}





function evaluatePuzzle() {
  const allInputs = document.querySelectorAll(".grid-input");

  // row,col -> input element map
  const cellInputMap = {};
  allInputs.forEach(input => {
    const r = Number(input.dataset.row);
    const c = Number(input.dataset.col);
    const key = `${r},${c}`;
    cellInputMap[key] = input;
  });

  const perQuestion = [];
  const cellStatus = {}; // key -> { filled, correctCount, wrongCount }

  function ensureCellStatus(key) {
    if (!cellStatus[key]) {
      cellStatus[key] = { filled: false, correctCount: 0, wrongCount: 0 };
    }
    return cellStatus[key];
  }

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const letters = q.letters || splitTamilLetters(q.a); // correct letters

    let typedCells = [];
    let allCellsExist = true;

    for (let i = 0; i < letters.length; i++) {
      const r = q.row + (q.dir === "⬇" ? i : 0);
      const c = q.col + (q.dir === "➡" ? i : 0);
      const key = `${r},${c}`;
      const input = cellInputMap[key];

      if (!input) {
        allCellsExist = false;
        break;
      }

      const val = input.value.trim();
      typedCells.push(val);

      const st = ensureCellStatus(key);
      if (val.length > 0) {
        st.filled = true;
      }
    }

    let isCorrect = false;

    if (allCellsExist) {
      const typedWordRaw = typedCells.join("");
      const userLetters = splitTamilLetters(typedWordRaw);

      const correctLetters = letters;
      const sameLength =
        userLetters.length === correctLetters.length && userLetters.length > 0;
      const allMatch =
        sameLength &&
        correctLetters.every((ch, idx) => userLetters[idx] === ch);

      isCorrect = sameLength && allMatch;
    }

    perQuestion[qi] = isCorrect;

    // இந்த question சேர்ந்த cellகளுக்கு correct/wrong counter update
    for (let i = 0; i < letters.length; i++) {
      const r = q.row + (q.dir === "⬇" ? i : 0);
      const c = q.col + (q.dir === "➡" ? i : 0);
      const key = `${r},${c}`;

      const st = ensureCellStatus(key);
      const input = cellInputMap[key];
      const val = input ? input.value.trim() : "";

      if (!val) continue; // காலியாக இருந்தா correct/wrong எதுவும் கூட்ட வேண்டாம்

      if (isCorrect) {
        st.correctCount += 1;
      } else {
        // முழு length type பண்ணியிருக்கேனா? (சில logic softஆ ignore செய்யலாம்)
        st.wrongCount += 1;
      }
    }
  }



  function gradeAndDownload() {
  // மாணவர் "மதிப்பெண் + படம்" விரும்புறப்போ இதை call பண்ணலாம்
  inputModeEnded = true;   // இப்போ இருந்து correct/wrong check செய்யலாம்
  checkAnswer();           // lastEvaluation set ஆகும்

  if (!lastEvaluation) {
    alert("முதலில் பதில்களை நிரப்புங்கள்.");
    return;
  }

  downloadResultImage();
}

function downloadResultImage() {
  if (!lastEvaluation) {
    alert("முதலில் பதில்களை நிரப்பி, சரிபார்க்கவும்.");
    return;
  }

  const dateKey = getActiveDateKey();
  const { correctCount, totalQuestions } = lastEvaluation;

  const cellSize = 60;
  const size = gridSize;       // 10 x 10
  const marginTop = 120;

  const canvas = document.createElement("canvas");
  canvas.width = cellSize * size;
  canvas.height = marginTop + cellSize * size;

  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title + date + score
  ctx.fillStyle = "#111827";
  ctx.font = "24px Noto Sans Tamil, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("BK Spiritual Crossword", 10, 10);

  ctx.font = "18px Noto Sans Tamil, sans-serif";
  ctx.fillText(`தேதி: ${dateKey}`, 10, 42);
  ctx.fillText(`மதிப்பெண்: ${correctCount} / ${totalQuestions}`, 10, 70);

  // row,col -> typed letter
  const allInputs = document.querySelectorAll(".grid-input");
  const typedMap = {};
  const cellClassMap = {};

  allInputs.forEach(input => {
    const r = Number(input.dataset.row);
    const c = Number(input.dataset.col);
    const key = `${r},${c}`;
    typedMap[key] = input.value.trim();

    const cell = input.parentElement;
    cellClassMap[key] = {
      correct: cell.classList.contains("grid-correct"),
      wrong: cell.classList.contains("grid-wrong"),
      filled: cell.classList.contains("grid-filled"),
      empty: cell.classList.contains("grid-empty")
    };
  });

  // Draw grid
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const x = c * cellSize;
      const y = marginTop + r * cellSize;

      if (!grid[r][c]) {
        // blocked cell
        ctx.fillStyle = "#003366"; // Dark blue
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = "#000000";
        ctx.strokeRect(x, y, cellSize, cellSize);
        continue;
      }

      const key = `${r},${c}`;
      const info = cellClassMap[key] || {};
      let bg = "#FFF9E5"; // default empty colour

      if (info.correct) bg = "#7CFC00";     // green
      else if (info.wrong) bg = "#FF6961"; // red
      else if (info.filled) bg = "#E6F2FF"; // filled blue

      ctx.fillStyle = bg;
      ctx.fillRect(x, y, cellSize, cellSize);

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);

      const txt = typedMap[key] || "";
      if (txt) {
        ctx.fillStyle = "#000000";
        ctx.font = "32px Noto Sans Tamil, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, x + cellSize / 2, y + cellSize / 2);
      }
    }
  }

  // Download as PNG
  const dataURL = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = `crossword-${dateKey}-score-${correctCount}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


  const correctCount = perQuestion.filter(Boolean).length;

  return {
    totalQuestions: questions.length,
    correctCount,
    perQuestion,
    cellStatus
  };
}





// -------- Admin Panel Logic --------

const toggleBtn = document.getElementById("admin-toggle");
const adminPanel = document.getElementById("admin-panel");

toggleBtn.addEventListener("click", () => {
  const code = prompt("Enter Admin Code:");
  if (code === "Trichy@123") {
    const dateKey = getActiveDateKey();
    const infoEl = document.getElementById("admin-date-info");
    if (infoEl) {
      infoEl.textContent =
        `இந்த கேள்விகள் மற்றும் பதில்கள் ${dateKey} தேதிக்கான புதிராக சேமிக்கப்படும்.`;
    }
    adminPanel.style.display = "block";
    renderQAList();
  } else {
    alert("கடவுச்சொல் தவறானது!");
  }
});

// Admin: add new question/answer
document.getElementById("admin-form").addEventListener("submit", (e) => {
  e.preventDefault();
  // if (inputModeEnded) return; 

  const qInput   = document.getElementById("admin-question");
  const aInput   = document.getElementById("admin-answer");
  const rowInput = document.getElementById("admin-row");
  const colInput = document.getElementById("admin-col");
  const lenInput = document.getElementById("admin-length");
  const dirInput = document.getElementById("admin-direction");

  const question = qInput.value.trim();
  

  // mobile keyboards sometimes insert extra spaces – strip them all:
  const rawAnswer = aInput.value;
  const answer = rawAnswer.replace(/\s+/g, "").trim();

  const row      = Number(rowInput.value);
  const col      = Number(colInput.value);
  const givenLen = Number(lenInput.value);
  const dirName  = dirInput.value;

  // Basic validation
  if (!question || !answer || Number.isNaN(row) || Number.isNaN(col) ||
      Number.isNaN(givenLen) || !dirName) {
    alert("கேள்வி, பதில், Row, Col, Length, Direction எல்லாவற்றையும் நிரப்பவும்.");
    return;
  }

  if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
    alert("Row மற்றும் Col 0 லிருந்து 9 வரை மட்டுமே இருக்க வேண்டும்.");
    return;
  }

  const letters = splitTamilLetters(answer);
  if (letters.length !== givenLen) {
    alert(`எழுத்துகள் எண்ணிக்கை தவறாக உள்ளது. உண்மையானது: ${letters.length}`);
    return;
  }

  if (!placeWordManual(answer, question, row, col, dirName)) {
    alert("இந்த இடத்தில் / திசையில் வைக்க முடியவில்லை. வேறு Row/Col அல்லது திசை முயற்சி செய்யவும்.");
    return;
  }

  // clear for next question
  qInput.value = "";
  aInput.value = "";
  rowInput.value = "";
  colInput.value = "";
  lenInput.value = "";

  renderGrid();
  renderQuestions();
  if (typeof renderQAList === "function") {
    renderQAList();
  }
});




// -------- Date Helpers & Save/Load --------

function getActiveDateKey() {
  const dateInput = document.getElementById("date-select");
  if (dateInput && dateInput.value) {
    return dateInput.value; // YYYY-MM-DD chosen by user
  }
  const today = new Date();
  return today.toISOString().split("T")[0];
}

// நாள் key கண்டுபிடிக்க same function
function getTodayKey() {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
}

// 1) localStorageக்கான helper (இங்க தான் actual save நடக்கும்)
function savePuzzleLocal(key, puzzleData) {
  localStorage.setItem(`murli-puzzle-${key}`, JSON.stringify(puzzleData));
}

async function savePuzzle() {
  const key = getActiveDateKey();
  
  const puzzleData = {
    grid,
    questions,
    date: key
  };

  // 1) localStorageல சேமிக்கிறது (இது தான் இப்போ use ஆகுது)
  savePuzzleLocal(key, puzzleData);

  // 2) backend stub க்கு call – இப்போ log மட்டும்
  await savePuzzleToBackend(key, puzzleData);
}


// 1) localStorageல இருந்து data எடுக்கும் helper
function loadPuzzleLocal(dateKey) {
  const data = localStorage.getItem(`murli-puzzle-${dateKey}`);
  if (!data) return null;
  return JSON.parse(data);
}

// 2) main loadPuzzle – நாளைக்கு backend இருந்து load பண்ணினாலும் இதே பயன்படுத்துவோம்
async function loadPuzzle(dateKey) {
  // 1) முதலில் backend-லிருந்து முயற்சி
  const data = await loadPuzzleFromBackend(dateKey);

  
  // 🗓 Puzzle Date UI display
  if (data && data.date) {
    const dateEl = document.getElementById("puzzle-date");
    if (dateEl) {
      dateEl.textContent = `🗓 புதிர் தேதி: ${data.date}`;
    }
  }


  if (!data) {
    alert("❗ Backend-ல் இந்த தேதிக்கான புதிர் கிடைக்கவில்லை.");
    return;
  }

  const { grid: loadedGrid, questions: loadedQs, date } = data;

  grid = loadedGrid;
  questions = loadedQs;
  // நீங்கள் முன்பு letters split பண்ணி வைத்திருந்தால், இங்கே map பண்ணலாம்:
  // questions = loadedQs.map(q => ({ ...q, letters: splitTamilLetters(q.a) }));

  inputModeEnded = true;
  console.log("✅ Puzzle loaded for date:", date || dateKey);
  renderGrid();
  renderQuestions();
}



async function loadSelectedPuzzle() {
  const date = document.getElementById("date-select").value;
  const key = date || getTodayKey(); // பயனர் தேர்வு செய்யாவிட்டால் இன்று

  await loadPuzzle(key);
}


// Finish input and save puzzle for that date
document.getElementById("finish-input").addEventListener("click", () => {
  inputModeEnded = true;
  renderGrid();
  renderQuestions();
  savePuzzle();
  alert("இந்த தேதிக்கான புதிர் சேமிக்கப்பட்டது!");
  adminPanel.style.display = "none";
});

// Auto-load today's puzzle if exists
window.onload = async () => {
  const todayKey = getTodayKey();
  await loadPuzzle(todayKey);  // ✅ direct backend load
};



function gradeAndDownload() {
  inputModeEnded = true;   // முதலில் முடிந்தது என lock செய்கிறோம்
  checkAnswer();           // இதனால் lastEvaluation update ஆகும்

  if (!lastEvaluation) {
    alert("முதலில் பதில்களை நிரப்புங்கள்.");
    return;
  }

  downloadResultImage();   // படம் உருவாக்கி download செய்வோம்
}




function downloadResultImage() {
  if (!lastEvaluation) {
    alert("முதலில் பதில்களை நிரப்பி, சரிபார்க்கவும்.");
    return;
  }

  const dateKey = getActiveDateKey();
  const { correctCount, totalQuestions } = lastEvaluation;

  const cellSize = 60;
  const marginTop = 120;

  const canvas = document.createElement("canvas");
  canvas.width = cellSize * gridSize;
  canvas.height = marginTop + cellSize * gridSize;

  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000";
  ctx.font = "24px Noto Sans Tamil, sans-serif";
  ctx.fillText("BK Spiritual Crossword", 10, 30);

  ctx.font = "18px Noto Sans Tamil, sans-serif";
  ctx.fillText(`தேதி: ${dateKey}`, 10, 65);
  ctx.fillText(`மதிப்பெண்: ${correctCount} / ${totalQuestions}`, 10, 95);

  const allInputs = document.querySelectorAll(".grid-input");
  const typedMap = {};
  const cellClassMap = {};

  allInputs.forEach(input => {
    const r = Number(input.dataset.row);
    const c = Number(input.dataset.col);
    const key = `${r},${c}`;
    typedMap[key] = input.value.trim();

    const cell = input.parentElement;
    cellClassMap[key] = {
      correct: cell.classList.contains("grid-correct"),
      wrong: cell.classList.contains("grid-wrong"),
      filled: cell.classList.contains("grid-filled"),
      empty: cell.classList.contains("grid-empty")
    };
  });

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const x = c * cellSize;
      const y = marginTop + r * cellSize;
      const key = `${r},${c}`;

      if (!grid[r][c]) {
        ctx.fillStyle = "#003366";
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeRect(x, y, cellSize, cellSize);
        continue;
      }

      // cell colours
      let bg = "#FFF9E5"; // default empty
      const info = cellClassMap[key] || {};
      if (info.correct) bg = "#7CFC00";
      else if (info.wrong) bg = "#FF6961";
      else if (info.filled) bg = "#E6F2FF";

      ctx.fillStyle = bg;
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeRect(x, y, cellSize, cellSize);

      const txt = typedMap[key] || "";
      if (txt) {
        ctx.fillStyle = "#000";
        ctx.font = "32px Noto Sans Tamil, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(txt, x + cellSize / 2, y + cellSize / 2);
      }
    }
  }

  // Download as PNG
  const dataURL = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = `crossword-${dateKey}-score-${correctCount}.png`;
  a.click();
}


// -------- Admin Q&A List (Edit / Delete) --------

// Rebuild grid from questions after editing/deleting
function rebuildGridFromQuestions() {
  grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
  const oldQuestions = questions.slice();
  questions = [];
  oldQuestions.forEach(q => {
  placeWordManual(q.a, q.q, q.row, q.col, q.dir);
  });
}

// Show list of Q & A in Admin panel
function renderQAList() {
  const qaDiv = document.getElementById("qa-list");
  if (!qaDiv) return;
  qaDiv.innerHTML = "";

  questions.forEach((q, i) => {
    const div = document.createElement("div");
    div.style.marginBottom = "8px";

    div.innerHTML = `
      <b>Q${i + 1}:</b> ${q.q} <br>
      <b>Answer:</b> ${q.a}
      <button onclick="editQA(${i})">Edit</button>
      <button onclick="deleteQA(${i})">Delete</button>
      <hr>
    `;
    qaDiv.appendChild(div);
  });
}

function deleteQA(index) {
  if (confirm("Are you sure to delete this?")) {
    questions.splice(index, 1);
    rebuildGridFromQuestions();
    renderGrid();
    renderQuestions();
    renderQAList();
  }
}

function editQA(index) {
  const newQ = prompt("Edit Question:", questions[index].q);
  const newA = prompt("Edit Answer:", questions[index].a);

  if (newQ && newA) {
    questions[index].q = newQ.trim();
    questions[index].a = newA.trim();
    rebuildGridFromQuestions();
    renderGrid();
    renderQuestions();
    renderQAList();
  }
}
