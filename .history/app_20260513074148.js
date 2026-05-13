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
let isLocked = false; // Permet de savoir si le quiz a démarré
let currentQuestionId = null;
let questionStartTime = 0;
let hasAnswered = false;

// Fonction de gestion des affichages
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

// Fonction pour synchroniser la question
function syncQuestion(q) {
    if (!q || !isRegistrationOpen) return;
    if (q.Id !== currentQuestionId) {
        currentQuestionId = q.Id; 
        hasAnswered = false; 
        questionStartTime = Date.now();
        answerBtns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
        showScreen('question');
    }
}

// Évalue le droit d'accès et l'écran à afficher selon l'état
function evaluateState() {
    if (!isRegistrationOpen) {
        // La régie a fermé le quiz / a cliqué sur Réinitialiser
        showScreen('waiting');
        scoreHeader.classList.add('hidden');
        waitingText.innerText = "Préparez-vous à vous inscrire.\nLe quiz ouvrira bientôt ses portes.";
        userScore.innerText = "0";
    } else {
        // Vérifie si l'utilisateur fait partie des joueurs inscrits
        database.ref('Players/' + playerId).once('value').then(ps => {
            if (ps.exists()) {
                scoreHeader.classList.remove('hidden');
                if (isLocked && currentQuestionId) {
                    // Joueur légitime en cours de partie
                } else {
                    showScreen('waiting');
                    waitingText.innerText = isLocked ? "En attente de la prochaine question..." : "Le quiz va commencer.\nTenez-vous prêt !";
                }
            } else {
                scoreHeader.classList.add('hidden');
                // L'utilisateur n'est pas dans la liste des joueurs
                if (isLocked) {
                    // CORRECTION : Le quiz a commencé et l'utilisateur a raté le train
                    showScreen('waiting');
                    waitingText.innerText = "Le quiz a déjà commencé !\nVeuillez patienter jusqu'à la prochaine partie.";
                } else {
                    // Le quiz est ouvert aux inscriptions
                    showScreen('login');
                }
            }
        });
    }
}

// Écoutes de l'état global venant de la Régie
database.ref('QuizState/RegistrationOpen').on('value', s => {
    isRegistrationOpen = s.val() || false;
    evaluateState();
});

database.ref('QuizState/IsLocked').on('value', s => {
    isLocked = s.val() || false;
    evaluateState();
});

// Écoute de la question en cours (Sécurité : seuls les inscrits y accèdent)
database.ref('CurrentQuestion').on('value', s => {
    if (isLocked && isRegistrationOpen) {
        database.ref('Players/' + playerId).once('value').then(ps => {
            if (ps.exists()) syncQuestion(s.val());
        });
    }
});

database.ref('Players/' + playerId).on('value', s => { 
    if (s.val()) userScore.innerText = s.val().Score || 0; 
});

database.ref('QuizState/TimeRemaining').on('value', s => { 
    let t = s.val(); 
    if (t !== null) {
        timerDisplay.innerText = t + "s"; 
        if (t <= 0) answerBtns.forEach(b => b.disabled = true); 
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

// CORRECTION : Inscription sécurisée (bloque le double clic et gère les espaces)
joinBtn.onclick = () => {
    const name = nicknameInput.value.trim(); // .trim() retire les espaces à la fin
    if (!name || !isRegistrationOpen || isLocked) return;
    
    // On désactive le bouton immédiatement pour empêcher le double-clic accidentel
    joinBtn.disabled = true;
    joinBtn.innerText = "Vérification...";
    
    database.ref('Players').once('value').then(s => {
        let taken = false; 
        s.forEach(c => { 
            // Comparaison stricte sans se soucier des majuscules/minuscules
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
            Id: playerId, 
            Name: name, 
            Score: 0, 
            TotalResponseTimeMs: 0 
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
    let idx = parseInt(e.target.dataset.index), time = Date.now() - questionStartTime;
    answerBtns.forEach(btn => { if (btn !== e.target) btn.style.opacity = '0.3'; });
    
    database.ref('Answers').push().set({ 
        PlayerId: playerId, 
        QuestionId: currentQuestionId, 
        AnswerIndex: idx, 
        ResponseTimeMs: time 
    }).then(() => {
        setTimeout(() => { 
            showScreen('waiting'); 
            waitingText.innerText = "Réponse envoyée !\nPréparez-vous pour la suite..."; 
        }, 800);
    });
});