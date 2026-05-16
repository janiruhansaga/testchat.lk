// --- FIREBASE MODULAR SDK IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==========================================
// 🚨 PASTE YOUR FIREBASE CONFIG KEYS HERE:
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAMXXwpfPtA1RNzs0Lk_MnBEIFQ7pHDPKw",
  authDomain: "vibespace-76e5d.firebaseapp.com",
  projectId: "vibespace-76e5d",
  storageBucket: "vibespace-76e5d.firebasestorage.app",
  messagingSenderId: "566799680678",
  appId: "1:566799680678:web:e7ccc727f1dd1487346067"
};
// ==========================================

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[ServiceWorker] Registered successfully:', reg.scope))
      .catch(err => console.warn('[ServiceWorker] Registration failed:', err));
  });
}

// Check if Firebase is configured or using placeholder
const isFirebasePlaceholder = firebaseConfig.apiKey.includes("PASTE_YOUR");

let db = null;
if (!isFirebasePlaceholder) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (e) {
    console.warn("Global Firebase init failed:", e);
  }
}

// --- APP STATE ---
const state = {
  // Calculator State
  displayValue: '0',
  previousValue: null,
  operator: null,
  waitingForSecondOperand: false,
  
  // Chat Profile State
  nickname: localStorage.getItem('vibe_nickname') || `Viber_${Math.floor(100 + Math.random() * 900)}`,
  avatarColor: localStorage.getItem('vibe_avatar_color') || '#8a78f7',
  roomId: localStorage.getItem('vibe_room_id') || 'chill-99',
  
  // Active Screen
  isSecretChatOpen: false,
  isRoomSelectOpen: false,
  isDecoyMode: false,
  
  // Realtime Unsubscribe
  unsubscribeChat: null,
  unsubscribeStealth: null
};

// --- DOM ELEMENTS ---
const calcScreen = document.getElementById('calculator-screen');
const roomScreen = document.getElementById('room-screen');
const chatScreen = document.getElementById('chat-screen');
const stealthDot = document.getElementById('stealth-dot');

const calcDisplay = document.getElementById('calc-display');
const calcHistory = document.getElementById('calc-history');
const btnAC = document.getElementById('btn-ac');
const demoBanner = document.getElementById('demo-banner');

const roomForm = document.getElementById('room-form');
const roomIdInput = document.getElementById('room-id-input');
const btnCancelRoom = document.getElementById('btn-cancel-room');
const headerRoomBadge = document.getElementById('header-room-badge');

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnExitChat = document.getElementById('btn-exit-chat');
const btnSettings = document.getElementById('btn-settings');
const btnBurnChat = document.getElementById('btn-burn-chat');
const onlineStatus = document.getElementById('online-status');

const burnModal = document.getElementById('burn-modal');
const btnConfirmBurn = document.getElementById('btn-confirm-burn');
const btnCancelBurn = document.getElementById('btn-cancel-burn');

const profileModal = document.getElementById('profile-modal');
const nicknameInput = document.getElementById('nickname-input');
const avatarPreview = document.getElementById('avatar-preview');
const colorButtons = document.querySelectorAll('.color-btn');
const btnSaveProfile = document.getElementById('btn-save-profile');
const quickEmojis = document.querySelectorAll('.vibe-emoji');

// --- WEB AUDIO API FOR SUBTLE NOTIFICATION BEEP ---
let audioCtx = null;
function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    // Web Audio blocked or not supported
  }
}

// ==========================================
// 1. CALCULATOR LOGIC
// ==========================================
function updateCalcDisplay() {
  calcDisplay.textContent = state.displayValue;
  if (state.previousValue !== null && state.operator) {
    calcHistory.textContent = `${state.previousValue} ${state.operator}`;
  } else {
    calcHistory.textContent = '';
  }
  btnAC.textContent = state.displayValue === '0' && state.previousValue === null ? 'AC' : 'C';
}

function inputDigit(digit) {
  if (state.waitingForSecondOperand) {
    state.displayValue = digit;
    state.waitingForSecondOperand = false;
  } else {
    state.displayValue = state.displayValue === '0' ? digit : state.displayValue + digit;
  }
  updateCalcDisplay();
}

function inputDecimal() {
  if (state.waitingForSecondOperand) {
    state.displayValue = '0.';
    state.waitingForSecondOperand = false;
    return updateCalcDisplay();
  }
  if (!state.displayValue.includes('.')) {
    state.displayValue += '.';
  }
  updateCalcDisplay();
}

