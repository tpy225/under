const socket = io();

// DOM Elements - Containers
const lobbyArea = document.getElementById('lobby-area');
const roomArea = document.getElementById('room-area');
const views = document.querySelectorAll('.view');

// DOM Elements - Home & Create
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const showCreateViewBtn = document.getElementById('show-create-view-btn');
const backHomeBtn = document.getElementById('back-home-btn');

const gameModeSelect = document.getElementById('game-mode');
const maxPlayersInput = document.getElementById('max-players');
const undercoverCountInput = document.getElementById('undercover-count');
const enableWhitecardCheckbox = document.getElementById('enable-whitecard');
const hostWordsSetting = document.getElementById('host-words-setting');
const customWordsSetting = document.getElementById('custom-words-setting');
const customWordsInput = document.getElementById('custom-words-input');
const hostCivilianWord = document.getElementById('host-civilian-word');
const hostUndercoverWord = document.getElementById('host-undercover-word');
const createRoomBtn = document.getElementById('create-room-btn');

// DOM Elements - Room Header
const displayRoomCode = document.getElementById('display-room-code');
const playerCountDisplay = document.getElementById('player-count');
const leaveRoomBtn = document.getElementById('leave-room-btn');

// DOM Elements - Waiting View
const waitingPlayerGrid = document.getElementById('waiting-player-grid');
const hostControls = document.getElementById('host-controls');
const waitingText = document.getElementById('waiting-text');
const startGameBtn = document.getElementById('start-game-btn');

// DOM Elements - Role View
const myWordDisplay = document.getElementById('my-word');
const roleDescription = document.getElementById('role-description');
const rememberedBtn = document.getElementById('remembered-btn');

// DOM Elements - Speech View
const roundNumberDisplay = document.getElementById('round-number');
const aliveCountDisplay = document.getElementById('alive-count');
const speechPlayerGrid = document.getElementById('speech-player-grid');
const speechLog = document.getElementById('speech-log');
const hostSpeechControls = document.getElementById('host-speech-controls');
const nextSpeakerBtn = document.getElementById('next-speaker-btn');
const speechTimerDisplay = document.getElementById('speech-timer');

// DOM Elements - Vote View
const votePlayerGrid = document.getElementById('vote-player-grid');
const submitVoteBtn = document.getElementById('submit-vote-btn');

// DOM Elements - Result View
const resultTitle = document.getElementById('result-title');
const resultRole = document.getElementById('result-role');
const whitecardGuessSection = document.getElementById('whitecard-guess-section');
const whitecardGuessInput = document.getElementById('whitecard-guess-input');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const gameOverSection = document.getElementById('game-over-section');
const winnerText = document.getElementById('winner-text');
const revealCivilian = document.getElementById('reveal-civilian');
const revealUndercover = document.getElementById('reveal-undercover');
const nextRoundBtn = document.getElementById('next-round-btn');
const backToWaitingBtn = document.getElementById('back-to-waiting-btn');
const waitingHostNextMsg = document.getElementById('waiting-host-next-msg');

// DOM Elements - Live Chat & Inputs
const chatMessages = document.getElementById('chat-messages');
const chatInputArea = document.getElementById('chat-input-area');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const speechInputArea = document.getElementById('speech-input-area');
const speechInput = document.getElementById('speech-input');
const sendSpeechBtn = document.getElementById('send-speech-btn');

// State
let currentRoomCode = null;
let isHost = false;
let myId = null;
let selectedVoteId = null;
let roomStateData = null; // store latest room info
let speechTimerInterval = null;

// Force End Button
const forceEndBtn = document.createElement('button');
forceEndBtn.id = 'force-end-btn';
forceEndBtn.className = 'hidden fixed top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-lg z-50 hover:bg-red-700 transition';
forceEndBtn.textContent = '强制结束';
document.body.appendChild(forceEndBtn);

forceEndBtn.addEventListener('click', () => {
    if (confirm('确定要强制结束游戏吗？')) {
        socket.emit('forceEndGame', currentRoomCode);
    }
});

// Helper: View Switching (App style jump)
function showView(viewId) {
    views.forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    target.classList.remove('hidden');
    target.classList.add('active');

    if (viewId === 'home-view' || viewId === 'create-room-view') {
        lobbyArea.classList.remove('hidden');
        lobbyArea.classList.add('flex');
        roomArea.classList.add('hidden');
        roomArea.classList.remove('flex');
    } else {
        lobbyArea.classList.add('hidden');
        lobbyArea.classList.remove('flex');
        roomArea.classList.remove('hidden');
        roomArea.classList.add('flex');
    }
}

