const firebaseConfig = { databaseURL: "https://festivalquizmaster-default-rtdb.europe-west1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const loginScreen = document.getElementById('login-screen'), waitingScreen = document.getElementById('waiting-screen'), questionScreen = document.getElementById('question-screen'), podiumScreen = document.getElementById('podium-screen');
const scoreHeader = document.getElementById('score-header'), userScore = document.getElementById('user-score'), timerDisplay = document.getElementById('timer-display'), nicknameInput = document.getElementById('nickname');
const joinBtn = document.getElementById('join-btn'), errorMsg = document.getElementById('error-msg'), waitingText = document.getElementById('waiting-text'), podiumMsg = document.getElementById('podium-msg'), answerBtns = document.querySelectorAll('.answer-btn');

let playerId = localStorage.getItem('playerId') || 'p_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('playerId', playerId);

let isRegistrationOpen = false, currentQuestionId = null, questionStartTime = 0, hasAnswered = false;

function syncQuestion(q) {
    if (!q || !isRegistrationOpen) return;
    if (q.Id !== currentQuestionId) {
        currentQuestionId = q.Id; hasAnswered = false; questionStartTime = Date.now();
        answerBtns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
        waitingScreen.classList.add('hidden'); loginScreen.classList.add('hidden'); podiumScreen.classList.add('hidden'); questionScreen.classList.remove('hidden');
    }
}

database.ref('QuizState/RegistrationOpen').on('value', s => {
    isRegistrationOpen = s.val() || false;
    if (!isRegistrationOpen) {
        loginScreen.classList.add('hidden'); questionScreen.classList.add('hidden'); podiumScreen.classList.add('hidden'); scoreHeader.classList.add('hidden'); waitingScreen.classList.remove('hidden');
        waitingText.innerText = "Préparez-vous à vous inscrire.\nLe quiz ouvrira bientôt ses portes."; 
        userScore.innerText = "0";
    } else {
        database.ref('Players/' + playerId).once('value').then(ps => {
            if (ps.exists()) {
                loginScreen.classList.add('hidden'); scoreHeader.classList.remove('hidden'); waitingScreen.classList.remove('hidden'); 
                waitingText.innerText = "Le quiz va commencer.\nTenez-vous prêt !";
                database.ref('CurrentQuestion').once('value', qs => syncQuestion(qs.val()));
            } else { loginScreen.classList.remove('hidden'); }
        });
    }
});

database.ref('CurrentQuestion').on('value', s => syncQuestion(s.val()));
database.ref('Players/' + playerId).on('value', s => { if (s.val()) userScore.innerText = s.val().Score || 0; });
database.ref('QuizState/TimeRemaining').on('value', s => { 
    let t = s.val(); timerDisplay.innerText = t + "s"; 
    if (t <= 0) answerBtns.forEach(b => b.disabled = true); 
});
database.ref('QuizState/IsEnded').on('value', s => { if (s.val()) { questionScreen.classList.add('hidden'); waitingScreen.classList.add('hidden'); loginScreen.classList.add('hidden'); podiumMsg.innerText = "Fin du Quiz !"; podiumScreen.classList.remove('hidden'); } });
database.ref('QuizState/Podium').on('value', s => {
    const top = s.val();
    if (top && top.length > 0) {
        questionScreen.classList.add('hidden'); waitingScreen.classList.add('hidden'); loginScreen.classList.add('hidden');
        podiumMsg.innerText = top.includes(playerId) ? "Félicitations " + nicknameInput.value + " ! Tu es sur le podium !" : "Fin du Quiz ! Merci d'avoir participé.";
        podiumScreen.classList.remove('hidden');
    }
});

joinBtn.onclick = () => {
    const name = nicknameInput.value.trim(); if (!name || !isRegistrationOpen) return;
    database.ref('Players').once('value').then(s => {
        let taken = false; s.forEach(c => { if (c.val().Name.toLowerCase() === name.toLowerCase() && c.val().Id !== playerId) taken = true; });
        if (taken) { errorMsg.innerText = "Pseudo déjà utilisé."; errorMsg.classList.remove('hidden'); return; }
        database.ref('Players/' + playerId).set({ Id: playerId, Name: name, Score: 0, TotalResponseTimeMs: 0 }).then(() => {
            database.ref('Players/' + playerId).onDisconnect().remove();
            loginScreen.classList.add('hidden'); scoreHeader.classList.remove('hidden'); waitingScreen.classList.remove('hidden');
            waitingText.innerText = "Le quiz va commencer.\nTenez-vous prêt !";
        });
    });
};

answerBtns.forEach(b => b.onclick = (e) => {
    if (hasAnswered) return;
    hasAnswered = true; let idx = parseInt(e.target.dataset.index), time = Date.now() - questionStartTime;
    answerBtns.forEach(btn => { if (btn !== e.target) btn.style.opacity = '0.3'; });
    database.ref('Answers').push().set({ PlayerId: playerId, QuestionId: currentQuestionId, AnswerIndex: idx, ResponseTimeMs: time }).then(() => {
        setTimeout(() => { 
            questionScreen.classList.add('hidden'); 
            waitingScreen.classList.remove('hidden'); 
            waitingText.innerText = "Réponse envoyée !\nPréparez-vous pour la suite..."; 
        }, 800);
    });
});