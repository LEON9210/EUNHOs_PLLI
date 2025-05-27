// 你的 Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyBHGUfdTrk9yWGkPyWS0FE9URL5rLLlW-8",
    authDomain: "project-7998118091892536209.firebaseapp.com",
    databaseURL: "https://project-7998118091892536209-default-rtdb.firebaseio.com",
    projectId: "project-7998118091892536209",
    storageBucket: "project-7998118091892536209.firebasestorage.app",
    messagingSenderId: "301007470622",
    appId: "1:301007470622:web:3704a3b3ee5026b1f76e0f",
    measurementId: "G-0DZNRM444K"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM 元素
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const loadingScreen = document.getElementById('loading-screen');

const startGameBtn = document.getElementById('start-game-btn');
const questionText = document.getElementById('question-text');
const optionsGrid = document.getElementById('options-grid');
const optionButtons = document.querySelectorAll('.option-btn');
const resultFeedback = document.getElementById('result-feedback');
const explanationText = document.getElementById('explanation-text');
const timeLeftDisplay = document.getElementById('timer-display');
const scoreDisplay = document.getElementById('score-display');
const currentQuestionCount = document.getElementById('current-question-count');

const finalScoreValue = document.getElementById('final-score-value');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const leaderboardList = document.getElementById('leaderboard-list');

// 遊戲變數
let questions = []; // 存放從 Firebase 載入的所有題目
let gameQuestions = []; // 存放本次遊戲隨機選取的 25 題
let currentQuestionIndex = 0;
let score = 0;
let timer;
let timeLeft = 0;
const QUESTION_DURATION = 20; // 每題 20 秒思考時間
const TOTAL_QUESTIONS_PER_GAME = 25; // 每次遊戲玩 25 題
const CORRECT_SCORE = 100;
const WRONG_PENALTY = 50;
let questionStartTime = 0;

// --- 輔助函數：螢幕切換 ---
function showScreen(screenToShow) {
    const screens = [startScreen, quizScreen, gameOverScreen, loadingScreen];
    screens.forEach(screen => {
        if (screen === screenToShow) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });
}

// --- 遊戲初始化與題目載入 ---
async function loadQuestions() {
    showScreen(loadingScreen); // 顯示載入畫面
    try {
        const snapshot = await database.ref('questions').once('value');
        const data = snapshot.val();
        if (data) {
            questions = Object.values(data); // 將物件轉換為陣列
            if (questions.length < TOTAL_QUESTIONS_PER_GAME) {
                console.warn(`警告：題庫數量不足 ${TOTAL_QUESTIONS_PER_GAME} 題，實際載入 ${questions.length} 題。請增加題庫數量以獲得完整遊戲體驗。`);
                alert(`警告：題庫數量不足 ${TOTAL_QUESTIONS_PER_GAME} 題，遊戲將使用所有現有題目。`);
            }
            console.log("全部題目載入成功，共", questions.length, "題。");
            initializeGame(); // 題目載入後初始化遊戲
        } else {
            console.error("Firebase 沒有題目資料。請檢查 'questions' 路徑。");
            alert("載入題目失敗：沒有題目資料。請在 Firebase Realtime Database 的 'questions' 路徑下添加題目。");
            showScreen(startScreen); // 返回開始畫面
        }
    } catch (error) {
        console.error("載入題目失敗:", error);
        alert("載入題目失敗，請檢查網路連線或 Firebase 配置。錯誤訊息：" + error.message);
        showScreen(startScreen); // 返回開始畫面
    }
}

function initializeGame() {
    score = 0;
    currentQuestionIndex = 0;
    scoreDisplay.textContent = `分數：${score}`; // 更新為 scoreDisplay
    currentQuestionCount.textContent = `題數：1 / ${TOTAL_QUESTIONS_PER_GAME}`;
    resultFeedback.textContent = '';
    explanationText.textContent = '';
    playerNameInput.value = ''; // 清空玩家名字
    submitScoreBtn.style.display = 'block'; // 顯示提交按鈕
    playerNameInput.style.display = 'block'; // 顯示名字輸入框
    document.querySelector('#game-over-screen label').style.display = 'block'; // 顯示標籤
    stopTimer(); // 確保計時器停止
    showScreen(startScreen); // 顯示開始畫面
    loadLeaderboard(); // 載入排行榜
}

// --- 遊戲流程控制 ---
function startGame() {
    // 每次開始新遊戲時，重新隨機選取 25 題
    gameQuestions = [...questions].sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS_PER_GAME);
    
    score = 0;
    currentQuestionIndex = 0;
    scoreDisplay.textContent = `分數：${score}`;
    showScreen(quizScreen); // 顯示問答畫面
    startNewQuestion();
}

