import React, { useState, useEffect, useRef } from 'react';
/* --- FIREBASE IMPORTS DISABLED ---
// import { initializeApp } from 'firebase/app';
// import {
//   getAuth,
//   signInAnonymously,
//   onAuthStateChanged,
//   signInWithCustomToken
// } from 'firebase/auth';
// import {
//   getFirestore,
//   doc,
//   setDoc,
//   getDoc,
//   onSnapshot,
//   updateDoc
// } from 'firebase/firestore';
*/
import { User, Users, Globe, Copy, Check, RotateCcw, ArrowLeft, Cpu, Trophy, Share2, Star, Sparkles, MessageCircle } from 'lucide-react';

/* --- FIREBASE CONFIGURATION & INIT --- */
/* --- FIREBASE CONFIGURATION & INIT DISABLED ---
// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//   storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//   appId: import.meta.env.VITE_FIREBASE_APP_ID
// };
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);
*/
// Helper placeholders to prevent crashes if referenced
const auth = null;
const db = null;
const appId = "my-local-connect4";

/* --- GEMINI API HELPER --- */
const callGemini = async (prompt) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // Runtime provided key
  const maxRetries = 5;
  let retryDelay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error("Gemini API failed after retries:", error);
        return "My brain circuits are fuzzy right now. Try again later!";
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2;
    }
  }
};

/* --- GAME CONSTANTS --- */
const ROWS = 6;
const COLS = 7;
const EMPTY = null;
const PLAYER_1 = 'red'; // You / Host
const PLAYER_2 = 'yellow'; // Opponent / AI

/* --- GAME LOGIC --- */
const createBoard = () => Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));

const checkWin = (board) => {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (board[r][c] && board[r][c] === board[r][c + 1] && board[r][c] === board[r][c + 2] && board[r][c] === board[r][c + 3]) {
        return { winner: board[r][c], line: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
      }
    }
  }
  // Vertical
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && board[r][c] === board[r + 1][c] && board[r][c] === board[r + 2][c] && board[r][c] === board[r + 3][c]) {
        return { winner: board[r][c], line: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
      }
    }
  }
  // Diagonal Down-Right
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (board[r][c] && board[r][c] === board[r + 1][c + 1] && board[r][c] === board[r + 2][c + 2] && board[r][c] === board[r + 3][c + 3]) {
        return { winner: board[r][c], line: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
      }
    }
  }
  // Diagonal Up-Right
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      if (board[r][c] && board[r][c] === board[r - 1][c + 1] && board[r][c] === board[r - 2][c + 2] && board[r][c] === board[r - 3][c + 3]) {
        return { winner: board[r][c], line: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
      }
    }
  }
  return null;
};

const checkDraw = (board) => {
  return board[0].every(cell => cell !== EMPTY);
};

const getValidRow = (board, col) => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return -1;
};

const boardToString = (board) => {
  return board.map(row =>
    row.map(cell => cell === PLAYER_1 ? 'R' : cell === PLAYER_2 ? 'Y' : '.').join(' ')
  ).join('\n');
};

/* --- AI ENGINE --- */
const evaluateWindow = (window, piece) => {
  let score = 0;
  const oppPiece = piece === PLAYER_1 ? PLAYER_2 : PLAYER_1;
  const pieceCount = window.filter(c => c === piece).length;
  const emptyCount = window.filter(c => c === EMPTY).length;
  const oppCount = window.filter(c => c === oppPiece).length;

  if (pieceCount === 4) score += 100;
  else if (pieceCount === 3 && emptyCount === 1) score += 5;
  else if (pieceCount === 2 && emptyCount === 2) score += 2;

  if (oppCount === 3 && emptyCount === 1) score -= 4;

  return score;
};

const scorePosition = (board, piece) => {
  let score = 0;
  const centerArray = board.map(row => row[Math.floor(COLS / 2)]);
  const centerCount = centerArray.filter(c => c === piece).length;
  score += centerCount * 3;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
      score += evaluateWindow(window, piece);
    }
  }
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS; c++) {
      const window = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
      score += evaluateWindow(window, piece);
    }
  }
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
      score += evaluateWindow(window, piece);
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]];
      score += evaluateWindow(window, piece);
    }
  }
  return score;
};

