const firebaseConfig = {
    databaseURL: "https://festivalquizmaster-default-rtdb.europe-west1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const questionScreen = document.getElementById('question-screen');
const nicknameInput = document.getElementById('nickname');
const joinBtn = document.getElementById('join-btn');
const errorMsg = document.getElementById('error-msg');
const questionText = document.getElementById('question-text');
const waitingText = document.getElementById('waiting-text');
const answerBtns = document.querySelectorAll('.answer-btn');

let playerId = localStorage.getItem('playerId');
if (!playerId) {
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('playerId', playerId);
}

let isLocked = false;
let currentQuestionId = null;
let questionStartTime = 0;
let hasAnswered = false;

database.ref('QuizState/IsLocked').on('value', (snapshot) => {
    isLocked = snapshot.val() || false;
});

joinBtn.addEventListener('click', () => {
    const name = nicknameInput.value.trim();
    if (name.length === 0) return;

    if (isLocked) {
        errorMsg.classList.remove('hidden');
        return;
    }

    database.ref('Players/' + playerId).set({
        Id: playerId,
        Name: name,
        Score: 0,
        TotalResponseTimeMs: 0
    }).then(() => {
        loginScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
    });
});

database.ref('CurrentQuestion').on('value', (snapshot) => {
    const question = snapshot.val();
    
    if (!question) return;

    if (question.Id !== currentQuestionId) {
        currentQuestionId = question.Id;
        hasAnswered = false;
        questionStartTime = Date.now();
        
        answerBtns.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });

        if (loginScreen.classList.contains('hidden')) {
            waitingScreen.classList.add('hidden');
            questionScreen.classList.remove('hidden');
        }
    }
});

answerBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (hasAnswered) return;
        
        hasAnswered = true;
        const answerIndex = parseInt(e.target.getAttribute('data-index'));
        const responseTime = Date.now() - questionStartTime;

        answerBtns.forEach(b => {
            if (b !== e.target) {
                b.style.opacity = '0.3';
            }
        });

        const answerRef = database.ref('Answers').push();
        answerRef.set({
            PlayerId: playerId,
            QuestionId: currentQuestionId,
            AnswerIndex: answerIndex,
            ResponseTimeMs: responseTime
        }).then(() => {
            setTimeout(() => {
                questionScreen.classList.add('hidden');
                waitingScreen.classList.remove('hidden');
                waitingText.innerText = "Réponse envoyée ! En attente...";
            }, 1000);
        });
    });
});