function startNewQuestion() {
    if (currentQuestionIndex >= TOTAL_QUESTIONS_PER_GAME || gameQuestions.length === 0) {
        endGame();
        return;
    }

    const question = gameQuestions[currentQuestionIndex];
    questionText.textContent = question.question;
    resultFeedback.textContent = ''; // 清除上次的結果提示
    explanationText.textContent = ''; // 清除科普內容

    // 啟用所有選項按鈕，並清除顏色
    optionButtons.forEach((button, index) => {
        // 更新：將文字放入 span.option-text
        button.querySelector('.option-text').textContent = question.options[index];
        button.onclick = () => checkAnswer(button.querySelector('.option-text').textContent, question.answer);
        button.classList.remove('correct', 'wrong');
        button.disabled = false;
        // 移除 FontAwesome 相關的偽元素 class，否則會重複顯示
        button.classList.remove('fa-solid', 'fa-check', 'fa-xmark'); 
    });

    currentQuestionCount.textContent = `題數：${currentQuestionIndex + 1} / ${TOTAL_QUESTIONS_PER_GAME}`;
    
    timeLeft = QUESTION_DURATION; // 重置每題時間
    timeLeftDisplay.textContent = `時間：${timeLeft} 秒`;
    questionStartTime = Date.now(); // 記錄問題開始時間
    startQuestionTimer();
}

function startQuestionTimer() {
    stopTimer(); // 確保前一個計時器已清除
    timer = setInterval(() => {
        timeLeft--;
        timeLeftDisplay.textContent = `時間：${timeLeft} 秒`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            // 時間到，視為答錯，自動進入下一題
            checkAnswer(null, gameQuestions[currentQuestionIndex].answer); 
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timer);
}

function checkAnswer(selectedOption, correctAnswer) {
    stopTimer(); // 停止本題計時器
    const timeTaken = (Date.now() - questionStartTime) / 1000; // 秒
    let points = 0;
    let isCorrect = (selectedOption === correctAnswer);

    // 答對分數計算
    if (isCorrect) {
        resultFeedback.textContent = '✅ 正確！';
        resultFeedback.style.color = 'var(--correct-color)';
        points = CORRECT_SCORE;
        // 時間獎勵：答題越快獎勵越多，確保不會是負數
        points += Math.max(0, Math.floor((QUESTION_DURATION - timeTaken) * 5)); 
    } else {
        resultFeedback.textContent = '❌ 錯誤！';
        resultFeedback.style.color = 'var(--wrong-color)';
        points = -WRONG_PENALTY; // 答錯或時間到都倒扣
    }

    score += points;
    scoreDisplay.textContent = `分數：${score}`; // 更新為 scoreDisplay

    // 顯示科普內容
    explanationText.textContent = gameQuestions[currentQuestionIndex].explanation;

    // 視覺回饋：標示正確和錯誤選項
    optionButtons.forEach(button => {
        button.disabled = true; // 禁用所有按鈕
        // 更新：檢查 span 內的文字
        if (button.querySelector('.option-text').textContent === correctAnswer) {
            button.classList.add('correct');
        } else if (button.querySelector('.option-text').textContent === selectedOption && !isCorrect) {
            button.classList.add('wrong');
        }
    });

    // 1.5 秒後進入下一題
    setTimeout(() => {
        currentQuestionIndex++;
        startNewQuestion();
    }, 1500); // 延長顯示科普時間
}

function endGame() {
    stopTimer();
    showScreen(gameOverScreen); // 顯示遊戲結束畫面
    finalScoreValue.textContent = score;
    // 預設玩家名字
    playerNameInput.value = '匿名英雄';
}

// --- Firebase 排行榜操作 ---
async function submitScore() {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert("請輸入你的名字！");
        return;
    }

    submitScoreBtn.disabled = true; // 防止重複提交
    try {
        const newScoreRef = database.ref('leaderboard').push();
        await newScoreRef.set({
            name: playerName,
            score: score,
            timestamp: Date.now()
        });
        alert("分數提交成功！");
        playerNameInput.value = '';
        loadLeaderboard(); // 更新排行榜
        submitScoreBtn.style.display = 'none'; // 隱藏提交按鈕
        playerNameInput.style.display = 'none'; // 隱藏輸入框
        document.querySelector('#game-over-screen label').style.display = 'none'; // 隱藏標籤
    } catch (error) {
        console.error("提交分數失敗:", error);
        alert("提交分數失敗，請稍後再試。錯誤訊息：" + error.message);
    } finally {
        submitScoreBtn.disabled = false;
    }
}

function loadLeaderboard() {
    // 監聽排行榜資料變化，即時更新 (取前 10 名)
    database.ref('leaderboard').orderByChild('score').limitToLast(10).on('value', (snapshot) => {
        const scores = [];
        snapshot.forEach((childSnapshot) => {
            scores.push(childSnapshot.val());
        });
        // 分數降序排列
        scores.sort((a, b) => b.score - a.score);

        leaderboardList.innerHTML = ''; // 清空舊的排行榜
        scores.forEach((entry, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${index + 1}. ${entry.name}</span><span>${entry.score} 分</span>`;
            leaderboardList.appendChild(listItem);
        });
    });
}

// --- 事件監聽 ---
startGameBtn.addEventListener('click', startGame);
submitScoreBtn.addEventListener('click', submitScore);
playAgainBtn.addEventListener('click', loadQuestions); // 再玩一次時重新載入題目，確保隨機性

// 首次載入頁面時執行
loadQuestions(); // 載入題目並初始化遊戲