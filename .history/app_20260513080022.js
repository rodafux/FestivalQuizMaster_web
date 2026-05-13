const firebaseConfig = { 
    databaseURL: "https://festivalquizmaster-default-rtdb.europe-west1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const loginScreen = document.getElementById('login-screen'), 
      waitingScreen = document.getElementById('waiting-screen'), 
      questionScreen = document.getElementById('question-screen'), 
      podiumScreen = document.getElementById('podium-screen');

const scoreHeader = document.getElementById('score-header'), 
      userScore = document.getElementById('user-score'), 
      timerDisplay = document.getElementById('timer-display'), 
      nicknameInput = document.getElementById('nickname');

const joinBtn = document.getElementById('join-btn'), 
      errorMsg = document.getElementById('error-msg'), 
      waitingText = document.getElementById('waiting-text'), 
      podiumMsg = document.getElementById('podium-msg'), 
      answerBtns = document.querySelectorAll('.answer-btn');

let playerId = localStorage.getItem('playerId') || 'p_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('playerId', playerId);

let isRegistrationOpen = false;
let isLocked = false; 
let currentQuestionId = null;
let questionStartTime = 0;
let hasAnswered = false;

// --- GESTION DU SUSPENSE ---
let actualScore = 0;
let correctAnswerIndex = -1;
let lastAnswerIndex = -1;
let answerRevealed = false;

// CORRECTION : Mémoire tampon pour contrer les bugs de vitesse réseau
let globalCurrentQuestion = null;

function showScreen(screenName) {
    loginScreen.classList.add('hidden');
    waitingScreen.classList.add('hidden');
    questionScreen.classList.add('hidden');
    podiumScreen.classList.add('hidden');
    
    if (screenName === 'login') loginScreen.classList.remove('hidden');
    else if (screenName === 'waiting') waitingScreen.classList.remove('hidden');
    else if (screenName === 'question') questionScreen.classList.remove('hidden');
    else if (screenName === 'podium') podiumScreen.classList.remove('hidden');
}

function syncQuestion(q) {
    if (!q || !isRegistrationOpen) return;
    if (q.Id !== currentQuestionId) {
        currentQuestionId = q.Id; 
        hasAnswered = false; 
        
        lastAnswerIndex = -1;
        correctAnswerIndex = q.CorrectOptionIndex;
        answerRevealed = false; 
        
        questionStartTime = Date.now();
        answerBtns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
        showScreen('question');
    }
}

function evaluateState() {
    if (!isRegistrationOpen) {
        showScreen('waiting');
        scoreHeader.classList.add('hidden');
        waitingText.innerText = "Préparez-vous à vous inscrire.\nLe quiz ouvrira bientôt ses portes.";
        userScore.innerText = "0";
    } else {
        database.ref('Players/' + playerId).once('value').then(ps => {
            if (ps.exists()) {
                scoreHeader.classList.remove('hidden');
                if (!isLocked) {
                    showScreen('waiting');
                    waitingText.innerText = "Le quiz va commencer.\nTenez-vous prêt !";
                } else {
                    // CORRECTION ICI : Si le quiz a démarré et qu'on a raté l'affichage de la Q1, on la force
                    if (globalCurrentQuestion && globalCurrentQuestion.Id !== currentQuestionId) {
                        syncQuestion(globalCurrentQuestion);
                    } else if (!currentQuestionId) {
                        showScreen('waiting');
                        waitingText.innerText = "En attente de la prochaine question...";
                    }
                }
            } else {
                scoreHeader.classList.add('hidden');
                if (isLocked) {
                    showScreen('waiting');
                    waitingText.innerText = "Le quiz a déjà commencé !\nVeuillez patienter jusqu'à la prochaine partie.";
                } else {
                    showScreen('login');
                }
            }
        });
    }
}

database.ref('QuizState/RegistrationOpen').on('value', s => { isRegistrationOpen = s.val() || false; evaluateState(); });
database.ref('QuizState/IsLocked').on('value', s => { isLocked = s.val() || false; evaluateState(); });

// CORRECTION : Sauvegarde de la question en amont
database.ref('CurrentQuestion').on('value', s => {
    globalCurrentQuestion = s.val();
    if (isLocked && isRegistrationOpen) {
        database.ref('Players/' + playerId).once('value').then(ps => { if (ps.exists()) syncQuestion(globalCurrentQuestion); });
    }
});

database.ref('Players/' + playerId).on('value', s => { 
    if (s.val()) {
        actualScore = s.val().Score || 0; 
        if (!currentQuestionId || answerRevealed) {
            userScore.innerText = actualScore;
        }
    }
});

database.ref('QuizState/TimeRemaining').on('value', s => { 
    let t = s.val(); 
    if (t !== null) {
        timerDisplay.innerText = t + "s"; 
        if (t <= 0) answerBtns.forEach(b => b.disabled = true); 
    }
});

database.ref('QuizState/AnswerRevealed').on('value', s => {
    answerRevealed = s.val() || false;
    
    if (answerRevealed && currentQuestionId) {
        userScore.innerText = actualScore;
        showScreen('waiting'); 
        
        if (hasAnswered) {
            if (lastAnswerIndex === correctAnswerIndex) {
                waitingText.innerHTML = "<span style='color:#00FF00; font-size:40px; font-weight:bold;'>✅ BONNE RÉPONSE !</span><br><br>Ton score a été mis à jour.";
            } else {
                const optionLetters = ["A", "B", "C", "D"];
                waitingText.innerHTML = "<span style='color:#FF4444; font-size:40px; font-weight:bold;'>❌ MAUVAISE RÉPONSE</span><br><br>La bonne réponse était l'option " + optionLetters[correctAnswerIndex] + ".";
            }
        } else {
            waitingText.innerHTML = "<span style='color:#FFAA00; font-size:40px; font-weight:bold;'>⏳ TEMPS ÉCOULÉ !</span><br><br>Tu n'as pas répondu à temps.";
        }
    }
});

database.ref('QuizState/IsEnded').on('value', s => { 
    if (s.val()) {
        database.ref('Players/' + playerId).once('value').then(ps => {
            if (ps.exists()) { showScreen('podium'); podiumMsg.innerText = "Fin du Quiz !"; }
        });
    } 
});

database.ref('QuizState/Podium').on('value', s => {
    const top = s.val();
    if (top && top.length > 0) {
        database.ref('Players/' + playerId).once('value').then(ps => {
            if (ps.exists()) {
                showScreen('podium');
                let isWinner = top.includes(playerId);
                podiumMsg.innerText = isWinner ? "Félicitations " + nicknameInput.value + " !\nTu es sur le podium !" : "Fin du Quiz !\nMerci d'avoir participé.";
            }
        });
    }
});

joinBtn.onclick = () => {
    const name = nicknameInput.value.trim(); 
    if (!name || !isRegistrationOpen || isLocked) return;
    
    joinBtn.disabled = true;
    joinBtn.innerText = "Vérification...";
    
    database.ref('Players').once('value').then(s => {
        let taken = false; 
        s.forEach(c => { 
            if (c.val().Name.toLowerCase() === name.toLowerCase() && c.val().Id !== playerId) taken = true; 
        });
        
        if (taken) { 
            errorMsg.innerText = "Ce pseudo est déjà utilisé !"; 
            errorMsg.classList.remove('hidden'); 
            joinBtn.disabled = false;
            joinBtn.innerText = "C'est parti !";
            return; 
        }
        
        errorMsg.classList.add('hidden');
        database.ref('Players/' + playerId).set({ 
            Id: playerId, Name: name, Score: 0, TotalResponseTimeMs: 0 
        }).then(() => {
            database.ref('Players/' + playerId).onDisconnect().remove();
            joinBtn.disabled = false;
            joinBtn.innerText = "C'est parti !";
            evaluateState();
        }).catch(() => {
            joinBtn.disabled = false;
            joinBtn.innerText = "C'est parti !";
        });
    });
};

answerBtns.forEach(b => b.onclick = (e) => {
    if (hasAnswered) return;
    hasAnswered = true; 
    lastAnswerIndex = parseInt(e.target.dataset.index);
    let time = Date.now() - questionStartTime;
    answerBtns.forEach(btn => { if (btn !== e.target) btn.style.opacity = '0.3'; });
    
    database.ref('Answers').push().set({ 
        PlayerId: playerId, QuestionId: currentQuestionId, AnswerIndex: lastAnswerIndex, ResponseTimeMs: time 
    }).then(() => {
        setTimeout(() => { 
            if (!answerRevealed) {
                showScreen('waiting'); 
                waitingText.innerText = "Réponse envoyée !\nEn attente du résultat..."; 
            }
        }, 800);
    });
});