// Helper: Generate Avatar HTML
const EMOTICONS = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','豹','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔'];
const COLORS = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}

function getAvatarHTML(player, isMe, isHostFlag, isDead = false, isSpeaking = false, isSelected = false) {
    const hash = Math.abs(hashCode(player.name || ''));
    const emoji = EMOTICONS[hash % EMOTICONS.length];
    
    // Background and opacity based on state
    let bg = COLORS[hash % COLORS.length];
    if (isDead) bg = 'bg-gray-600';
    if (isSelected) bg = 'bg-green-500';
    
    const opacity = (isDead || player.connected === false) ? 'opacity-40' : 'opacity-100';
    const border = isSpeaking ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-gray-900 scale-110' : '';
    const textCol = isMe ? 'text-yellow-400 font-black' : 'text-gray-200';
    
    const offlineTag = (player.connected === false && !isDead) ? '<span class="absolute -bottom-2 bg-red-600 text-white text-[10px] px-1 rounded">离线</span>' : '';

    return `
        <div class="flex flex-col items-center justify-center transition-all duration-300 ${opacity}">
            <div class="w-14 h-14 ${bg} rounded-full flex items-center justify-center text-3xl shadow-lg relative ${border}">
                ${emoji}
                ${isHostFlag ? '<span class="absolute -top-2 -right-2 text-xl drop-shadow-md">👑</span>' : ''}
                ${isSelected ? '<span class="absolute -bottom-1 -right-1 bg-white text-green-500 rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span>' : ''}
                ${offlineTag}
            </div>
            <div class="text-xs mt-2 text-center truncate w-20 ${textCol}">
                ${player.name}
            </div>
        </div>
    `;
}

// Socket Connection
socket.on('connect', () => {
    myId = socket.id;
    // 尝试重连
    const savedRoom = localStorage.getItem('uc_room');
    const savedName = localStorage.getItem('uc_name');
    if (savedRoom && savedName) {
        socket.emit('reconnectPlayer', { roomCode: savedRoom, playerName: savedName });
    }
});

socket.on('error', (msg) => {
    alert(msg);
});

// UI Logic - Lobby Area
showCreateViewBtn.addEventListener('click', () => showView('create-room-view'));
backHomeBtn.addEventListener('click', () => showView('home-view'));

gameModeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'host') {
        hostWordsSetting.classList.remove('hidden');
        customWordsSetting.classList.add('hidden');
    } else {
        hostWordsSetting.classList.add('hidden');
        customWordsSetting.classList.remove('hidden');
    }
});

createRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert('请输入昵称');

    const mode = gameModeSelect.value;
    const maxPlayers = maxPlayersInput.value;
    const undercoverCount = undercoverCountInput.value;
    const enableWhitecard = enableWhitecardCheckbox.checked;
    
    let hostWords = null;
    let customWords = [];
    
    if (mode === 'host') {
        const cWord = hostCivilianWord.value.trim();
        const uWord = hostUndercoverWord.value.trim();
        if (!cWord || !uWord) return alert('请输入平民词和卧底词');
        hostWords = { civilian: cWord, undercover: uWord };
    } else {
        const customText = customWordsInput.value.trim();
        if (customText) {
            const lines = customText.split('\n');
            for (let line of lines) {
                const parts = line.split(/[,，\s]+/);
                if (parts.length >= 2 && parts[0] && parts[1]) {
                    customWords.push({ civilian: parts[0], undercover: parts[1] });
                }
            }
        }
    }

    socket.emit('createRoom', { mode, maxPlayers, undercoverCount, enableWhitecard, hostWords, customWords }, (res) => {
        if (res.success) {
            socket.emit('joinRoom', { roomCode: res.roomCode, playerName: name }, (joinRes) => {
                if (joinRes.success) {
                    currentRoomCode = res.roomCode;
                    isHost = true;
                    localStorage.setItem('uc_room', res.roomCode);
                    localStorage.setItem('uc_name', name);
                    updateWaitingRoom(joinRes.room);
                    showView('waiting-view');
                }
            });
        }
    });
});

joinRoomBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    
    if (!name) return alert('请输入昵称');
    if (!code) return alert('请输入房间码');

    socket.emit('joinRoom', { roomCode: code, playerName: name }, (res) => {
        if (res.success) {
            currentRoomCode = code;
            isHost = res.isHost;
            localStorage.setItem('uc_room', code);
            localStorage.setItem('uc_name', name);
            updateWaitingRoom(res.room);
            showView('waiting-view');
        } else {
            alert(res.message);
        }
    });
});

