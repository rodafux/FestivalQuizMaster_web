const firebaseConfig = {
    databaseURL: "https://festivalquizmaster-default-rtdb.europe-west1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const loginScreen = document.getElementById('login-screen');
const waitingScreen = document.getElementById('waiting-screen');
const questionScreen = document.getElementById('question-screen');
const podiumScreen = document.getElementById('podium-screen');
const nicknameInput = document.getElementById('nickname');
const joinBtn = document.getElementById('join-btn');
const errorMsg = document.getElementById('error-msg');
const questionText = document.getElementById('question-text');
const waitingText = document.getElementById('waiting-text');
const podiumMsg = document.getElementById('podium-msg');
const answerBtns = document.querySelectorAll('.answer-btn');

let playerId = localStorage.getItem('playerId');
if (!playerId) {
    playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('playerId', playerId);
}

let isRegistrationOpen = false;
let isLocked = false;
let currentQuestionId = null;
let questionStartTime = 0;
let hasAnswered = false;

window.addEventListener('beforeunload', () => {
    if (playerId) {
        database.ref('Players/' + playerId).remove();
    }
});

database.ref('QuizState/RegistrationOpen').on('value', (snapshot) => {
    isRegistrationOpen = snapshot.val() || false;
    if (!isRegistrationOpen) {
        database.ref('Players/' + playerId).remove();
        loginScreen.classList.remove('hidden');
        waitingScreen.classList.add('hidden');
        questionScreen.classList.add('hidden');
        podiumScreen.classList.add('hidden');
        errorMsg.innerText = "Les inscriptions ne sont pas encore ouvertes.";
        errorMsg.classList.remove('hidden');
    } else {
        errorMsg.classList.add('hidden');
    }
});

database.ref('Players/' + playerId).on('value', (snapshot) => {
    if (isRegistrationOpen && !snapshot.exists() && !loginScreen.classList.contains('hidden')) {
        return;
    }
    if (isRegistrationOpen && !snapshot.exists() && loginScreen.classList.contains('hidden')) {
        location.reload();
    }
});

database.ref('QuizState/IsEnded').on('value', (snapshot) => {
    if (snapshot.val() === true) {
        if (!podiumScreen.classList.contains('hidden')) return;
        questionScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        loginScreen.classList.add('hidden');
        podiumMsg.innerText = "Fin du Quiz !\nMerci d'avoir participé.";
        podiumScreen.classList.remove('hidden');
    }
});

database.ref('QuizState/IsLocked').on('value', (snapshot) => {
    isLocked = snapshot.val() || false;
});

database.ref('QuizState/Podium').on('value', (snapshot) => {
    const topPlayers = snapshot.val();
    if (topPlayers && topPlayers.length > 0) {
        questionScreen.classList.add('hidden');
        waitingScreen.classList.add('hidden');
        loginScreen.classList.add('hidden');
        if (topPlayers.includes(playerId)) {
            const nickname = nicknameInput.value.trim() || "Champion";
            podiumMsg.innerText = "Félicitations " + nickname + " !\nTu es sur le podium !";
        } else {
            podiumMsg.innerText = "Fin du Quiz !\nMerci d'avoir participé.";
        }
        podiumScreen.classList.remove('hidden');
    }
});

joinBtn.addEventListener('click', () => {
    const name = nicknameInput.value.trim();
    if (name.length === 0) return;

    if (!isRegistrationOpen) {
        errorMsg.innerText = "Les inscriptions sont fermées.";
        errorMsg.classList.remove('hidden');
        return;
    }

    if (isLocked) {
        errorMsg.innerText = "Le quiz est déjà en cours.";
        errorMsg.classList.remove('hidden');
        return;
    }

    database.ref('Players').once('value').then((snapshot) => {
        let isTaken = false;
        snapshot.forEach((childSnapshot) => {
            const p = childSnapshot.val();
            if (p && p.Name && p.Name.toLowerCase() === name.toLowerCase() && p.Id !== playerId) {
                isTaken = true;
            }
        });

        if (isTaken) {
            errorMsg.innerText = "Ce pseudo est déjà utilisé.";
            errorMsg.classList.remove('hidden');
            return;
        }

        database.ref('Players/' + playerId).set({
            Id: playerId,
            Name: name,
            Score: 0,
            TotalResponseTimeMs: 0
        }).then(() => {
            database.ref('Players/' + playerId).onDisconnect().remove();
            loginScreen.classList.add('hidden');
            waitingScreen.classList.remove('hidden');
            podiumScreen.classList.add('hidden');
        });
    });
});

database.ref('CurrentQuestion').on('value', (snapshot) => {
    const question = snapshot.val();
    if (!question || !isRegistrationOpen) return;

    if (question.Id !== currentQuestionId) {
        currentQuestionId = question.Id;
        hasAnswered = false;
        questionStartTime = Date.now();
        answerBtns.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        if (loginScreen.classList.contains('hidden') && podiumScreen.classList.contains('hidden')) {
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
            if (b !== e.target) b.style.opacity = '0.3';
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