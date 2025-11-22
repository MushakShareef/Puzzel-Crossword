// script.js — Crossword with Save/Load by Date (Tamil-aware)

const gridSize = 10;
let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
let questions = [];
let inputModeEnded = false;

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
        input.maxLength = 5;
        input.dataset.row = r;
        input.dataset.col = c;
        input.dataset.qIndex = cellData.qIndex;
        input.addEventListener("input", checkAnswer);
        cell.appendChild(input);

        // start as empty (no user input yet)
        cell.classList.add("grid-empty");
         const q = questions[cellData.qIndex];
          if (q && q.row === r && q.col === c) {
            const numSpan = document.createElement("span");
            numSpan.className = "cell-number";
            numSpan.textContent = cellData.qIndex + 1;
            cell.appendChild(numSpan);
          }
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

  // 1) Handle empty/filled state for every cell
  allInputs.forEach(input => {
    const cell = input.parentElement;
    const val = input.value.trim();

    // Remove old state
    cell.classList.remove("grid-empty", "grid-filled", "grid-correct", "grid-wrong");

    if (val.length === 0) {
      // No text typed → empty colour
      cell.classList.add("grid-empty");
    } else {
      // User typed something → filled colour (before checking correctness)
      cell.classList.add("grid-filled");
    }
  });

  // 2) Before "முடிந்தது", do NOT check correctness
  if (!inputModeEnded) {
    return;
  }

  // 3) After "முடிந்தது" – check right/wrong for each word
  let answerMap = {};
  allInputs.forEach(input => {
    const qIndex = input.dataset.qIndex;
    if (!answerMap[qIndex]) answerMap[qIndex] = [];
    answerMap[qIndex].push(input);
  });

  for (let qIndex in answerMap) {
    const { a } = questions[qIndex];
    const inputs = answerMap[qIndex];

    const typed = inputs.map(input => input.value.trim()).join("");

    const correctLetters = splitTamilLetters(a);
    const userLetters    = splitTamilLetters(typed);

    const isCorrect =
      userLetters.length === correctLetters.length &&
      userLetters.length > 0 &&
      correctLetters.every((ch, i) => ch === userLetters[i]);

    // Remove previous correct/wrong state, then apply
    inputs.forEach(input => {
      const cell = input.parentElement;

      // If user cleared some box later, userLetters length may be different,
      // so no green/red; it will remain just filled/empty from above.
      if (isCorrect) {
        cell.classList.remove("grid-filled", "grid-empty");
        cell.classList.add("grid-correct");
      } else if (userLetters.length === correctLetters.length && userLetters.length > 0) {
        cell.classList.remove("grid-filled", "grid-empty");
        cell.classList.add("grid-wrong");
      }
      // If userLetters shorter than correctLetters, cell stays as grid-filled / grid-empty
    });
  }
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
  if (inputModeEnded) return;

  const qInput   = document.getElementById("admin-question");
  const aInput   = document.getElementById("admin-answer");
  const rowInput = document.getElementById("admin-row");
  const colInput = document.getElementById("admin-col");
  const lenInput = document.getElementById("admin-length");
  const dirInput = document.getElementById("admin-direction");

  const question = qInput.value.trim();
  
  const row      = parseInt(rowInput.value, 10);  // 0–9
  const col      = parseInt(colInput.value, 10);  // 0–9
  const givenLen = parseInt(lenInput.value, 10);
  const dirName  = dirInput.value;

  const rawAnswer = aInput.value;
  const answer = rawAnswer.replace(/\s+/g, "").trim();

  if (!question || !answer || Number.isNaN(row) || Number.isNaN(col) ||
      Number.isNaN(givenLen) || !dirName) {
    alert("அனைத்தையும் நிரப்பவும்.");
    return;
  }

  if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
    alert("Row, Col 0 லிருந்து 9 வரை மட்டுமே இருக்க வேண்டும்.");
    return;
  }



  const letters = splitTamilLetters(answer);
  if (letters.length !== givenLen) {
    alert(`எழுத்துகள் எண்ணிக்கை தவறு. உண்மையானது: ${letters.length}`);
    return;
  }

  if (!placeWordManual(answer, question, row, col, dirName)) {
    alert("இந்த இடத்தில் / திசையில் வைக்க முடியவில்லை. வேறு Row/Col அல்லது direction முயற்சி செய்யவும்.");
    return;
  }

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

function getTodayKey() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function savePuzzle() {
  const key = getActiveDateKey();
  const puzzleData = {
    grid,
    questions,
    date: key
  };
  localStorage.setItem(`murli-puzzle-${key}`, JSON.stringify(puzzleData));
}

function loadPuzzle(dateKey) {
  const data = localStorage.getItem(`murli-puzzle-${dateKey}`);
  if (!data) {
    alert("அந்த தேதிக்கான புதிர் இல்லை.");
    return;
  }
  const { grid: loadedGrid, questions: loadedQs } = JSON.parse(data);
  grid = loadedGrid;
  questions = loadedQs.map(q => ({
    ...q,
    letters: splitTamilLetters(q.a)
  }));
  inputModeEnded = true;
  renderGrid();
  renderQuestions();
  renderQAList();
}

function loadSelectedPuzzle() {
  const date = document.getElementById("date-select").value;
  if (!date) {
    alert("தேதியைத் தேர்ந்தெடுக்கவும்.");
    return;
  }
  loadPuzzle(date);
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
window.onload = () => {
  const todayKey = getTodayKey();
  if (localStorage.getItem(`murli-puzzle-${todayKey}`)) {
    loadPuzzle(todayKey);
    const dateInput = document.getElementById("date-select");
    if (dateInput) {
      dateInput.value = todayKey;
    }
  }
};

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