leaveRoomBtn.addEventListener('click', () => {
    if (confirm('确定要离开房间吗？')) {
        socket.emit('leaveRoom', currentRoomCode);
        currentRoomCode = null;
        isHost = false;
        localStorage.removeItem('uc_room');
        localStorage.removeItem('uc_name');
        forceEndBtn.classList.add('hidden');
        showView('home-view');
    }
});

// Socket Events - Waiting Room
socket.on('roomUpdated', (room) => {
    roomStateData = room;
    if(room.state === 'waiting') {
        updateWaitingRoom(room);
    }
});

function updateWaitingRoom(room) {
    displayRoomCode.textContent = room.code;
    playerCountDisplay.textContent = `${room.players.length}/${room.maxPlayers}`;
    
    waitingPlayerGrid.innerHTML = '';
    room.players.forEach(p => {
        const el = document.createElement('div');
        el.innerHTML = getAvatarHTML(p, p.id === myId, p.id === room.hostId, !p.isAlive);
        waitingPlayerGrid.appendChild(el);
    });

    if (isHost) {
        hostControls.style.display = 'block';
        waitingText.style.display = 'none';
    } else {
        hostControls.style.display = 'none';
        waitingText.style.display = 'block';
    }
}

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', currentRoomCode);
});

// Socket Events - Game Flow
socket.on('gameStarted', (data) => {
    if (isHost) forceEndBtn.classList.remove('hidden');

    const me = data.players.find(p => p.id === myId);
    if (me) {
        if (me.role === 'mc') {
            myWordDisplay.textContent = "主持人";
            roleDescription.textContent = "你是本局的主持人，负责控场和推进游戏进程。";
        } else if (me.role === 'whitecard') {
            myWordDisplay.textContent = "你是白卡";
            roleDescription.textContent = "你没有词语，请根据他人发言伪装自己！";
        } else {
            myWordDisplay.textContent = me.word;
            roleDescription.textContent = "请记住你的词语，不要让别人看到";
        }
        showView('role-view');
        
        // Ensure chat and speech inputs are hidden/shown properly
        chatInputArea.classList.remove('hidden');
        speechInputArea.classList.add('hidden');
        speechLog.innerHTML = '';
    }
});

rememberedBtn.addEventListener('click', () => {
    myWordDisplay.textContent = '***';
    rememberedBtn.textContent = '等待其他人...';
    rememberedBtn.disabled = true;
    
    if (isHost) {
        socket.emit('enterSpeechPhase', currentRoomCode);
    }
});

// Speech Phase
socket.on('speechPhaseStarted', (data) => {
    rememberedBtn.textContent = '我已记住';
    rememberedBtn.disabled = false;
    
    roundNumberDisplay.textContent = data.round;
    aliveCountDisplay.textContent = data.aliveCount;
    
    speechLog.innerHTML = ''; // Clear speech log for new round
    updateSpeechView(data);
    startSpeechTimer(data.timeLeft || 180);
    showView('speech-view');
});

// Timer logic
function startSpeechTimer(seconds) {
    clearInterval(speechTimerInterval);
    speechTimerDisplay.classList.remove('hidden');
    let timeLeft = seconds;
    
    const updateDisplay = () => {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        speechTimerDisplay.textContent = `${m}:${s}`;
        
        if (timeLeft <= 10) {
            speechTimerDisplay.classList.add('bg-red-600');
        } else {
            speechTimerDisplay.classList.remove('bg-red-600');
        }
    };
    
    updateDisplay();
    speechTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(speechTimerInterval);
            speechTimerDisplay.classList.add('hidden');
        } else {
            updateDisplay();
        }
    }, 1000);
}

socket.on('speechUpdated', (data) => {
    updateSpeechView(data);
    startSpeechTimer(data.timeLeft || 180);
});

function updateSpeechView(data) {
    speechPlayerGrid.innerHTML = '';
    
    // Using roomStateData to get full player names and host status
    data.order.forEach(p => {
        const fullPlayer = roomStateData.players.find(rp => rp.id === p.id) || p;
        const isSpeaking = p.id === data.currentSpeaker.id;
        
        const el = document.createElement('div');
        el.className = isSpeaking ? 'order-first' : ''; // Bring speaker to front visually if needed, or just let grid place them
        el.innerHTML = getAvatarHTML(fullPlayer, p.id === myId, fullPlayer.id === roomStateData.hostId, false, isSpeaking);
        speechPlayerGrid.appendChild(el);
    });

    // Control Inputs
    if (data.currentSpeaker.id === myId) {
        speechInputArea.classList.remove('hidden');
        chatInputArea.classList.add('hidden'); // hide normal chat to focus on speech
        speechInput.focus();
    } else {
        speechInputArea.classList.add('hidden');
        chatInputArea.classList.remove('hidden');
    }

    if (isHost) {
        hostSpeechControls.classList.remove('hidden');
    } else {
        hostSpeechControls.classList.add('hidden');
    }
}