function handleOperator(nextOperator) {
  const inputValue = parseFloat(state.displayValue);

  if (state.operator && state.waitingForSecondOperand) {
    state.operator = nextOperator;
    updateCalcDisplay();
    return;
  }

  if (state.previousValue === null && !isNaN(inputValue)) {
    state.previousValue = inputValue;
  } else if (state.operator) {
    const currentValue = inputValue || 0;
    const computation = calculate(state.previousValue, currentValue, state.operator);
    state.displayValue = String(parseFloat(computation.toFixed(8)));
    state.previousValue = computation;
  }

  state.waitingForSecondOperand = true;
  state.operator = nextOperator;
  updateCalcDisplay();
}

function calculate(firstOperand, secondOperand, operator) {
  switch (operator) {
    case '+': return firstOperand + secondOperand;
    case '-': return firstOperand - secondOperand;
    case '×': return firstOperand * secondOperand;
    case '÷': return secondOperand === 0 ? 0 : firstOperand / secondOperand;
    default: return secondOperand;
  }
}

function handleEqual() {
  // 🚨 REAL SECRET TRIGGER CHECK: 7788 + =
  if (state.displayValue === '7788') {
    state.isDecoyMode = false;
    openRoomSelection();
    return;
  }

  // 🚨 DUMMY PASSWORD / DECOY MODE: 1122 + =
  if (state.displayValue === '1122') {
    state.isDecoyMode = true;
    state.roomId = 'decoy_room';
    headerRoomBadge.textContent = '#decoy_room';
    openSecretChat();
    return;
  }

  if (!state.operator || state.previousValue === null) return;
  const inputValue = parseFloat(state.displayValue);
  const result = calculate(state.previousValue, inputValue, state.operator);
  
  state.displayValue = String(parseFloat(result.toFixed(8)));
  state.previousValue = null;
  state.operator = null;
  state.waitingForSecondOperand = false;
  updateCalcDisplay();
}

function resetCalculator() {
  state.displayValue = '0';
  state.previousValue = null;
  state.operator = null;
  state.waitingForSecondOperand = false;
  updateCalcDisplay();
}

function toggleSign() {
  state.displayValue = String(parseFloat(state.displayValue) * -1);
  updateCalcDisplay();
}

function calculatePercent() {
  state.displayValue = String(parseFloat(state.displayValue) / 100);
  updateCalcDisplay();
}

document.querySelector('.calc-keypad').addEventListener('click', e => {
  const target = e.target.closest('.btn');
  if (!target) return;

  if (target.classList.contains('btn-number') && target.dataset.number) {
    inputDigit(target.dataset.number);
  } else if (target.classList.contains('btn-operator')) {
    handleOperator(target.dataset.operator);
  } else if (target.dataset.action === 'decimal') {
    inputDecimal();
  } else if (target.dataset.action === 'clear') {
    resetCalculator();
  } else if (target.dataset.action === 'toggle-sign') {
    toggleSign();
  } else if (target.dataset.action === 'percent') {
    calculatePercent();
  } else if (target.dataset.action === 'equal') {
    handleEqual();
  }
});


// ==========================================
// 2. STEALTH NOTIFICATIONS & SCREEN NAVIGATION
// ==========================================
function startStealthBackgroundListener() {
  if (state.unsubscribeStealth) {
    state.unsubscribeStealth();
    state.unsubscribeStealth = null;
  }

  const savedRoom = localStorage.getItem('vibe_room_id');
  if (!savedRoom || savedRoom === 'decoy_room') return;

  if (!isFirebasePlaceholder && db) {
    try {
      const roomCol = collection(db, "rooms", savedRoom, "messages");
      const q = query(roomCol, orderBy("createdAt", "asc"), limit(100));
      let isFirstSnapshot = true;
      let initialCount = 0;

      state.unsubscribeStealth = onSnapshot(q, snapshot => {
        if (isFirstSnapshot) {
          initialCount = snapshot.size;
          isFirstSnapshot = false;
          return;
        }
        if (snapshot.size > initialCount && !state.isSecretChatOpen && !state.isRoomSelectOpen) {
          stealthDot.classList.remove('hidden');
          initialCount = snapshot.size;
        }
      }, err => {});
    } catch (e) {}
  } else {
    const localKey = 'vibe_messages_' + savedRoom;
    let lastLen = JSON.parse(localStorage.getItem(localKey) || '[]').length;
    window.addEventListener('storage', e => {
      if (e.key === localKey && !state.isSecretChatOpen && !state.isRoomSelectOpen) {
        const curLen = JSON.parse(localStorage.getItem(localKey) || '[]').length;
        if (curLen > lastLen) {
          stealthDot.classList.remove('hidden');
        }
        lastLen = curLen;
      }
    });
  }
}

