const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 词库 (自动模式)
const wordPairs = [
    { civilian: '苹果', undercover: '芒果' },
    { civilian: '手机', undercover: '电脑' },
    { civilian: '牛肉', undercover: '羊肉' },
    { civilian: '啤酒', undercover: '白酒' },
    { civilian: '高铁', undercover: '飞机' },
    { civilian: '护士', undercover: '医生' },
    { civilian: '吉他', undercover: '贝斯' },
    { civilian: '警察', undercover: '保安' }
];

// 存储数据
const rooms = {}; 
// rooms[roomCode] = { code, hostId, mode, maxPlayers, undercoverCount, enableWhitecard, hostWords: { civilian, undercover }, state, players: [], round, speechOrder, currentSpeakerIndex, votes, aliveCount, words: { civilian, undercover }, winner }

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function nextSpeakerAction(room) {
    if (room.speechTimer) {
        clearTimeout(room.speechTimer);
        room.speechTimer = null;
    }

    room.currentSpeakerIndex++;
    
    // Skip disconnected or dead players automatically
    while(room.currentSpeakerIndex < room.speechOrder.length) {
        const nextSp = room.speechOrder[room.currentSpeakerIndex];
        const realPlayer = room.players.find(p => p.id === nextSp.id);
        if (realPlayer && realPlayer.connected && realPlayer.isAlive) {
            break;
        }
        room.currentSpeakerIndex++;
    }

    if (room.currentSpeakerIndex >= room.speechOrder.length) {
        room.state = 'speech_end';
        io.to(room.code).emit('speechEnded');
    } else {
        io.to(room.code).emit('speechUpdated', {
            currentSpeaker: room.speechOrder[room.currentSpeakerIndex],
            order: room.speechOrder,
            timeLeft: 180
        });
        
        // Set new timer
        room.speechTimer = setTimeout(() => {
            nextSpeakerAction(room);
        }, 180 * 1000);
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 创建房间
    socket.on('createRoom', (data, callback) => {
        const roomCode = generateRoomCode();
        let maxPlayers = parseInt(data.maxPlayers) || 6;
        if (data.mode === 'host') {
            maxPlayers += 1;
        }
        rooms[roomCode] = {
            code: roomCode,
            hostId: socket.id,
            mode: data.mode, // 'auto' or 'host'
            maxPlayers: maxPlayers,
            undercoverCount: parseInt(data.undercoverCount) || 1,
            enableWhitecard: data.enableWhitecard || false,
            hostWords: data.hostWords || { civilian: '', undercover: '' },
            customWords: data.customWords || [], // 用户填写的自定义词库
            state: 'waiting',
            players: [],
            round: 0,
            speechOrder: [],
            currentSpeakerIndex: 0,
            speechTimer: null, // 发言倒计时
            words: null,
            winner: null
        };
        callback({ success: true, roomCode });
    });

    // 重连逻辑
    socket.on('reconnectPlayer', (data) => {
        const { roomCode, playerName } = data;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players.find(p => p.name === playerName);
        if (player) {
            // 更新 socket id
            const oldId = player.id;
            player.id = socket.id;
            player.connected = true; // 标记在线
            
            // 如果他是房主，更新房主 ID
            if (room.hostId === oldId) {
                room.hostId = socket.id;
            }

            // 更新发言顺序里的 ID
            if (room.speechOrder) {
                const sp = room.speechOrder.find(p => p.name === playerName);
                if (sp) sp.id = socket.id;
            }

            socket.join(roomCode);
            io.to(roomCode).emit('roomUpdated', getRoomInfo(room));
            
            // 如果在游戏中，单独发给他当前状态
            if (room.state !== 'waiting') {
                socket.emit('gameStarted', {
                    state: room.state,
                    players: room.players.map(p => ({ id: p.id, role: p.role, word: p.word }))
                });
                
                if (room.state === 'speech') {
                    socket.emit('speechPhaseStarted', {
                        round: room.round,
                        aliveCount: room.aliveCount,
                        order: room.speechOrder,
                        currentSpeaker: room.speechOrder[room.currentSpeakerIndex],
                        timeLeft: 180 // 简单处理，发送完整时间或计算剩余时间
                    });
                } else if (room.state === 'vote') {
                    const alivePlayers = room.players.filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }));
                    socket.emit('voteStarted', { alivePlayers });
                }
            }
        }
    });

    // 离开房间 (主动退出)
    socket.on('leaveRoom', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) return;
        removePlayerFromRoom(room, socket.id, roomCode);
    });
    socket.on('joinRoom', (data, callback) => {
        const { roomCode, playerName } = data;
        const room = rooms[roomCode];

        if (!room) return callback({ success: false, message: '房间不存在' });
        if (room.state !== 'waiting') return callback({ success: false, message: '游戏已开始，无法加入' });
        if (room.players.length >= room.maxPlayers) return callback({ success: false, message: '房间已满' });
        
        // 检查名字是否重复
        if (room.players.find(p => p.name === playerName)) {
            return callback({ success: false, message: '昵称已被使用' });
        }

        const player = {
            id: socket.id,
            name: playerName,
            isAlive: true,
            connected: true,
            role: null, // 'civilian', 'undercover', 'whitecard'
            word: null
        };

        room.players.push(player);
        socket.join(roomCode);
        
        // 通知房间内所有人更新玩家列表
        io.to(roomCode).emit('roomUpdated', getRoomInfo(room));
        callback({ success: true, room: getRoomInfo(room), isHost: room.hostId === socket.id });
    });

    // 开始游戏
    socket.on('startGame', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id || room.state !== 'waiting') return;

        // 检查人数
        let activePlayers = room.players;
        if (room.mode === 'host') {
            activePlayers = room.players.filter(p => p.id !== room.hostId);
        }

        const activeCount = activePlayers.length;
        if (activeCount < 4) {
            socket.emit('error', room.mode === 'host' ? '除房主外至少需要4人才能开始' : '至少需要4人才能开始');
            return;
        }

        // 分配词语
        if (room.mode === 'auto') {
            const wordsPool = room.customWords.length > 0 ? room.customWords : wordPairs;
            const pair = wordsPool[Math.floor(Math.random() * wordsPool.length)];
            room.words = { civilian: pair.civilian, undercover: pair.undercover };
        } else {
            room.words = { civilian: room.hostWords.civilian, undercover: room.hostWords.undercover };
        }

        // 分配身份
        let roles = Array(activeCount).fill('civilian');
        let uCount = room.undercoverCount;
        let wCount = room.enableWhitecard ? 1 : 0;
        
        if (uCount + wCount >= activeCount - 1) {
            // 防止好人太少
            uCount = 1;
            wCount = 0;
        }

        for (let i = 0; i < uCount; i++) roles[i] = 'undercover';
        if (wCount > 0) roles[uCount] = 'whitecard';
        
        // 打乱身份
        roles.sort(() => Math.random() - 0.5);

        let roleIndex = 0;
        room.players.forEach((p) => {
            if (room.mode === 'host' && p.id === room.hostId) {
                p.role = 'mc';
                p.word = '主持人';
                p.isAlive = false;
            } else {
                p.role = roles[roleIndex++];
                if (p.role === 'civilian') p.word = room.words.civilian;
                else if (p.role === 'undercover') p.word = room.words.undercover;
                else if (p.role === 'whitecard') p.word = ''; // 白卡没有词
                p.isAlive = true;
            }
        });

        room.state = 'role';
        room.round = 1;
        room.aliveCount = activeCount;
        
        io.to(roomCode).emit('gameStarted', {
            state: room.state,
            players: room.players.map(p => ({ id: p.id, role: p.role, word: p.word }))
        });
    });

    // 所有人都确认记住了身份，进入发言阶段
    // 为简单起见，这里假设房主点击“开始发言”或者所有人点确认，我们由房主控制进入下一阶段
    socket.on('enterSpeechPhase', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;

        startSpeechRound(room);
    });

    // 聊天消息
    socket.on('chatMessage', (data) => {
        const { roomCode, text } = data;
        const room = rooms[roomCode];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            io.to(roomCode).emit('chatMessage', { sender: player.name, text });
        }
    });

    // 自动流转被移到了外面的 nextSpeakerAction
    // 原本连接里的 function 被删除，直接调用全局的
    
    // 玩家发送发言描述
    socket.on('sendSpeech', (data) => {
        const { roomCode, text } = data;
        const room = rooms[roomCode];
        if (!room || room.state !== 'speech') return;

        const currentSpeaker = room.speechOrder[room.currentSpeakerIndex];
        // 只有当前发言者才能发送
        if (currentSpeaker.id !== socket.id) return;

        // 广播发言内容
        io.to(roomCode).emit('speechMessage', {
            sender: currentSpeaker.name,
            text: text
        });

        // 自动流转到下一位
        nextSpeakerAction(room);
    });

    // 房主手动跳过发言者 (作为自动流转的兜底)
    socket.on('nextSpeaker', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;
        nextSpeakerAction(room);
    });

    // 进入投票阶段
    socket.on('enterVotePhase', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;

        room.state = 'vote';
        room.votes = {}; // playerId -> votedForId
        
        const alivePlayers = room.players.filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }));
        io.to(roomCode).emit('voteStarted', { alivePlayers });
    });

    // 提交投票
    socket.on('submitVote', (data) => {
        const { roomCode, votedForId } = data;
        const room = rooms[roomCode];
        if (!room || room.state !== 'vote') return;

        room.votes[socket.id] = votedForId;
        
        // 检查是否所有存活玩家都投票了
        const alivePlayers = room.players.filter(p => p.isAlive);
        if (Object.keys(room.votes).length >= alivePlayers.length) {
            processVotes(room);
        } else {
            io.to(roomCode).emit('voteProgress', Object.keys(room.votes).length);
        }
    });

    // 白卡猜词
    socket.on('whitecardGuess', (data) => {
        const { roomCode, guess } = data;
        const room = rooms[roomCode];
        if (!room) return;

        const isCorrect = guess === room.words.civilian;
        if (isCorrect) {
            room.state = 'gameover';
            room.winner = 'whitecard';
            io.to(roomCode).emit('gameOver', { winner: '白卡', words: room.words });
        } else {
            // 猜错，继续检查其他胜利条件
            checkWinCondition(room);
        }
    });

    // 下一轮
    socket.on('nextRound', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;
        
        room.round++;
        startSpeechRound(room);
    });

    // 强制结束游戏
    socket.on('forceEndGame', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;

        room.state = 'waiting';
        room.winner = null;
        if (room.speechTimer) clearTimeout(room.speechTimer);
        room.players.forEach(p => {
            p.isAlive = true;
            p.role = null;
            p.word = null;
        });
        
        io.to(roomCode).emit('roomUpdated', getRoomInfo(room));
        io.to(roomCode).emit('backToWaiting');
    });
    
    // 返回等待室 (再来一局)
    socket.on('backToWaiting', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || room.hostId !== socket.id) return;

        room.state = 'waiting';
        room.winner = null;
        room.players.forEach(p => {
            p.isAlive = true;
            p.role = null;
            p.word = null;
        });
        
        io.to(roomCode).emit('roomUpdated', getRoomInfo(room));
        io.to(roomCode).emit('backToWaiting');
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const code in rooms) {
            const room = rooms[code];
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.connected = false;
                
                // If it's their turn to speak, skip them
                if (room.state === 'speech' && room.speechOrder[room.currentSpeakerIndex]?.id === socket.id) {
                    nextSpeakerAction(room);
                }

                // Delete room if all players are disconnected
                const anyConnected = room.players.some(p => p.connected);
                if (!anyConnected) {
                    if (room.speechTimer) clearTimeout(room.speechTimer);
                    delete rooms[code];
                } else {
                    io.to(code).emit('roomUpdated', getRoomInfo(room));
                }
            }
        }
    });

    // 真正的退出房间逻辑
    function removePlayerFromRoom(room, socketId, roomCode) {
        const pIndex = room.players.findIndex(p => p.id === socketId);
        if (pIndex !== -1) {
            room.players.splice(pIndex, 1);
            if (room.players.length === 0) {
                if (room.speechTimer) clearTimeout(room.speechTimer);
                delete rooms[roomCode]; 
            } else if (room.hostId === socketId) {
                room.hostId = room.players[0].id; 
                io.to(roomCode).emit('roomUpdated', getRoomInfo(room));
            } else {
                io.to(roomCode).emit('roomUpdated', getRoomInfo(room));
            }
            
            // Note: If game started, leaving might break game state.
            // For simplicity, we just let them leave.
        }
    }
});

