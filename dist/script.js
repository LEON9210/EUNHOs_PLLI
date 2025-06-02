// 你的 Firebase 配置 (已使用之前確認的正確值)
const firebaseConfig = {
    apiKey: "AIzaSyBHGUfdTrk9yWGkPyWS0FE9URL5rLLlW-8", // <-- 請確保這是您 Firebase 專案的正確 API Key，這是之前確認的完整版
    authDomain: "project-7998118091892536209.firebaseapp.com",
    databaseURL: "https://project-7998118091892536209-default-rtdb.firebaseio.com",
    projectId: "project-7998118091892536209",
    storageBucket: "project-7998118091892536209.firebasestorage.app",
    messagingSenderId: "301007470622",
    appId: "1:301007470622:web:92fbec7adc722b8af76e0f", // <-- 請使用您 Firebase 專案設定中的這個值
    measurementId: "G-GMGRRVJBQR" // <-- 請使用您 Firebase 專案設定中的這個值
};

// 初始化 Firebase (只初始化一次)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM 元素 (確保這些 ID 與 index.html 完全一致)
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const loadingScreen = document.getElementById('loading-screen'); // 載入畫面

const startGameBtn = document.getElementById('start-game-btn');
const questionText = document.getElementById('question-text');
const optionsGrid = document.getElementById('options-grid');
const optionButtons = document.querySelectorAll('.option-btn');
const resultFeedback = document.getElementById('result-feedback');
const explanationText = document.getElementById('explanation-text');

// 計時器和分數顯示元素 (已修正 ID)
const timerDisplay = document.getElementById('timer-display'); // 對應 index.html 的 timer-display
const scoreDisplay = document.getElementById('score-display');
const questionNumberDisplay = document.getElementById('question-number-display'); // 對應 index.html 的 question-number-display
const totalQuestionsCountDisplay = document.getElementById('total-questions-count'); // 確保這個 ID 在 HTML 中存在

const finalScoreValue = document.getElementById('final-score-value');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const leaderboardList = document.getElementById('leaderboard-list');

// 開始畫面中顯示遊戲參數的元素
const totalQuestionsDisplay = document.getElementById('total-questions-display');
const timeLimitDisplay = document.getElementById('time-limit-display');


// 遊戲變數
let questions = []; // 存放從 Firebase 載入的所有題目
let gameQuestions = []; // 存放本次遊戲隨機選取的題目 (TOTAL_QUESTIONS_PER_GAME 題)
let currentQuestionIndex = 0;
let score = 0;
let timerInterval; // 統一使用 timerInterval
let timeLeft;
const QUESTION_DURATION = 20; // 每題 20 秒思考時間
const TOTAL_QUESTIONS_PER_GAME = 25; // 每次遊戲玩 25 題
const CORRECT_SCORE = 100;
const WRONG_PENALTY = 50;
let questionStartTime = 0;

// --- 輔助函數：螢幕切換 ---
function showScreen(screenToShow) {
    // 獲取所有在 #game-main-content 內的 .screen 元素 (確保 #game-main-content ID 在 HTML 中存在)
    const allScreens = document.querySelectorAll('#game-main-content .screen');

    allScreens.forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none'; // 使用 display: none 來確保元素不佔空間
        screen.style.opacity = '0'; // For transition effect
        screen.style.pointerEvents = 'none'; // 禁用點擊事件
        screen.style.zIndex = '1'; // 設置較低的 z-index
    });

    // 顯示指定螢幕
    screenToShow.style.display = 'flex'; // 讓它能被顯示
    screenToShow.style.zIndex = '10'; // 放在最上層

    // 稍作延遲再添加 active class，確保 display 屬性已更新，這樣 transition 才能正常生效
    setTimeout(() => {
        screenToShow.classList.add('active');
        screenToShow.style.opacity = '1';
        screenToShow.style.pointerEvents = 'auto'; // 啟用點擊事件
    }, 50); // 短暫延遲，例如 50ms
}

// --- 計時器功能 ---
function startTimer() {
    stopTimer(); // 在啟動新計時器之前，確保前一個計時器已停止

    timeLeft = QUESTION_DURATION;
    updateTimerDisplay(); // 立即更新顯示

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            stopTimer();
            // 時間到，視為答錯，自動進入下一題
            if (currentQuestionIndex < gameQuestions.length) {
                checkAnswer(null, gameQuestions[currentQuestionIndex].answer, null); // 傳遞 null 表示沒有選擇按鈕
            }
        }
    }, 1000); // 每秒執行一次
}

