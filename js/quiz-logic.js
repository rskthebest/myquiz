import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCIWNbx_nXGyC2NtjEpyhQIox5Nk57oBEc",
    authDomain: "newapp2304-4b1ad.firebaseapp.com",
    projectId: "newapp2304-4b1ad",
    storageBucket: "newapp2304-4b1ad.firebasestorage.app",
    messagingSenderId: "965462333439",
    appId: "1:965462333439:web:40d8c498e4bbff30ff39ca"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Global State ---
let currentUser = null;
let currentQIndex = 0;
let userAnswers = [];
let flaggedStatus = [];
let filteredIndices = []; 
let isReviewMode = false; 
let totalTime = 25 * 60; 
let timerInterval;

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
    currentUser = user;
});

// Helper to get formatted time string instantly
function getTimeString() {
    let m = Math.floor(totalTime / 60);
    let s = totalTime % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// --- Core Quiz Logic ---

window.startQuiz = function() {
    if (!window.questions) return;
    userAnswers = new Array(window.questions.length).fill(null);
    flaggedStatus = new Array(window.questions.length).fill(false);
    
    totalTime = Math.floor(window.questions.length * 0.9) * 60;

    updateFilteredList('all');

    document.getElementById('start-slide').classList.remove('active');
    
    // We keep the background timer hidden to avoid "two timers"
    const bgTimer = document.getElementById('globalTimer');
    if(bgTimer) bgTimer.style.display = 'none';
    
    showQuestion(0);
    startTimer();
};

function updateFilteredList(filter) {
    filteredIndices = [];
    window.questions.forEach((q, i) => {
        if (filter === 'all') filteredIndices.push(i);
        else if (filter === 'flagged' && flaggedStatus[i]) filteredIndices.push(i);
        else if (filter === 'skipped' && userAnswers[i] === null) filteredIndices.push(i);
        else if (filter === 'wrong' && userAnswers[i] !== null && userAnswers[i] !== q.correct) filteredIndices.push(i);
        else if (filter === 'correct' && userAnswers[i] === q.correct) filteredIndices.push(i);
    });
}

window.showQuestion = (idx) => {
    currentQIndex = idx;
    const q = window.questions[idx];
    const container = document.getElementById('question-area');
    
    document.querySelectorAll('.slide-container').forEach(s => s.classList.remove('active'));
    
    // FIX: Generate the time string RIGHT NOW so there is no delay
    const currentTime = getTimeString();
    
    container.innerHTML = `
    <div class="slide-container active">
        <div class="quiz-header">
            <div class="global-timer" id="globalTimer">${currentTime}</div>
            
            <div class="progress-container">
                <div class="progress-bar" style="width: ${((idx + 1) / window.questions.length) * 100}%"></div>
            </div>
            <div class="quiz-meta">
                <span>Question ${idx + 1}/${window.questions.length}</span>
                <button id="flagBtn" class="${flaggedStatus[idx] ? 'active' : ''}" onclick="toggleFlag(${idx})">
                    🚩
                </button>
            </div>
        </div>

        <div class="content-scroll">
            <h2 class="question-text">${q.q}</h2>
            <div class="options-list">
                ${q.options.map((opt, i) => {
                    let cls = userAnswers[idx] === i ? 'selected' : '';
                    if(isReviewMode) {
                        if(i === q.correct) cls += ' correct-ans';
                        if(userAnswers[idx] === i && i !== q.correct) cls += ' wrong-ans';
                    }
                    return `<button class="option-btn ${cls}" data-idx="${i}">${opt}</button>`;
                }).join('')}
            </div>
            ${isReviewMode ? `<div class="explanation-box" style="display:block; margin-top:20px;"><b>Explanation:</b> ${q.exp}</div>` : ''}
        </div>

        <div class="nav-footer">
            <div class="nav-buttons-row">
                <button class="btn btn-outline" onclick="prevQ()">Prev</button>
                <button class="btn btn-outline" onclick="goToDashboard()">Dashboard</button>
                <button class="btn btn-primary" onclick="nextQ()">
                    ${(filteredIndices.indexOf(idx) === filteredIndices.length - 1) ? (isReviewMode ? 'Results' : 'Finish') : 'Next'}
                </button>
            </div>
        </div>
    </div>
    `;

    const scrollArea = container.querySelector('.content-scroll');
    if (scrollArea) scrollArea.scrollTop = 0;

    container.querySelectorAll('.option-btn').forEach(btn => {
        btn.onclick = () => {
            if(isReviewMode) return;
            const optIdx = parseInt(btn.dataset.idx);
            userAnswers[currentQIndex] = (userAnswers[currentQIndex] === optIdx) ? null : optIdx;
            container.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            if(userAnswers[currentQIndex] !== null) btn.classList.add('selected');
        };
    });
};

window.nextQ = () => {
    const currentPos = filteredIndices.indexOf(currentQIndex);
    if (currentPos < filteredIndices.length - 1) {
        showQuestion(filteredIndices[currentPos + 1]);
    } else {
        isReviewMode ? showFinalResults(false) : goToDashboard();
    }
};

window.prevQ = () => {
    const currentPos = filteredIndices.indexOf(currentQIndex);
    if (currentPos > 0) {
        showQuestion(filteredIndices[currentPos - 1]);
    }
};

window.toggleFlag = (idx) => {
    flaggedStatus[idx] = !flaggedStatus[idx];
    showQuestion(idx);
};

window.goToDashboard = () => {
    renderSummary('all');
};

window.renderSummary = (filter) => {
    document.querySelectorAll('.slide-container').forEach(s => s.classList.remove('active'));
    updateFilteredList(filter);
    
    const grid = document.getElementById('summaryGrid');
    grid.innerHTML = '';
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`sum-${filter}`);
    if(activeBtn) activeBtn.classList.add('active');

    filteredIndices.forEach((i) => {
        const item = document.createElement('div');
        let statusClass = userAnswers[i] !== null ? 'answered' : 'skipped';
        if(isReviewMode) {
            if (userAnswers[i] === null) statusClass = 'res-skipped';
            else if (userAnswers[i] === window.questions[i].correct) statusClass = 'res-correct';
            else statusClass = 'res-wrong';
        }
        item.className = `summary-dot ${statusClass} ${flaggedStatus[i] ? 'flagged' : ''}`;
        item.innerText = i + 1;
        item.onclick = () => showQuestion(i);
        grid.appendChild(item);
    });
    
    document.getElementById('summary-slide').classList.add('active');
};