function getRoomInfo(room) {
    return {
        code: room.code,
        hostId: room.hostId,
        maxPlayers: room.maxPlayers,
        mode: room.mode,
        state: room.state,
        players: room.players.map(p => ({ id: p.id, name: p.name, isAlive: p.isAlive, connected: p.connected }))
    };
}

function startSpeechRound(room) {
    room.state = 'speech';
    
    // 获取存活玩家并打乱顺序
    let alivePlayers = room.players.filter(p => p.isAlive).map(p => ({ id: p.id, name: p.name }));
    alivePlayers.sort(() => Math.random() - 0.5);
    
    room.speechOrder = alivePlayers;
    room.currentSpeakerIndex = 0;

    // Check if first speaker is disconnected, skip if so
    const firstRealPlayer = room.players.find(p => p.id === room.speechOrder[0].id);
    if (firstRealPlayer && !firstRealPlayer.connected) {
        // Find next valid speaker or end
        let found = false;
        for (let i=1; i<room.speechOrder.length; i++) {
            const sp = room.speechOrder[i];
            const rp = room.players.find(p => p.id === sp.id);
            if (rp && rp.connected && rp.isAlive) {
                room.currentSpeakerIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            room.state = 'speech_end';
            io.to(room.code).emit('speechEnded');
            return;
        }
    }

    if (room.speechTimer) {
        clearTimeout(room.speechTimer);
    }

    io.to(room.code).emit('speechPhaseStarted', {
        round: room.round,
        aliveCount: room.players.filter(p => p.isAlive && p.connected).length,
        order: room.speechOrder,
        currentSpeaker: room.speechOrder[room.currentSpeakerIndex],
        timeLeft: 180
    });

    room.speechTimer = setTimeout(() => {
        nextSpeakerAction(room);
    }, 180 * 1000);
}

function processVotes(room) {
    // 统计票数
    const voteCounts = {};
    for (const voter in room.votes) {
        const target = room.votes[voter];
        voteCounts[target] = (voteCounts[target] || 0) + 1;
    }

    // 找出最高票
    let maxVotes = 0;
    let eliminatedIds = [];
    
    for (const targetId in voteCounts) {
        if (voteCounts[targetId] > maxVotes) {
            maxVotes = voteCounts[targetId];
            eliminatedIds = [targetId];
        } else if (voteCounts[targetId] === maxVotes) {
            eliminatedIds.push(targetId);
        }
    }

    // 简单处理平票：随机淘汰一个 (或者可以设置无人出局，这里按随机处理)
    const eliminatedId = eliminatedIds[Math.floor(Math.random() * eliminatedIds.length)];
    const eliminatedPlayer = room.players.find(p => p.id === eliminatedId);
    
    eliminatedPlayer.isAlive = false;
    room.aliveCount--;

    room.state = 'result';
    
    io.to(room.code).emit('voteResult', {
        eliminated: { id: eliminatedPlayer.id, name: eliminatedPlayer.name, role: eliminatedPlayer.role },
        isWhitecard: eliminatedPlayer.role === 'whitecard'
    });

    if (eliminatedPlayer.role !== 'whitecard') {
        checkWinCondition(room);
    }
    // 如果是白卡，等待前端触发 'whitecardGuess'
}

function checkWinCondition(room) {
    const alive = room.players.filter(p => p.isAlive);
    const undercoverAlive = alive.filter(p => p.role === 'undercover').length;
    const civilianAlive = alive.filter(p => p.role === 'civilian').length;
    const whitecardAlive = alive.filter(p => p.role === 'whitecard').length;

    let winner = null;

    if (undercoverAlive + whitecardAlive === 0) {
        winner = '平民';
    } else if (undercoverAlive >= civilianAlive + whitecardAlive) {
        winner = '卧底';
    }

    if (winner) {
        room.state = 'gameover';
        room.winner = winner;
        io.to(room.code).emit('gameOver', { winner, words: room.words });
    } else {
        // 通知可以进入下一轮
        io.to(room.code).emit('readyForNextRound');
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