function openRoomSelection() {
  state.isRoomSelectOpen = true;
  stealthDot.classList.add('hidden');
  if (state.unsubscribeStealth) {
    state.unsubscribeStealth();
    state.unsubscribeStealth = null;
  }
  
  resetCalculator();
  calcScreen.classList.remove('active');
  calcScreen.classList.add('hidden');
  
  roomIdInput.value = localStorage.getItem('vibe_room_id') || 'chill-99';
  roomScreen.classList.remove('hidden');
  roomScreen.classList.add('active');
  roomIdInput.focus();
}

roomForm.addEventListener('submit', e => {
  e.preventDefault();
  const enteredRoom = roomIdInput.value.trim().toLowerCase();
  if (!enteredRoom) return;

  state.roomId = enteredRoom;
  localStorage.setItem('vibe_room_id', state.roomId);
  headerRoomBadge.textContent = '#' + state.roomId;

  roomScreen.classList.remove('active');
  roomScreen.classList.add('hidden');
  state.isRoomSelectOpen = false;

  openSecretChat();
});

btnCancelRoom.addEventListener('click', () => {
  roomScreen.classList.remove('active');
  roomScreen.classList.add('hidden');
  state.isRoomSelectOpen = false;

  calcScreen.classList.remove('hidden');
  calcScreen.classList.add('active');
  startStealthBackgroundListener();
});

function openSecretChat() {
  state.isSecretChatOpen = true;
  stealthDot.classList.add('hidden');
  if (state.unsubscribeStealth) {
    state.unsubscribeStealth();
    state.unsubscribeStealth = null;
  }
  
  resetCalculator();
  calcScreen.classList.remove('active');
  calcScreen.classList.add('hidden');
  
  chatScreen.classList.remove('hidden');
  chatScreen.classList.add('active');
  
  initChatBackend();
  
  if (!localStorage.getItem('vibe_nickname')) {
    openProfileModal();
  }
}

function lockAndExitChat() {
  state.isSecretChatOpen = false;
  state.isRoomSelectOpen = false;
  state.isDecoyMode = false;
  resetCalculator();
  
  chatScreen.classList.remove('active');
  chatScreen.classList.add('hidden');
  
  roomScreen.classList.remove('active');
  roomScreen.classList.add('hidden');
  
  calcScreen.classList.remove('hidden');
  calcScreen.classList.add('active');
  
  if (state.unsubscribeChat) {
    state.unsubscribeChat();
    state.unsubscribeChat = null;
  }
  
  startStealthBackgroundListener();
}

btnExitChat.addEventListener('click', lockAndExitChat);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (state.isSecretChatOpen || state.isRoomSelectOpen)) {
    lockAndExitChat();
  }
});


// ==========================================
// 3. MODAL & PROFILE SETTINGS
// ==========================================
function updateAvatarPreview() {
  const initial = state.nickname ? state.nickname.charAt(0).toUpperCase() : 'V';
  avatarPreview.textContent = initial;
  avatarPreview.style.backgroundColor = state.avatarColor;
}

function openProfileModal() {
  nicknameInput.value = state.nickname;
  colorButtons.forEach(btn => {
    if (btn.dataset.color === state.avatarColor) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  updateAvatarPreview();
  profileModal.classList.remove('hidden');
  nicknameInput.focus();
}

function closeProfileModal() {
  profileModal.classList.add('hidden');
}

btnSettings.addEventListener('click', openProfileModal);

colorButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    colorButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.avatarColor = btn.dataset.color;
    updateAvatarPreview();
  });
});

nicknameInput.addEventListener('input', e => {
  state.nickname = e.target.value.trim() || 'Viber';
  updateAvatarPreview();
});

btnSaveProfile.addEventListener('click', () => {
  state.nickname = nicknameInput.value.trim() || `Viber_${Math.floor(100 + Math.random() * 900)}`;
  localStorage.setItem('vibe_nickname', state.nickname);
  localStorage.setItem('vibe_avatar_color', state.avatarColor);
  closeProfileModal();
});


// ==========================================
// 4. CHAT BACKEND & E2E ENCRYPTION
// ==========================================
function getSecretPassphrase() {
  return "VibeSpace_Key_" + state.roomId;
}

function encryptText(plainText) {
  try {
    if (!window.CryptoJS) return plainText;
    return window.CryptoJS.AES.encrypt(plainText, getSecretPassphrase()).toString();
  } catch (err) {
    console.error("Encryption error:", err);
    return plainText;
  }
}