sendSpeechBtn.addEventListener('click', () => {
    const text = speechInput.value.trim();
    if (!text) return;
    
    socket.emit('sendSpeech', { roomCode: currentRoomCode, text });
    speechInput.value = '';
    speechInputArea.classList.add('hidden');
    chatInputArea.classList.remove('hidden');
});

speechInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendSpeechBtn.click();
});

socket.on('speechMessage', (data) => {
    // Add to speech log
    const logEl = document.createElement('div');
    logEl.className = "bg-gray-700 bg-opacity-40 p-2 rounded-lg";
    logEl.innerHTML = `<span class="font-bold text-yellow-400">${data.sender}:</span> <span class="text-gray-200 break-words">${data.text}</span>`;
    speechLog.appendChild(logEl);
    speechLog.scrollTop = speechLog.scrollHeight;

    // Also broadcast to live chat as a system message
    addChatBubble(data.sender, data.text, true);
});

nextSpeakerBtn.addEventListener('click', () => {
    socket.emit('nextSpeaker', currentRoomCode);
});

socket.on('speechEnded', () => {
    clearInterval(speechTimerInterval);
    speechTimerDisplay.classList.add('hidden');
    // Replace grid with a "Discussion" state
    speechPlayerGrid.innerHTML = `<div class="col-span-4 text-center text-gray-400 py-4 font-bold tracking-widest">自由讨论阶段...</div>`;
    speechInputArea.classList.add('hidden');
    chatInputArea.classList.remove('hidden');
    
    if (isHost) {
        hostSpeechControls.classList.add('hidden');
        // Change next button to vote button dynamically or just use a fixed one
        hostSpeechControls.innerHTML = `<button id="go-to-vote-btn" class="w-full bg-red-600 text-white py-3 rounded-lg text-lg font-black shadow-md active:scale-95 transition">结束讨论，进入投票</button>`;
        hostSpeechControls.classList.remove('hidden');
        
        document.getElementById('go-to-vote-btn').addEventListener('click', () => {
            socket.emit('enterVotePhase', currentRoomCode);
        });
    }
});

// Vote Phase
socket.on('voteStarted', (data) => {
    votePlayerGrid.innerHTML = '';
    selectedVoteId = null;
    submitVoteBtn.disabled = true;
    submitVoteBtn.textContent = '确认投票';

    const amIAlive = data.alivePlayers.some(p => p.id === myId);

    data.alivePlayers.forEach(p => {
        const fullPlayer = roomStateData.players.find(rp => rp.id === p.id) || p;
        const el = document.createElement('div');
        el.className = 'cursor-pointer';
        
        const renderAvatar = (selected) => {
            el.innerHTML = getAvatarHTML(fullPlayer, p.id === myId, fullPlayer.id === roomStateData.hostId, false, false, selected);
        };
        renderAvatar(false);
        
        if (amIAlive) {
            el.addEventListener('click', () => {
                // Reset all
                Array.from(votePlayerGrid.children).forEach((child, idx) => {
                    const otherP = data.alivePlayers[idx];
                    const otherFull = roomStateData.players.find(rp => rp.id === otherP.id) || otherP;
                    child.innerHTML = getAvatarHTML(otherFull, otherP.id === myId, otherFull.id === roomStateData.hostId, false, false, false);
                });
                // Set selected
                renderAvatar(true);
                selectedVoteId = p.id;
                submitVoteBtn.disabled = false;
            });
        }
        votePlayerGrid.appendChild(el);
    });

    if (!amIAlive) {
        submitVoteBtn.textContent = '你已出局，正在观战';
    }

    showView('vote-view');
});

submitVoteBtn.addEventListener('click', () => {
    if (selectedVoteId) {
        socket.emit('submitVote', { roomCode: currentRoomCode, votedForId: selectedVoteId });
        submitVoteBtn.disabled = true;
        submitVoteBtn.textContent = '等待其他人投票...';
    }
});

socket.on('voteProgress', (count) => {
    if (submitVoteBtn.disabled && submitVoteBtn.textContent !== '你已出局，正在观战') {
        submitVoteBtn.textContent = `已投票 ${count} 人...`;
    }
});