function stopTimer() {
    clearInterval(timerInterval); // 清除正確的計時器變數
    timerDisplay.style.color = ''; // 重置顏色
    timerDisplay.classList.remove('flashing-red', 'flashing-orange'); // 移除閃爍效果
    timerDisplay.style.animation = 'none'; // 移除動畫
}

function updateTimerDisplay() {
    timerDisplay.textContent = timeLeft;

    // 清除所有與時間相關的 class，避免疊加
    timerDisplay.classList.remove('flashing-red', 'flashing-orange');
    timerDisplay.style.color = ''; // 重置為 CSS 預設顏色 (通過移除 style.color 來實現)
    timerDisplay.style.animation = 'none'; // 移除動畫

    if (timeLeft <= 10 && timeLeft > 5) {
        timerDisplay.style.color = 'orange'; // 淺變色
        timerDisplay.classList.add('flashing-orange'); // 新增 class 來控制閃爍
    } else if (timeLeft <= 5) {
        timerDisplay.style.color = 'red'; // 警告色
        timerDisplay.classList.add('flashing-red'); // 新增 class 來控制閃爍
        timerDisplay.style.animation = 'pulseRed 1s infinite'; // 添加動畫
    }
}

// --- 遊戲初始化與題目載入 ---
async function loadQuestions() {
    showScreen(loadingScreen); // 顯示載入畫面
    try {
        const snapshot = await database.ref('themes').once('value');
        const data = snapshot.val();

        let allQuestions = [];

        if (data && Array.isArray(data)) {
            data.forEach(theme => {
                if (theme.questions && Array.isArray(theme.questions)) {
                    theme.questions.forEach(q => {
                        let formattedOptions = [];
                        let correctAnswer = null;

                        // 處理各種選項格式
                        if (q.options && Array.isArray(q.options)) {
                            formattedOptions = q.options.map(opt => {
                                if (typeof opt === 'string') {
                                    return { text: opt, isCorrect: false };
                                }
                                return { text: opt.text, isCorrect: opt.isCorrect };
                            });
                            correctAnswer = formattedOptions.find(opt => opt.isCorrect)?.text;
                        } else if (q.options && typeof q.options === 'object') { // 處理 Firebase 導出為物件形式的陣列
                            formattedOptions = Object.values(q.options).map(opt => {
                                if (typeof opt === 'string') {
                                    return { text: opt, isCorrect: false };
                                }
                                return { text: opt.text, isCorrect: opt.isCorrect };
                            });
                            correctAnswer = formattedOptions.find(opt => opt.isCorrect)?.text;
                        } else if (q.correctAnswer && q.options) { // 處理舊的只有 correctAnswer 欄位的格式
                            formattedOptions = q.options.map(opt => ({ text: opt, isCorrect: opt === q.correctAnswer }));
                            correctAnswer = q.correctAnswer;
                        }

                        if (correctAnswer) {
                            allQuestions.push({
                                question: q.questionText,
                                options: formattedOptions.map(opt => opt.text),
                                answer: correctAnswer,
                                explanation: q.explanation || ''
                            });
                        } else {
                            console.warn("Skipping question due to missing correct answer:", q);
                        }
                    });
                }
            });
            questions = allQuestions;

            if (questions.length === 0) {
                console.error("載入題目失敗：沒有題目資料。請檢查 Firebase Realtime Database 的 '/themes' 路徑下是否包含正確格式的題目。");
                alert("載入題目失敗：沒有題目資料。請檢查 Firebase Realtime Database 的 '/themes' 路徑下是否包含正確格式的題目。");
                showScreen(startScreen);
                return;
            }

            if (questions.length < TOTAL_QUESTIONS_PER_GAME) {
                console.warn(`警告：題庫數量不足 ${TOTAL_QUESTIONS_PER_GAME} 題，實際載入 ${questions.length} 題。將使用所有現有題目。`);
            }
            console.log("全部題目載入成功，共", questions.length, "題。");
            initializeGame(); // 題目載入後初始化遊戲
        } else {
            console.error("載入題目失敗：Firebase 資料格式不正確。預期在 '/themes' 路徑下為一個包含主題的陣列。");
            alert("載入題目失敗：Firebase 資料格式不正確。預期在 '/themes' 路徑下為一個包含主題的陣列。");
            showScreen(startScreen);
        }
    } catch (error) {
        console.error("載入題目失敗:", error);
        alert("載入題目失敗，請檢查網路連線或 Firebase 權限。錯誤訊息：" + error.message);
        showScreen(startScreen);
    }
}