window.resumeQuiz = () => {
    showQuestion(currentQIndex);
};

window.enterReviewMode = (filter) => {
    isReviewMode = true;
    document.getElementById('dash-title').innerText = "Review Dashboard";
    document.getElementById('dash-footer').innerHTML = `
        <button class="btn btn-outline" onclick="showFinalResults(false)" style="width:100%">Back to Results</button>
    `;
    const filterBar = document.querySelector('.filter-bar');
    filterBar.innerHTML = `
        <button class="filter-btn" id="sum-all" onclick="triggerSummaryFilter('all')">All</button>
        <button class="filter-btn" id="sum-correct" onclick="triggerSummaryFilter('correct')">Correct</button>
        <button class="filter-btn" id="sum-wrong" onclick="triggerSummaryFilter('wrong')">Wrong</button>
        <button class="filter-btn" id="sum-flagged" onclick="triggerSummaryFilter('flagged')">Flagged</button>
    `;
    renderSummary(filter);
};

window.showFinalResults = async (upload = true) => {
    clearInterval(timerInterval);
    document.querySelectorAll('.slide-container').forEach(s => s.classList.remove('active'));
    
    document.querySelectorAll('#globalTimer').forEach(el => el.style.display = 'none');

    let correct = 0, wrong = 0, skipped = 0, flaggedCount = 0;
    let flaggedQuestionsData = [];

    window.questions.forEach((q, i) => {
        if (userAnswers[i] === null) skipped++;
        else if (userAnswers[i] === q.correct) correct++;
        else wrong++;

        if (flaggedStatus[i]) {
            flaggedCount++;
            flaggedQuestionsData.push({
                system: window.quizMetadata.title,
                questionText: q.q,
                options: q.options,
                correctIndex: q.correct,
                explanation: q.exp,
                moduleId: window.quizMetadata.id
            });
        }
    });

    const earnedMarks = (correct * 4) - (wrong * 1);
    const maxMarks = window.questions.length * 4;
    const displayPercentage = Math.max(0, Math.round((earnedMarks / maxMarks) * 100));

    document.getElementById('res-correct-count').innerText = correct;
    document.getElementById('res-wrong-count').innerText = wrong;
    document.getElementById('res-skipped-count').innerText = skipped;
    document.getElementById('res-flag-count').innerText = flaggedCount;
    document.getElementById('finalScoreDisplay').innerText = displayPercentage + "%";
    document.getElementById('marksDisplay').innerText = `Score: ${earnedMarks} / ${maxMarks}`;

    if (upload && currentUser) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, {
                scores: arrayUnion({
                    moduleId: window.quizMetadata.id,
                    score: displayPercentage,
                    timestamp: new Date().toISOString()
                }),
                flaggedQuestions: arrayUnion(...flaggedQuestionsData)
            });
        } catch (e) { console.error("Save error:", e); }
    }
    document.getElementById('results-slide').classList.add('active');
};

function startTimer() {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        totalTime--;
        let timeString = getTimeString();
        
        document.querySelectorAll('#globalTimer').forEach(el => {
            el.innerText = timeString;
        });

        if (totalTime <= 0) showFinalResults();
    }, 1000);
}