function decryptText(cipherText) {
  try {
    if (!window.CryptoJS) return cipherText;
    const bytes = window.CryptoJS.AES.decrypt(cipherText, getSecretPassphrase());
    const originalText = bytes.toString(window.CryptoJS.enc.Utf8);
    return originalText || "[Unable to decrypt ciphertext]";
  } catch (err) {
    console.error("Decryption error:", err);
    return "[Encrypted Message]";
  }
}

let messagesCollection = null;

function initChatBackend() {
  if (!isFirebasePlaceholder && db) {
    try {
      messagesCollection = collection(db, "rooms", state.roomId, "messages");
      demoBanner.classList.add('hidden');
      onlineStatus.textContent = state.isDecoyMode ? "🔒 E2E Encrypted (Innocent Room)" : `🔒 E2E Encrypted (Room: #${state.roomId})`;
      startFirebaseRealtime();
    } catch (e) {
      console.warn("Firebase Init failed, switching to Local Demo mode", e);
      startLocalDemoMode();
    }
  } else {
    startLocalDemoMode();
  }
}

// --- FIREBASE REALTIME SYNC ---
function startFirebaseRealtime() {
  const q = query(messagesCollection, orderBy("createdAt", "asc"), limit(100));
  
  if (state.unsubscribeChat) {
    state.unsubscribeChat();
  }

  state.unsubscribeChat = onSnapshot(q, (snapshot) => {
    chatMessages.innerHTML = "";
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      renderMessage(data);
    });
    
    scrollToBottom();
  }, (error) => {
    console.error("Firestore Listen Error:", error);
    startLocalDemoMode();
  });
}

async function sendFirebaseMessage(text) {
  if (!text || !messagesCollection) return;
  try {
    const encryptedText = encryptText(text);
    await addDoc(messagesCollection, {
      text: encryptedText,
      author: state.nickname,
      avatarColor: state.avatarColor,
      createdAt: serverTimestamp(),
      timestampStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEncrypted: true
    });
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

// --- BURN HISTORY LOGIC ---
if (btnBurnChat) {
  btnBurnChat.addEventListener('click', () => {
    burnModal.classList.remove('hidden');
  });
}

if (btnCancelBurn) {
  btnCancelBurn.addEventListener('click', () => {
    burnModal.classList.add('hidden');
  });
}

if (btnConfirmBurn) {
  btnConfirmBurn.addEventListener('click', async () => {
    burnModal.classList.add('hidden');
    if (!isFirebasePlaceholder && db && messagesCollection) {
      try {
        const q = query(messagesCollection, limit(500));
        const snapshot = await getDocs(q);
        const deletePromises = [];
        snapshot.forEach(docSnap => {
          deletePromises.push(deleteDoc(docSnap.ref));
        });
        await Promise.all(deletePromises);
      } catch (e) {
        console.error("Error burning room history:", e);
      }
    } else {
      const localKey = 'vibe_messages_' + state.roomId;
      localStorage.setItem(localKey, '[]');
      window.dispatchEvent(new Event('local_msg_update_' + state.roomId));
    }
  });
}

// --- LOCAL STORAGE DEMO SYNC (FALLBACK WHEN NO KEYS) ---
function getLocalKey() {
  return 'vibe_messages_' + state.roomId;
}

function startLocalDemoMode() {
  demoBanner.classList.remove('hidden');
  onlineStatus.textContent = state.isDecoyMode ? "🔒 Local Sync (Decoy Mode)" : `🔒 Local Sync (Room: #${state.roomId})`;
  
  let localMessages = JSON.parse(localStorage.getItem(getLocalKey()) || '[]');
  if (localMessages.length === 0 && !state.isDecoyMode) {
    localMessages = [
      { id: '1', text: encryptText(`🚀 Welcome to Room #${state.roomId}!`), author: "System", avatarColor: "#8a78f7", timestampStr: "12:00 PM", isEncrypted: true },
      { id: '2', text: encryptText("🔒 E2EE is active. Only users with this Room ID can read or decrypt messages."), author: "System", avatarColor: "#06d6a0", timestampStr: "12:01 PM", isEncrypted: true }
    ];
    localStorage.setItem(getLocalKey(), JSON.stringify(localMessages));
  } else if (localMessages.length === 0 && state.isDecoyMode) {
    // Decoy room starts completely empty or with innocent note
    localMessages = [
      { id: '1', text: encryptText("Hey! Did you finish the math homework?"), author: "Alex", avatarColor: "#ffd166", timestampStr: "10:15 AM", isEncrypted: true },
      { id: '2', text: encryptText("Yeah, page 42 problems 1-5."), author: state.nickname, avatarColor: state.avatarColor, timestampStr: "10:16 AM", isEncrypted: true }
    ];
    localStorage.setItem(getLocalKey(), JSON.stringify(localMessages));
  }

  function renderAllLocal() {
    chatMessages.innerHTML = "";
    const msgs = JSON.parse(localStorage.getItem(getLocalKey()) || '[]');
    msgs.forEach(m => renderMessage(m));
    scrollToBottom();
  }
  
  renderAllLocal();

  window.addEventListener('storage', e => {
    if (e.key === getLocalKey() && state.isSecretChatOpen) {
      renderAllLocal();
      playNotificationSound();
    }
  });

  window.addEventListener('local_msg_update_' + state.roomId, () => {
    renderAllLocal();
  });
}

function sendLocalMessage(text) {
  const localMessages = JSON.parse(localStorage.getItem(getLocalKey()) || '[]');
  const encryptedText = encryptText(text);
  const newMsg = {
    id: Date.now().toString(),
    text: encryptedText,
    author: state.nickname,
    avatarColor: state.avatarColor,
    timestampStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isEncrypted: true
  };
  localMessages.push(newMsg);
  if (localMessages.length > 100) localMessages.shift();
  
  localStorage.setItem(getLocalKey(), JSON.stringify(localMessages));
  window.dispatchEvent(new Event('local_msg_update_' + state.roomId));
}

// --- RENDER MESSAGE ---
function renderMessage(data) {
  const isSelf = data.author === state.nickname;
  const wrap = document.createElement('div');
  wrap.className = `message-wrapper ${isSelf ? 'sent' : 'received'}`;
  
  const initial = data.author ? data.author.charAt(0).toUpperCase() : 'V';
  
  let displayText = data.text;
  if (data.isEncrypted || (data.text && data.text.startsWith('U2Fsd'))) {
    displayText = decryptText(data.text);
  }
  
  wrap.innerHTML = `
    <div class="msg-avatar" style="background-color: ${data.avatarColor || '#8a78f7'};">
      ${initial}
    </div>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-author">${escapeHtml(data.author)}</span>
        <span class="msg-time">${data.timestampStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="msg-bubble">${escapeHtml(displayText)}</div>
    </div>
  `;
  
  chatMessages.appendChild(wrap);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scrollToBottom() {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 50);
}

// Chat Form Submit
chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  
  if (!isFirebasePlaceholder && db) {
    await sendFirebaseMessage(text);
  } else {
    sendLocalMessage(text);
  }
});