function initializeGame() {
    stopTimer(); // 確保任何可能還在運行的計時器停止
    score = 0;
    currentQuestionIndex = 0;

    scoreDisplay.textContent = `${score}`;
    questionNumberDisplay.textContent = `1`;
    totalQuestionsCountDisplay.textContent = `${TOTAL_QUESTIONS_PER_GAME}`; // 顯示本次遊戲的總題數
    resultFeedback.textContent = '';
    explanationText.textContent = '';
    playerNameInput.value = ''; // 清空玩家名字
    submitScoreBtn.style.display = 'block'; // 顯示提交按鈕
    playerNameInput.style.display = 'block'; // 顯示名字輸入框
    const gameOverLabel = document.querySelector('#game-over-screen label');
    if (gameOverLabel) gameOverLabel.style.display = 'block'; // 顯示標籤

    // 更新開始畫面的顯示文字，確保 DOM 元素存在且可更新
    if (totalQuestionsDisplay) {
        totalQuestionsDisplay.textContent = TOTAL_QUESTIONS_PER_GAME;
    }
    if (timeLimitDisplay) {
        timeLimitDisplay.textContent = QUESTION_DURATION;
    }

    showScreen(startScreen); // 顯示開始畫面
    loadLeaderboard(); // 載入排行榜
}

// --- 遊戲流程控制 ---
function startGame() {
    if (questions.length === 0) {
        alert("題目尚未載入完成，請稍候再試或檢查錯誤訊息。");
        loadQuestions(); // 嘗試重新載入題目
        return;
    }
    // 每次開始新遊戲時，重新隨機選取題目
    const numQuestionsToSelect = Math.min(TOTAL_QUESTIONS_PER_GAME, questions.length);
    gameQuestions = [...questions].sort(() => Math.random() - 0.5).slice(0, numQuestionsToSelect);

    score = 0;
    currentQuestionIndex = 0;
    scoreDisplay.textContent = `${score}`; // 重新開始遊戲，分數顯示為0

    showScreen(quizScreen); // 進入問答畫面
    startNewQuestion();
}

function startNewQuestion() {
    if (currentQuestionIndex >= gameQuestions.length) {
        endGame();
        return;
    }

    const question = gameQuestions[currentQuestionIndex];
    questionText.textContent = question.question;
    resultFeedback.textContent = ''; // 清除上次的結果提示
    explanationText.textContent = ''; // 清除科普內容

    // 遍歷所有選項按鈕
    optionButtons.forEach((button, index) => {
        // 先重置所有按鈕的樣式和事件監聽器
        button.classList.remove('correct', 'wrong');
        button.disabled = false;
        button.onclick = null; // 移除舊的事件監聽器

        const optionTextSpan = button.querySelector('.option-text');
        if (optionTextSpan) {
            if (index < question.options.length) {
                // 如果有對應的選項，則設定其內容和事件
                const optionText = question.options[index];
                optionTextSpan.textContent = optionText;
                button.onclick = () => checkAnswer(optionText, question.answer, button); // 傳遞 button 引用
                button.style.display = 'flex'; // 確保按鈕顯示
            } else {
                // 如果沒有對應的選項（例如，題目只有3個選項，但有4個按鈕），則隱藏多餘的按鈕
                optionTextSpan.textContent = ''; // 清空內容
                button.style.display = 'none'; // 隱藏多餘的按鈕
            }
        } else {
            console.error("找不到 .option-text 元素在按鈕內部:", button);
        }
    });

    questionNumberDisplay.textContent = `${currentQuestionIndex + 1}`;
    totalQuestionsCountDisplay.textContent = `${gameQuestions.length}`; // 顯示實際將要回答的題目總數

    questionStartTime = Date.now(); // 記錄問題開始時間
    startTimer(); // 啟動計時器
}