const minimax = (board, depth, alpha, beta, maximizingPlayer) => {
  const result = checkWin(board);
  if (result) {
    return result.winner === PLAYER_2 ? 1000000 : -1000000;
  }
  if (checkDraw(board) || depth === 0) {
    return scorePosition(board, PLAYER_2);
  }

  const validLocations = [];
  for (let c = 0; c < COLS; c++) {
    if (getValidRow(board, c) !== -1) validLocations.push(c);
  }

  if (maximizingPlayer) {
    let value = -Infinity;
    for (let col of validLocations) {
      const row = getValidRow(board, col);
      const bCopy = board.map(row => [...row]);
      bCopy[row][col] = PLAYER_2;
      const newScore = minimax(bCopy, depth - 1, alpha, beta, false);
      value = Math.max(value, newScore);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (let col of validLocations) {
      const row = getValidRow(board, col);
      const bCopy = board.map(row => [...row]);
      bCopy[row][col] = PLAYER_1;
      const newScore = minimax(bCopy, depth - 1, alpha, beta, true);
      value = Math.min(value, newScore);
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }
};

const getBestMove = (board, difficulty) => {
  const validLocations = [];
  for (let c = 0; c < COLS; c++) {
    if (getValidRow(board, c) !== -1) validLocations.push(c);
  }

  if (difficulty === 'easy') {
    for (let col of validLocations) {
      const row = getValidRow(board, col);
      const bCopy = board.map(r => [...r]);
      bCopy[row][col] = PLAYER_2;
      if (checkWin(bCopy)) return col;
    }
    return validLocations[Math.floor(Math.random() * validLocations.length)];
  }

  let bestScore = -Infinity;
  let bestCol = validLocations[0];
  const depth = 4;

  for (let col of validLocations) {
    const row = getValidRow(board, col);
    const bCopy = board.map(r => [...r]);
    bCopy[row][col] = PLAYER_2;
    const score = minimax(bCopy, depth, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  return bestCol;
};

/* --- NEUBRUTALISM COMPONENTS --- */
const NeoButton = ({ onClick, children, color = "bg-white", textColor = "text-black", className = "" }) => (
  <button
    onClick={onClick}
    className={`
      ${color} ${textColor}
      border-2 border-black 
      shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] 
      hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
      active:translate-x-[4px] active:translate-y-[4px] active:shadow-none
      transition-all duration-200
      rounded-lg font-bold px-6 py-4 flex items-center justify-center gap-3 w-full
      ${className}
    `}
  >
    {children}
  </button>
);

const NeoCard = ({ children, className = "" }) => (
  <div className={`bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl p-8 ${className}`}>
    {children}
  </div>
);

/* --- MAIN COMPONENT --- */
export default function Connect4() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('onboarding');
  const [board, setBoard] = useState(createBoard());
  const [turn, setTurn] = useState(PLAYER_1);
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);
  const [aiDifficulty, setAiDifficulty] = useState('easy');
  const [gameId, setGameId] = useState('');
  const [onlineRole, setOnlineRole] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Gemini States
  const [geminiComment, setGeminiComment] = useState("");
  const [geminiHint, setGeminiHint] = useState("");
  const [isThinkingGemini, setIsThinkingGemini] = useState(false);
  const [isGettingHint, setIsGettingHint] = useState(false);

  /*
  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);
  */

  /*
  useEffect(() => {
    if (mode !== 'online-game' || !gameId || !user) return;
    // FIX: Added 'connect4_games' collection segment
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'connect4_games', gameId);

    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const newBoard = [];
        for (let i = 0; i < ROWS; i++) {
          newBoard.push(data.boardFlat.slice(i * COLS, (i + 1) * COLS));
        }
        if (JSON.stringify(newBoard) !== JSON.stringify(board)) setBoard(newBoard);
        setTurn(data.turn);
        if (data.winner) {
          setWinner(data.winner);
          if (data.winningLine) setWinningLine(data.winningLine);
        } else if (data.status === 'draw') {
          setWinner('draw');
        }
      }
    }, (error) => console.error("Game sync error:", error));
    return () => unsubscribe();
  }, [mode, gameId, user, onlineRole]);
  */

  useEffect(() => {
    if (mode === 'ai-game' && turn === PLAYER_2 && !winner && !isAiThinking) {
      setIsAiThinking(true);
      setTimeout(async () => {
        const bestCol = getBestMove(board, aiDifficulty);
        await handleDrop(bestCol);
        setIsAiThinking(false);

        // Trigger Gemini Commentary after AI Move
        if (!winner) { // Only if game isn't over yet (or handle game over commentary differently)
          triggerAICommentary(board, bestCol);
        }
      }, 600);
    }
  }, [turn, mode, winner, board, isAiThinking]);

  /* --- GEMINI ACTIONS --- */

  const triggerAICommentary = async (currentBoard, lastMoveCol) => {
    setIsThinkingGemini(true);
    const boardStr = boardToString(currentBoard);

    // Create a temporary board to show the move that just happened
    const tempBoard = currentBoard.map(r => [...r]);
    const row = getValidRow(currentBoard, lastMoveCol);
    // Note: getValidRow returns the empty slot, but the move already happened in handleDrop before this is called?
    // Actually handleDrop updates state, but 'board' in this scope might be stale if not careful.
    // However, we pass 'board' from the effect which should be current-ish. 
    // Let's just pass the current board state assuming the move is effectively done visually or about to be.
    // Wait, handleDrop is async and updates state. The board passed to this function from the effect is the state BEFORE the move?
    // No, I called await handleDrop. But state updates in React are not immediate in the same closure.
    // So 'board' here is technically the state BEFORE the AI moved. 
    // Let's manually simulate the move for the prompt to be accurate.
    if (row !== -1) tempBoard[row][lastMoveCol] = PLAYER_2;

    const prompt = `
      You are a competitive, witty, and slightly sassy Connect 4 robot playing as Yellow. 
      The board state is below (R=Red/Human, Y=Yellow/You, .=Empty):
      ${boardToString(tempBoard)}
      
      You just played in column ${lastMoveCol + 1} (1-indexed).
      The human (Red) is next.
      
      Give a very short (max 12 words), spicy, playful taunt or observation about your move or the board state.
      Don't be mean, just fun competitive banter.
    `;

    const comment = await callGemini(prompt);
    setGeminiComment(comment);
    setIsThinkingGemini(false);
  };

  const getGeminiHint = async () => {
    if (isGettingHint || winner) return;
    setIsGettingHint(true);

    const boardStr = boardToString(board);
    const currentPlayer = turn === PLAYER_1 ? 'Red' : 'Yellow';

    const prompt = `
      You are a Connect 4 Grandmaster Coach. 
      Analyze this board state (R=Red, Y=Yellow, .=Empty):
      ${boardStr}
      
      It is ${currentPlayer}'s turn.
      Identify the single best column to drop a piece (1-7).
      Explain the strategy in one concise, helpful sentence (max 20 words).
    `;

    const hint = await callGemini(prompt);
    setGeminiHint(hint);
    setIsGettingHint(false);
  };

  /* --- ACTIONS --- */
  const resetGame = async () => {
    const newBoard = createBoard();
    setBoard(newBoard);
    setTurn(PLAYER_1);
    setWinner(null);
    setWinningLine([]);
    setGeminiComment("");
    setGeminiHint("");

    if (mode === 'online-game') {
      /*
      const flatBoard = newBoard.flat();
      // FIX: Added 'connect4_games' collection segment
      const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'connect4_games', gameId);
      await updateDoc(gameRef, {
        boardFlat: flatBoard,
        turn: PLAYER_1,
        winner: null,
        winningLine: null,
        status: 'playing'
      });
      */
    }
  };

  const handleDrop = async (col) => {
    if (winner || isAiThinking) return;
    if (mode === 'online-game') {
      if (onlineRole === 'host' && turn !== PLAYER_1) return;
      if (onlineRole === 'guest' && turn !== PLAYER_2) return;
    }
    const row = getValidRow(board, col);
    if (row === -1) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = turn;

    const winResult = checkWin(newBoard);
    const isDraw = checkDraw(newBoard);
    const nextTurn = turn === PLAYER_1 ? PLAYER_2 : PLAYER_1;

    setBoard(newBoard);
    if (winResult) {
      setWinner(winResult.winner);
      setWinningLine(winResult.line);
    } else if (isDraw) {
      setWinner('draw');
    } else {
      setTurn(nextTurn);
    }

    // Clear hint on move
    setGeminiHint("");

    if (mode === 'online-game') {
      /*
      // FIX: Added 'connect4_games' collection segment
      const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'connect4_games', gameId);
      await updateDoc(gameRef, {
        boardFlat: newBoard.flat(),
        turn: nextTurn,
        winner: winResult ? winResult.winner : null,
        winningLine: winResult ? winResult.line : null,
        status: winResult ? 'finished' : (isDraw ? 'draw' : 'playing')
      });
      */
    }
  };

  const startLocalGame = () => { setMode('local'); resetGame(); };
  const startAiGame = (difficulty) => { setAiDifficulty(difficulty); setMode('ai-game'); resetGame(); };

  /*
  const createOnlineGame = async () => {
    if (!user) return;
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    // FIX: Added 'connect4_games' collection segment
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'connect4_games', newGameId);
    await setDoc(gameRef, {
      hostId: user.uid,
      guestId: null,
      boardFlat: Array(ROWS * COLS).fill(null),
      turn: PLAYER_1,
      status: 'waiting',
      winner: null,
      createdAt: new Date().toISOString()
    });
    setGameId(newGameId);
    setOnlineRole('host');
    setMode('online-lobby');
  };
  */
  const createOnlineGame = () => { alert("Online mode is coming soon!"); };

  /*
  const joinOnlineGame = async () => {
    if (!user || !joinCode) return;
    const code = joinCode.toUpperCase();
    // FIX: Added 'connect4_games' collection segment
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'connect4_games', code);
    const docSnap = await getDoc(gameRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.status === 'waiting' && !data.guestId) {
        await updateDoc(gameRef, { guestId: user.uid, status: 'playing' });
        setGameId(code);
        setOnlineRole('guest');
        setMode('online-game');
        setBoard(createBoard());
      } else { alert("Game is full or doesn't exist!"); }
    } else { alert("Invalid Game ID"); }
  };
  */
  const joinOnlineGame = () => { alert("Online mode is coming soon!"); };

  const copyToClipboard = () => {
    const el = document.createElement('textarea');
    el.value = gameId;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  /* --- RENDERERS --- */

  const Header = ({ title }) => (
    <div className="flex items-center w-full mb-8">
      <button
        onClick={() => setMode('menu')}
        className="p-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-1 transition-all rounded-lg mr-4"
      >
        <ArrowLeft className="w-6 h-6 text-black" />
      </button>
      <h2 className="text-3xl font-black uppercase tracking-tighter text-black">{title}</h2>
    </div>
  );

  /* --- MODE VIEWS --- */

  if (mode === 'onboarding') {
    return (
      <div className="min-h-screen bg-[#4D79FF] flex flex-col items-center justify-center p-4 font-sans selection:bg-black selection:text-white">
        <NeoCard className="max-w-md w-full text-center space-y-8 transform -rotate-1 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] bg-white border-4 border-black">

          {/* Enhanced Logo Section */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              {/* Background Grid Accent */}
              <div className="absolute inset-0 bg-black translate-x-2 translate-y-2 rounded-xl"></div>

              <div className="relative bg-white border-4 border-black p-4 rounded-xl flex gap-3">
                <div className="w-12 h-12 rounded-full bg-[#FF003C] border-4 border-black shadow-[inset_-4px_-4px_0px_rgba(0,0,0,0.2)] animate-bounce-slow"></div>
                <div className="w-12 h-12 rounded-full bg-[#FFE600] border-4 border-black shadow-[inset_-4px_-4px_0px_rgba(0,0,0,0.2)] animate-bounce-slow delay-100"></div>
                <div className="w-12 h-12 rounded-full bg-[#FF003C] border-4 border-black shadow-[inset_-4px_-4px_0px_rgba(0,0,0,0.2)] animate-bounce-slow delay-200"></div>
                <div className="w-12 h-12 rounded-full bg-[#FFE600] border-4 border-black shadow-[inset_-4px_-4px_0px_rgba(0,0,0,0.2)] animate-bounce-slow delay-300"></div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-7xl font-black uppercase text-[#FFE600] italic tracking-tighter" style={{ textShadow: '6px 6px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000' }}>
              Connect 4
            </h1>
            <div className="inline-block transform rotate-2">
              <span className="text-white bg-black font-black px-4 py-1.5 rounded-lg text-2xl border-2 border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                NEO EDITION
              </span>
            </div>
          </div>

          <div className="bg-black border-4 border-black p-6 rounded-xl shadow-[8px_8px_0px_0px_rgba(255,230,0,1)] text-left relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#FFE600] rounded-bl-full -mr-8 -mt-8 z-0"></div>

            <h3 className="relative z-10 font-black text-2xl mb-4 text-[#FFE600] uppercase tracking-wider border-b-4 border-[#FFE600] pb-2 inline-block">
              How to Play
            </h3>
            <ul className="relative z-10 space-y-4 font-bold text-white text-lg list-none">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#FF003C] border-2 border-white flex items-center justify-center text-xs text-white">1</span>
                <span>Connect 4 of your color</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#FFE600] border-2 border-white flex items-center justify-center text-xs text-black">2</span>
                <span>Challenge friends or AI</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#4D79FF] border-2 border-white flex items-center justify-center text-xs text-white">3</span>
                <span>Block & Win!</span>
              </li>
            </ul>
          </div>

          <NeoButton onClick={() => setMode('menu')} color="bg-[#FF003C]" textColor="text-white" className="text-2xl py-6 border-4 hover:bg-[#ff1a50]">
            START GAME <ArrowLeft className="w-8 h-8 rotate-180" />
          </NeoButton>
        </NeoCard>
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-[#FFE600] flex flex-col items-center justify-center p-4 font-sans selection:bg-black selection:text-white">
        <NeoCard className="max-w-md w-full text-center space-y-6 transform rotate-1">
          <div className="flex justify-center -mb-2">
            <div className="flex gap-2 p-2 bg-black border-2 border-black rounded-lg">
              <div className="w-6 h-6 rounded-full bg-[#FF003C] border-2 border-white"></div>
              <div className="w-6 h-6 rounded-full bg-[#FFE600] border-2 border-white"></div>
              <div className="w-6 h-6 rounded-full bg-[#FFE600] border-2 border-white"></div>
              <div className="w-6 h-6 rounded-full bg-[#FF003C] border-2 border-white"></div>
            </div>
          </div>
          <h1 className="text-5xl font-black uppercase text-black tracking-tighter">Connect 4</h1>
          <p className="text-black font-bold border-b-4 border-black inline-block pb-1">NEO EDITION</p>

          <div className="space-y-4 pt-4">
            <NeoButton onClick={startLocalGame} color="bg-[#4D79FF]" textColor="text-white">
              <Users className="w-6 h-6" /> LOCAL MATCH
            </NeoButton>
            <NeoButton onClick={() => setMode('ai-select')} color="bg-[#FF003C]" textColor="text-white">
              <Cpu className="w-6 h-6" /> VS AI
            </NeoButton>
            <NeoButton onClick={() => alert("Online Gameplay Coming Soon!")} color="bg-[#808080]" textColor="text-white">
              <Globe className="w-6 h-6" /> ONLINE (SOON)
            </NeoButton>
          </div>
        </NeoCard>
      </div>
    );
  }

  if (mode === 'ai-select') {
    return (
      <div className="min-h-screen bg-[#4D79FF] flex flex-col items-center justify-center p-4">
        <NeoCard className="max-w-md w-full text-center">
          <Header title="Difficulty" />
          <div className="space-y-4">
            <NeoButton onClick={() => startAiGame('easy')} color="bg-[#00D26A]" textColor="text-white">
              EASY (RANDOM)
            </NeoButton>
            <NeoButton onClick={() => startAiGame('hard')} color="bg-[#FF003C]" textColor="text-white">
              HARD (MINIMAX)
            </NeoButton>
          </div>
        </NeoCard>
      </div>
    );
  }

  if (mode === 'online-menu') {
    return (
      <div className="min-h-screen bg-[#00D26A] flex flex-col items-center justify-center p-4">
        <NeoCard className="max-w-md w-full text-center">
          <Header title="Online" />
          <div className="space-y-6">
            <NeoButton onClick={createOnlineGame} color="bg-black" textColor="text-white">
              CREATE ROOM
            </NeoButton>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-4 border-black"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-black font-bold uppercase">Or Join</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="ENTER CODE"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-full px-4 py-4 border-4 border-black rounded-lg focus:outline-none focus:ring-4 focus:ring-yellow-400 uppercase font-black text-center text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              />
              <NeoButton onClick={joinOnlineGame} color="bg-[#4D79FF]" textColor="text-white">
                JOIN GAME
              </NeoButton>
            </div>
          </div>
        </NeoCard>
      </div>
    );
  }

  if (mode === 'online-lobby') {
    return (
      <div className="min-h-screen bg-[#C4B5FD] flex flex-col items-center justify-center p-4">
        <NeoCard className="max-w-md w-full text-center">
          <Header title="Lobby" />

          <div className="bg-[#FFE600] p-6 rounded-xl border-4 border-black mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-sm font-black uppercase mb-2 text-black">Room Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-black font-mono tracking-wider text-black">{gameId}</span>
              <button onClick={copyToClipboard} className="p-2 bg-white border-2 border-black rounded hover:bg-gray-100">
                {copySuccess ? <Check className="w-6 h-6 text-green-600" /> : <Copy className="w-6 h-6 text-black" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 animate-pulse font-bold uppercase text-black">
            Waiting for opponent...
          </div>
        </NeoCard>
      </div>
    );
  }

  /* --- GAME PLAY VIEW --- */
  const getStatusText = () => {
    if (winner === 'draw') return "DRAW!";
    if (winner) return `${winner === PLAYER_1 ? 'RED' : 'YELLOW'} WINS!`;
    if (mode === 'online-game') {
      if ((onlineRole === 'host' && turn === PLAYER_1) || (onlineRole === 'guest' && turn === PLAYER_2)) return "YOUR TURN";
      return "WAITING...";
    }
    return `${turn === PLAYER_1 ? 'RED' : 'YELLOW'}'S TURN`;
  };

  // Logic to determine background color and text color for contrast
  let statusBg = 'bg-gray-400';
  let statusText = 'text-black';

  if (winner) {
    if (winner === PLAYER_1) {
      statusBg = 'bg-[#FF003C]';
      statusText = 'text-white';
    } else if (winner === PLAYER_2) {
      statusBg = 'bg-[#FFE600]';
      statusText = 'text-black';
    }
  } else {
    if (turn === PLAYER_1) {
      statusBg = 'bg-[#FF003C]';
      statusText = 'text-white';
    } else {
      statusBg = 'bg-[#FFE600]';
      statusText = 'text-black';
    }
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 flex flex-col items-center py-6 sm:py-10 ${turn === PLAYER_1 ? 'bg-[#FFE4E6]' : 'bg-[#FEF9C3]'}`}>
      <div className="w-full max-w-2xl px-4 flex flex-col items-center">

        {/* Game Header */}
        <div className="w-full flex justify-between items-center mb-6">
          <button onClick={() => setMode('menu')} className="bg-white p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg hover:translate-y-1 active:shadow-none transition-all">
            <ArrowLeft className="w-6 h-6 text-black" />
          </button>

          <div className="flex gap-4">
            {mode === 'online-game' && (
              <div className="bg-white px-4 py-2 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg font-mono font-bold flex items-center gap-2 text-black">
                <Share2 className="w-4 h-4" /> {gameId}
              </div>
            )}
            <button onClick={resetGame} className="bg-white p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-lg hover:translate-y-1 active:shadow-none transition-all">
              <RotateCcw className="w-6 h-6 text-black" />
            </button>
          </div>
        </div>

        {/* Status Box */}
        <div className={`
            w-full py-6 px-8 mb-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-xl 
            flex items-center justify-between
            ${statusBg} transition-colors duration-300
        `}>
          <div className="flex flex-col">
            <span className={`text-xs font-black uppercase tracking-widest ${statusText} opacity-80`}>Status</span>
            <span className={`text-3xl sm:text-4xl font-black uppercase italic ${statusText}`}>{getStatusText()}</span>
          </div>
          {winner && <Trophy className={`w-12 h-12 ${statusText} animate-bounce`} />}
          {!winner && isAiThinking && <Cpu className={`w-10 h-10 ${statusText} animate-spin`} />}
        </div>

        {/* Gemini AI Features Zone */}
        {mode === 'ai-game' && geminiComment && (
          <div className="w-full mb-6 flex justify-end">
            <div className="relative max-w-[80%] bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 rounded-xl rounded-tr-none">
              <p className="text-black font-medium italic">"{geminiComment}"</p>
              <div className="absolute -top-3 -right-3 bg-[#FFE600] border-2 border-black w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                <MessageCircle className="w-5 h-5 text-black" />
              </div>
            </div>
          </div>
        )}

        {/* The Board */}
        <div className="p-4 bg-[#4D79FF] border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] rounded-xl relative">
          <div className="grid grid-rows-6 gap-3">
            {board.map((row, r) => (
              <div key={r} className="flex gap-3">
                {row.map((cell, c) => {
                  const isWinningCell = winningLine.some(([wr, wc]) => wr === r && wc === c);
                  let cellColor = "bg-white"; // Empty
                  if (cell === PLAYER_1) cellColor = "bg-[#FF003C]";
                  if (cell === PLAYER_2) cellColor = "bg-[#FFE600]";

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleDrop(c)}
                      className={`
                                w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 
                                rounded-full border-4 border-black 
                                cursor-pointer relative overflow-hidden
                                ${cellColor}
                                ${cell === EMPTY ? 'hover:bg-blue-100' : ''}
                                transition-colors duration-200
                            `}
                    >
                      {/* Inner Shine/Shadow for depth in 2D */}
                      {cell !== EMPTY && (
                        <div className="absolute top-2 left-2 w-3 h-3 bg-white/40 rounded-full"></div>
                      )}
                      {isWinningCell && (
                        <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
                          <Star className="w-8 h-8 text-black fill-current" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Gemini Hint Button */}
        {!winner && (
          <div className="w-full mt-8">
            {geminiHint ? (
              <div className="bg-[#C4B5FD] border-2 border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
                <Sparkles className="w-6 h-6 text-black shrink-0 mt-1" />
                <div>
                  <p className="font-black uppercase text-xs mb-1">Gemini Coach</p>
                  <p className="font-bold text-black">{geminiHint}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={getGeminiHint}
                disabled={isGettingHint}
                className="w-full py-3 bg-white hover:bg-purple-50 border-2 border-black border-dashed rounded-xl text-purple-600 font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isGettingHint ? <span className="animate-pulse">Consulting the oracle...</span> : <><Sparkles className="w-5 h-5" /> Ask Gemini Coach for a Hint</>}
              </button>
            )}
          </div>
        )}

        <div className="mt-8 font-black text-black/40 text-sm uppercase tracking-widest">
          {mode === 'local' && "Local Mode"}
          {mode === 'ai-game' && `VS AI (${aiDifficulty})`}
          {mode === 'online-game' && `Online: ${onlineRole}`}
        </div>
      </div>
    </div>
  );
}