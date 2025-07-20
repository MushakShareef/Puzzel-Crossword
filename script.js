// script.js — True Crossword Placement (cross-over + cluster growth)

const gridSize = 10;
let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
let questions = [];
let inputModeEnded = false;

const directions = [
  { name: "➡", dr: 0, dc: 1 },
  { name: "⬇", dr: 1, dc: 0 }
];

function placeFirstWord(word, qText) {
  const row = Math.floor(gridSize / 2);
  const col = Math.floor((gridSize - word.length) / 2);

  for (let i = 0; i < word.length; i++) {
    grid[row][col + i] = { char: word[i], qIndex: questions.length };
  }

  questions.push({ q: qText, a: word, row, col, dir: "➡" });
  return true;
}

function findCrossPoint(word) {
  for (let existing of questions) {
    for (let i = 0; i < existing.a.length; i++) {
      for (let j = 0; j < word.length; j++) {
        if (existing.a[i] === word[j]) {
          const r = existing.row + (existing.dir === "⬇" ? i : 0);
          const c = existing.col + (existing.dir === "➡" ? i : 0);

          const crossDir = existing.dir === "➡" ? directions[1] : directions[0];
          const startR = r - crossDir.dr * j;
          const startC = c - crossDir.dc * j;

          let canPlace = true;
          for (let k = 0; k < word.length; k++) {
            const nr = startR + crossDir.dr * k;
            const nc = startC + crossDir.dc * k;

            if (
              nr < 0 || nr >= gridSize ||
              nc < 0 || nc >= gridSize ||
              (grid[nr][nc] && grid[nr][nc].char !== word[k])
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

function placeWord(word, qText) {
  if (questions.length === 0) return placeFirstWord(word, qText);

  const cross = findCrossPoint(word);
  if (!cross) return false;

  const { r, c, dir } = cross;
  const direction = directions.find(d => d.name === dir);

  for (let i = 0; i < word.length; i++) {
    const nr = r + direction.dr * i;
    const nc = c + direction.dc * i;
    grid[nr][nc] = { char: word[i], qIndex: questions.length };
  }

  questions.push({ q: qText, a: word, row: r, col: c, dir });
  return true;
}

function renderGrid() {
  const container = document.getElementById("crossword-grid");
  container.innerHTML = "";
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      if (grid[r][c]) {
        const input = document.createElement("input");
        input.className = "grid-input";
        input.maxLength = 1;
        input.dataset.row = r;
        input.dataset.col = c;
        input.dataset.qIndex = grid[r][c].qIndex;
        input.placeholder = grid[r][c].qIndex + 1; // ✅ shows question number
        input.addEventListener("input", checkAnswer);        
        cell.appendChild(input);
      } else {
        cell.style.background = "#eee";
        cell.style.pointerEvents = "none";
      }
      container.appendChild(cell);
    }
  }
}

function renderQuestions() {
  const ul = document.getElementById("question-list");
  ul.innerHTML = "";
  questions.forEach((q, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. (${q.dir}) ${q.q}`;
    ul.appendChild(li);
  });
}

function checkAnswer() {
  const inputs = document.querySelectorAll(".grid-input");
  let answerMap = {};
  inputs.forEach(input => {
    const qIndex = input.dataset.qIndex;
    if (!answerMap[qIndex]) answerMap[qIndex] = [];
    answerMap[qIndex].push(input);
  });

  for (let qIndex in answerMap) {
    const { a } = questions[qIndex];
    const inputs = answerMap[qIndex];
    const typed = inputs.map(input => input.value.trim()).join("");
    const isCorrect = typed === a;
    inputs.forEach(input => {
      input.parentElement.classList.remove("grid-correct", "grid-wrong");
      if (typed.length === a.length) {
        input.parentElement.classList.add(isCorrect ? "grid-correct" : "grid-wrong");
      }
    });
  }
}

// Admin Panel Logic
const toggleBtn = document.getElementById("admin-toggle");
const adminPanel = document.getElementById("admin-panel");
toggleBtn.addEventListener("click", () => {
  const code = prompt("Enter Admin Code:");
  if (code === "Trichy@123") {
    adminPanel.style.display = "block";
  } else {
    alert("கடவுச்சொல் தவறானது!");
  }
});

document.getElementById("admin-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (inputModeEnded) return;

  const question = document.getElementById("admin-question").value.trim();
  const answer = document.getElementById("admin-answer").value.trim();

  if (answer.includes(" ")) {
    alert("ஒரே வார்த்தையை மட்டும் உள்ளிடவும்");
    return;
  }

  if (!placeWord(answer, question)) {
    alert("இந்த பதில் பொருத்தவில்லை. வேறொன்று முயற்சி செய்யவும்.");
    return;
  }

  document.getElementById("admin-question").value = "";
  document.getElementById("admin-answer").value = "";
});

document.getElementById("finish-input").addEventListener("click", () => {
  inputModeEnded = true;
  renderGrid();
  renderQuestions();
  adminPanel.style.display = "none";
});