function checkAnswer(selectedOption, correctAnswer, clickedButton) {
    stopTimer(); // 停止本題計時器
    const timeTaken = (Date.now() - questionStartTime) / 1000; // 秒
    let points = 0;
    let isCorrect = (selectedOption === correctAnswer);

    if (isCorrect) {
        resultFeedback.textContent = '✅ 正確！';
        resultFeedback.style.color = 'var(--correct-color)';
        points = CORRECT_SCORE;
        points += Math.max(0, Math.floor((QUESTION_DURATION - timeTaken) * 5));
    } else {
        resultFeedback.textContent = '❌ 錯誤！';
        resultFeedback.style.color = 'var(--wrong-color)';
        points = -WRONG_PENALTY;
    }

    score += points;
    scoreDisplay.textContent = `${score}`;

    explanationText.textContent = gameQuestions[currentQuestionIndex].explanation;

    optionButtons.forEach(button => {
        button.disabled = true; // 禁用所有按鈕
        const optionTextSpan = button.querySelector('.option-text');
        if (optionTextSpan && optionTextSpan.textContent === correctAnswer) {
            button.classList.add('correct');
        } else if (button === clickedButton && !isCorrect) { // 只有當點擊的按鈕是錯誤的才標示
            button.classList.add('wrong');
        } else if (selectedOption === null && optionTextSpan && optionTextSpan.textContent === correctAnswer) {
            // 如果時間用完，則高亮正確答案
            button.classList.add('correct');
        }
    });

    // 1.5 秒後進入下一題
    setTimeout(() => {
        currentQuestionIndex++;
        startNewQuestion();
    }, 1500);
}

function endGame() {
    stopTimer();
    showScreen(gameOverScreen);
    finalScoreValue.textContent = score;
    playerNameInput.value = '匿名英雄'; // 設置預設名字
    submitScoreBtn.style.display = 'block';
    playerNameInput.style.display = 'block';
    const gameOverLabel = document.querySelector('#game-over-screen label');
    if (gameOverLabel) gameOverLabel.style.display = 'block';
}

// --- 排行榜操作 (Firebase) ---
let leaderboardListenerAttached = false; // 標記是否已綁定排行榜監聽器

function loadLeaderboard() {
    // 只有在還沒有綁定監聽器時才綁定，避免重複綁定導致問題
    if (!leaderboardListenerAttached) {
        database.ref('leaderboard').orderByChild('score').limitToLast(10).on('value', (snapshot) => {
            const scores = [];
            snapshot.forEach((childSnapshot) => {
                scores.push(childSnapshot.val());
            });
            scores.sort((a, b) => b.score - a.score); // 分數降序排列

            leaderboardList.innerHTML = ''; // 清空舊的排行榜
            if (scores.length === 0) {
                leaderboardList.innerHTML = '<li>目前沒有分數紀錄。</li>';
                return;
            }

            scores.forEach((entry, index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<span>${index + 1}. ${entry.name}</span><span>${entry.score} 分</span>`;
                if (index === 0) listItem.classList.add('first-place');
                else if (index === 1) listItem.classList.add('second-place');
                else if (index === 2) listItem.classList.add('third-place');
                leaderboardList.appendChild(listItem);
            });
        });
        leaderboardListenerAttached = true; // 標記為已綁定
    }
}


async function submitScore() {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert("請輸入你的名字！");
        return;
    }

    submitScoreBtn.disabled = true; // 防止重複提交
    try {
        await database.ref('leaderboard').push({
            name: playerName,
            score: score,
            timestamp: Date.now()
        });
        alert("分數提交成功！");
        playerNameInput.value = '';
        // 提交成功後，UI上隱藏提交相關元素
        submitScoreBtn.style.display = 'none';
        playerNameInput.style.display = 'none';
        const gameOverLabel = document.querySelector('#game-over-screen label');
        if (gameOverLabel) gameOverLabel.style.display = 'none';
        // 排行榜會因為 on('value') 自動更新，不需要手動調用 loadLeaderboard()
    } catch (error) {
        console.error("提交分數失敗:", error);
        alert("提交分數失敗，請稍後再試。錯誤訊息：" + error.message);
    } finally {
        submitScoreBtn.disabled = false;
    }
}

// --- 事件監聽 ---
startGameBtn.addEventListener('click', startGame);
submitScoreBtn.addEventListener('click', submitScore);
playAgainBtn.addEventListener('click', initializeGame);

// 首次載入頁面時執行
loadQuestions(); // 載入題目並初始化遊戲 (這會最終顯示 startScreen)