// Quick Emojis
quickEmojis.forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.dataset.emoji;
    chatInput.value += emoji;
    chatInput.focus();
  });
});

// Initial Setup
updateCalcDisplay();
startStealthBackgroundListener();

// ==========================================
// 5. PWA CUSTOM INSTALL POPUP & SERVICE WORKER
// ==========================================
const installModal = document.getElementById('install-modal');
const installModalText = document.getElementById('install-modal-text');
const installBtnWrap = document.getElementById('install-btn-wrap');
const btnPwaInstall = document.getElementById('btn-pwa-install');
const btnPwaDismiss = document.getElementById('btn-pwa-dismiss');

let deferredPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

function checkPwaInstallPrompt() {
  if (window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('vibe_pwa_dismissed')) {
    return;
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIos) {
    installModalText.innerHTML = "To install VibeSpace for full-screen stealth mode, tap the Share icon in Safari and select <b>'Add to Home Screen'</b>.";
    installBtnWrap.classList.add('hidden');
    setTimeout(() => {
      if (installModal) installModal.classList.remove('hidden');
    }, 2000);
  }
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  
  if (window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('vibe_pwa_dismissed')) {
    return;
  }

  installModalText.textContent = "Install this app to your home screen for the best full-screen stealth experience.";
  installBtnWrap.classList.remove('hidden');
  
  setTimeout(() => {
    if (installModal) installModal.classList.remove('hidden');
  }, 1500);
});

if (btnPwaInstall) {
  btnPwaInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('vibe_pwa_dismissed', 'true');
      }
      deferredPrompt = null;
    }
    installModal.classList.add('hidden');
  });
}

if (btnPwaDismiss) {
  btnPwaDismiss.addEventListener('click', () => {
    localStorage.setItem('vibe_pwa_dismissed', 'true');
    installModal.classList.add('hidden');
  });
}

checkPwaInstallPrompt();