// Result Phase
socket.on('voteResult', (data) => {
    const { eliminated, isWhitecard } = data;
    
    resultTitle.textContent = `${eliminated.name} 出局`;
    let roleText = eliminated.role === 'civilian' ? '平民' : (eliminated.role === 'undercover' ? '卧底' : '白卡');
    resultRole.innerHTML = `TA的身份是: <span class="font-bold text-white">${roleText}</span>`;
    
    whitecardGuessSection.classList.add('hidden');
    gameOverSection.classList.add('hidden');
    nextRoundBtn.classList.add('hidden');
    backToWaitingBtn.classList.add('hidden');
    waitingHostNextMsg.classList.add('hidden');

    if (isWhitecard && eliminated.id === myId) {
        whitecardGuessSection.classList.remove('hidden');
    }

    showView('result-view');
});

submitGuessBtn.addEventListener('click', () => {
    const guess = whitecardGuessInput.value.trim();
    if (!guess) return alert('请输入猜测的词语');
    socket.emit('whitecardGuess', { roomCode: currentRoomCode, guess });
    whitecardGuessSection.classList.add('hidden');
});

socket.on('readyForNextRound', () => {
    if (isHost) {
        nextRoundBtn.classList.remove('hidden');
    } else {
        waitingHostNextMsg.classList.remove('hidden');
    }
});

nextRoundBtn.addEventListener('click', () => {
    socket.emit('nextRound', currentRoomCode);
});

socket.on('gameOver', (data) => {
    const { winner, words } = data;
    
    whitecardGuessSection.classList.add('hidden');
    gameOverSection.classList.remove('hidden');
    waitingHostNextMsg.classList.add('hidden');
    
    winnerText.textContent = `${winner} 胜利！`;
    winnerText.className = `text-2xl font-black mb-6 ${winner === '平民' ? 'text-green-400' : (winner === '卧底' ? 'text-red-500' : 'text-yellow-400')}`;
    
    revealCivilian.textContent = words.civilian;
    revealUndercover.textContent = words.undercover;

    if (isHost) {
        nextRoundBtn.classList.add('hidden');
        backToWaitingBtn.classList.remove('hidden');
    } else {
        waitingHostNextMsg.classList.remove('hidden');
    }
});

backToWaitingBtn.addEventListener('click', () => {
    socket.emit('backToWaiting', currentRoomCode);
});

socket.on('backToWaiting', () => {
    forceEndBtn.classList.add('hidden');
    // Reset host controls
    if (isHost) {
        hostSpeechControls.innerHTML = `<button id="next-speaker-btn" class="w-full bg-gray-700 text-gray-300 py-2 rounded-lg text-sm font-bold hover:bg-gray-600 transition">强制跳过当前玩家(房主)</button>`;
        document.getElementById('next-speaker-btn').addEventListener('click', () => {
            socket.emit('nextSpeaker', currentRoomCode);
        });
    }
    showView('waiting-view');
});

// ================== Live Chat Logic ==================

function addChatBubble(sender, text, isSystem = false) {
    const el = document.createElement('div');
    el.className = "chat-bubble mb-2";
    
    if (isSystem) {
        // Broadcast speech or system message
        el.innerHTML = `
            <div class="bg-yellow-500 bg-opacity-90 inline-block px-3 py-1.5 rounded-2xl max-w-[90%] shadow-md border border-yellow-400">
                <span class="text-gray-900 font-black text-xs uppercase mr-1">发言</span>
                <span class="text-black font-bold">${sender}:</span> 
                <span class="text-gray-900 font-medium">${text}</span>
            </div>
        `;
    } else {
        // Normal chat
        const isMe = sender === roomStateData?.players.find(p=>p.id === myId)?.name;
        const nameColor = isMe ? 'text-indigo-300' : 'text-blue-300';
        el.innerHTML = `
            <div class="bg-gray-800 bg-opacity-80 inline-block px-3 py-1.5 rounded-2xl max-w-[85%] border border-gray-700 shadow-sm backdrop-blur-sm">
                <span class="${nameColor} font-bold mr-1">${sender}:</span> 
                <span class="text-gray-100">${text}</span>
            </div>
        `;
    }
    
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatSendBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text || !currentRoomCode) return;
    
    socket.emit('chatMessage', { roomCode: currentRoomCode, text });
    chatInput.value = '';
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') chatSendBtn.click();
});

socket.on('chatMessage', (data) => {
    addChatBubble(data.sender, data.text);
});
