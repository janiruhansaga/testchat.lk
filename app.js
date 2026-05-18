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
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc
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
  unsubscribeStealth: null,
  
  // P2P State
  peerInstance: null,
  myPeerId: null,
  activeP2PConnections: new Map(),
  unsubscribePeers: null,
  
  // Call State
  incomingCall: null,
  activeCall: null,
  localStream: null,
  remoteStream: null
};

// --- DOM ELEMENTS ---
const calcScreen = document.getElementById('calculator-screen');
const clockScreen = document.getElementById('clock-screen');
const roomScreen = document.getElementById('room-screen');
const chatScreen = document.getElementById('chat-screen');
const stealthDot = document.getElementById('stealth-dot');
const stealthDotClock = document.getElementById('stealth-dot-clock');

const analogClock = document.getElementById('analog-clock');
const clockHandHour = document.getElementById('clock-hand-hour');
const clockHandMinute = document.getElementById('clock-hand-minute');
const clockHandSecond = document.getElementById('clock-hand-second');
const clockDigitalDisplay = document.getElementById('clock-digital-display');
const disguiseBtns = document.querySelectorAll('.disguise-btn');
const secretTimeInput = document.getElementById('secret-time-input');
const calcSettingsArea = document.getElementById('calc-settings-area');
const clockSettingsArea = document.getElementById('clock-settings-area');

function showDisguiseScreen() {
  const mode = localStorage.getItem('vibe_disguise_mode') || 'calculator';
  if (mode === 'clock') {
    if (calcScreen) {
      calcScreen.classList.remove('active');
      calcScreen.classList.add('hidden');
    }
    if (clockScreen) {
      clockScreen.classList.remove('hidden');
      clockScreen.classList.add('active');
    }
  } else {
    if (clockScreen) {
      clockScreen.classList.remove('active');
      clockScreen.classList.add('hidden');
    }
    if (calcScreen) {
      calcScreen.classList.remove('hidden');
      calcScreen.classList.add('active');
    }
  }
}

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

// Call DOM Elements
const btnVoiceCall = document.getElementById('btn-voice-call');
const btnVideoCall = document.getElementById('btn-video-call');
const incomingCallBanner = document.getElementById('incoming-call-banner');
const incomingCallIcon = document.getElementById('incoming-call-icon');
const incomingCallTitle = document.getElementById('incoming-call-title');
const incomingCallFrom = document.getElementById('incoming-call-from');
const btnAcceptCall = document.getElementById('btn-accept-call');
const btnDeclineCall = document.getElementById('btn-decline-call');
const pipCallWindow = document.getElementById('pip-call-window');
const pipDragHandle = document.getElementById('pip-drag-handle');
const pipCallStatus = document.getElementById('pip-call-status');
const btnEndCall = document.getElementById('btn-end-call');
const remoteVideoStream = document.getElementById('remote-video-stream');
const remoteAudioStream = document.getElementById('remote-audio-stream');
const localVideoStream = document.getElementById('local-video-stream');
const callAudioAvatar = document.getElementById('call-audio-avatar');

const burnModal = document.getElementById('burn-modal');
const btnConfirmBurn = document.getElementById('btn-confirm-burn');
const btnCancelBurn = document.getElementById('btn-cancel-burn');

const profileModal = document.getElementById('profile-modal');
const nicknameInput = document.getElementById('nickname-input');
const avatarPreview = document.getElementById('avatar-preview');
const colorButtons = document.querySelectorAll('.color-btn');
const btnSaveProfile = document.getElementById('btn-save-profile');
const quickEmojis = document.querySelectorAll('.vibe-emoji');
const btnAttach = document.getElementById('btn-attach');
const mediaFileInput = document.getElementById('media-file-input');
const btnCamera = document.getElementById('btn-camera');
const cameraFileInput = document.getElementById('camera-file-input');
const btnMic = document.getElementById('btn-mic');
const recordingIndicator = document.getElementById('recording-indicator');
const recordingTimeEl = document.getElementById('recording-time');

const replyPreviewBox = document.getElementById('reply-preview-box');
const replyPreviewAuthor = document.getElementById('reply-preview-author');
const replyPreviewText = document.getElementById('reply-preview-text');
const btnCloseReply = document.getElementById('btn-close-reply');
let currentReplyData = null;

if (btnCloseReply) {
  btnCloseReply.addEventListener('click', () => {
    currentReplyData = null;
    if (replyPreviewBox) replyPreviewBox.classList.add('hidden');
  });
}

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
  // 🚨 REAL SECRET TRIGGER CHECK: 7788 + = (or custom code)
  const customUnlock = localStorage.getItem('vibe_custom_unlock') || '7788';
  if (state.displayValue === customUnlock) {
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
          if (stealthDot) stealthDot.classList.remove('hidden');
          if (stealthDotClock) stealthDotClock.classList.remove('hidden');
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
          if (stealthDot) stealthDot.classList.remove('hidden');
          if (stealthDotClock) stealthDotClock.classList.remove('hidden');
        }
        lastLen = curLen;
      }
    });
  }
}

function openRoomSelection() {
  state.isRoomSelectOpen = true;
  if (stealthDot) stealthDot.classList.add('hidden');
  if (stealthDotClock) stealthDotClock.classList.add('hidden');
  if (state.unsubscribeStealth) {
    state.unsubscribeStealth();
    state.unsubscribeStealth = null;
  }
  
  resetCalculator();
  if (calcScreen) {
    calcScreen.classList.remove('active');
    calcScreen.classList.add('hidden');
  }
  if (clockScreen) {
    clockScreen.classList.remove('active');
    clockScreen.classList.add('hidden');
  }
  
  roomIdInput.value = "";
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

  showDisguiseScreen();
  startStealthBackgroundListener();
});

function openSecretChat() {
  state.isSecretChatOpen = true;
  if (stealthDot) stealthDot.classList.add('hidden');
  if (stealthDotClock) stealthDotClock.classList.add('hidden');
  if (state.unsubscribeStealth) {
    state.unsubscribeStealth();
    state.unsubscribeStealth = null;
  }
  
  resetCalculator();
  if (calcScreen) {
    calcScreen.classList.remove('active');
    calcScreen.classList.add('hidden');
  }
  if (clockScreen) {
    clockScreen.classList.remove('active');
    clockScreen.classList.add('hidden');
  }
  
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
  
  showDisguiseScreen();
  
  if (state.unsubscribeChat) {
    state.unsubscribeChat();
    state.unsubscribeChat = null;
  }
  
  cleanupPeerJS();
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

// --- APP SETTINGS LOGIC ---
const btnAppSettings = document.getElementById('settings-btn') || document.getElementById('btn-app-settings');
const appSettingsModal = document.getElementById('app-settings-modal');
const customUnlockInput = document.getElementById('custom-unlock-input');
const btnDeleteRoom = document.getElementById('btn-delete-room');
const btnCloseAppSettings = document.getElementById('btn-close-app-settings');
const fontBtns = document.querySelectorAll('.font-btn');
const btnToggleBiometric = document.getElementById('btn-toggle-biometric');

function updateBiometricToggleUI() {
  if (!btnToggleBiometric) return;
  const isEnabled = localStorage.getItem('vibe_biometric_enabled') === 'true';
  if (isEnabled) btnToggleBiometric.classList.add('active');
  else btnToggleBiometric.classList.remove('active');
}

if (btnToggleBiometric) {
  btnToggleBiometric.addEventListener('click', async () => {
    const isCurrentlyEnabled = localStorage.getItem('vibe_biometric_enabled') === 'true';
    if (isCurrentlyEnabled) {
      localStorage.setItem('vibe_biometric_enabled', 'false');
      updateBiometricToggleUI();
      showToastNotification("Biometric unlock disabled.");
    } else {
      const success = await registerBiometric();
      if (success) {
        updateBiometricToggleUI();
      }
    }
  });
}

const deleteRoomModal = document.getElementById('delete-room-modal');
const btnConfirmDeleteRoom = document.getElementById('btn-confirm-delete-room');
const btnCancelDeleteRoom = document.getElementById('btn-cancel-delete-room');
const deleteRoomIdTag = document.getElementById('delete-room-id-tag');

function applyChatFontSize(size) {
  const root = document.documentElement;
  if (size === 'small') root.style.setProperty('--chat-font-size', '0.8rem');
  else if (size === 'large') root.style.setProperty('--chat-font-size', '1.15rem');
  else root.style.setProperty('--chat-font-size', '0.95rem');
}

// Initial font size apply
const savedFontSize = localStorage.getItem('vibe_chat_font_size') || 'medium';
applyChatFontSize(savedFontSize);

function updateDisguiseModeUI() {
  const currentMode = localStorage.getItem('vibe_disguise_mode') || 'calculator';
  disguiseBtns.forEach(b => {
    if (b.dataset.mode === currentMode) b.classList.add('active');
    else b.classList.remove('active');
  });
  if (currentMode === 'clock') {
    if (calcSettingsArea) calcSettingsArea.style.display = 'none';
    if (clockSettingsArea) clockSettingsArea.style.display = 'flex';
  } else {
    if (calcSettingsArea) calcSettingsArea.style.display = 'flex';
    if (clockSettingsArea) clockSettingsArea.style.display = 'none';
  }
}

if (btnAppSettings) {
  btnAppSettings.addEventListener('click', () => {
    const currentSize = localStorage.getItem('vibe_chat_font_size') || 'medium';
    fontBtns.forEach(btn => {
      if (btn.dataset.size === currentSize) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    if (customUnlockInput) {
      customUnlockInput.value = localStorage.getItem('vibe_custom_unlock') || '7788';
    }
    if (secretTimeInput) {
      secretTimeInput.value = localStorage.getItem('vibe_secret_time') || '12:15';
    }
    updateDisguiseModeUI();
    updateBiometricToggleUI();

    if (appSettingsModal) appSettingsModal.classList.remove('hidden');
  });
}

disguiseBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    localStorage.setItem('vibe_disguise_mode', mode);
    updateDisguiseModeUI();
    showDisguiseScreen();
  });
});

if (secretTimeInput) {
  secretTimeInput.addEventListener('input', e => {
    localStorage.setItem('vibe_secret_time', e.target.value);
  });
}

fontBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    fontBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const size = btn.dataset.size;
    localStorage.setItem('vibe_chat_font_size', size);
    applyChatFontSize(size);
  });
});

if (customUnlockInput) {
  customUnlockInput.addEventListener('input', e => {
    const val = e.target.value.trim();
    if (/^\d+$/.test(val)) {
      localStorage.setItem('vibe_custom_unlock', val);
    }
  });
}

if (btnCloseAppSettings) {
  btnCloseAppSettings.addEventListener('click', () => {
    if (customUnlockInput) {
      const val = customUnlockInput.value.trim();
      if (/^\d+$/.test(val)) {
        localStorage.setItem('vibe_custom_unlock', val);
      }
    }
    if (appSettingsModal) appSettingsModal.classList.add('hidden');
  });
}

if (btnDeleteRoom) {
  btnDeleteRoom.addEventListener('click', () => {
    if (appSettingsModal) appSettingsModal.classList.add('hidden');
    if (deleteRoomIdTag) deleteRoomIdTag.textContent = '#' + state.roomId;
    if (deleteRoomModal) deleteRoomModal.classList.remove('hidden');
  });
}

if (btnCancelDeleteRoom) {
  btnCancelDeleteRoom.addEventListener('click', () => {
    if (deleteRoomModal) deleteRoomModal.classList.add('hidden');
  });
}

if (btnConfirmDeleteRoom) {
  btnConfirmDeleteRoom.addEventListener('click', async () => {
    if (deleteRoomModal) deleteRoomModal.classList.add('hidden');
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
        console.error("Error deleting room history:", e);
      }
    }
    const localKey = 'vibe_messages_' + state.roomId;
    localStorage.removeItem(localKey);
    localStorage.removeItem('vibe_room_id');
    showToastNotification("Room deleted permanently 🗑️");
    lockAndExitChat();
  });
}


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
let toastTimeout = null;

function showToastNotification(message) {
  const toast = document.getElementById('room-toast');
  const toastText = document.getElementById('room-toast-text');
  if (!toast || !toastText) return;

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastText.textContent = message;
  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    toastTimeout = null;
  }, 4000);
}

async function checkRoomAccessTime() {
  if (state.isDecoyMode) {
    showToastNotification("Decoy Room initialized securely");
    return;
  }

  if (!isFirebasePlaceholder && db) {
    try {
      const roomDocRef = doc(db, "rooms", state.roomId);
      const roomSnap = await getDoc(roomDocRef);

      if (roomSnap.exists()) {
        const data = roomSnap.data();
        if (data && data.lastAccessed) {
          let dateObj = null;
          if (data.lastAccessed.toDate) {
            dateObj = data.lastAccessed.toDate();
          } else if (typeof data.lastAccessed === 'number' || typeof data.lastAccessed === 'string') {
            dateObj = new Date(data.lastAccessed);
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            const formattedTime = dateObj.toLocaleString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            showToastNotification(`Room last accessed: ${formattedTime}`);
          } else {
            showToastNotification("Room created successfully");
          }
        } else {
          showToastNotification("Room created successfully");
        }

        // Immediately update with current timestamp
        await updateDoc(roomDocRef, {
          lastAccessed: serverTimestamp()
        });
      } else {
        showToastNotification("Room created successfully");
        await setDoc(roomDocRef, {
          createdAt: serverTimestamp(),
          lastAccessed: serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Failed to fetch room access timestamp from Firebase, falling back to local:", e);
      checkRoomAccessTimeLocal();
    }
  } else {
    checkRoomAccessTimeLocal();
  }
}

function checkRoomAccessTimeLocal() {
  if (state.isDecoyMode) {
    showToastNotification("Decoy Room initialized securely");
    return;
  }

  const localKey = `vibe_room_last_accessed_${state.roomId}`;
  const prevAccess = localStorage.getItem(localKey);
  
  if (prevAccess) {
    const dateObj = new Date(prevAccess);
    if (!isNaN(dateObj.getTime())) {
      const formattedTime = dateObj.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      showToastNotification(`Room last accessed: ${formattedTime}`);
    } else {
      showToastNotification("Room created successfully");
    }
  } else {
    showToastNotification("Room created successfully");
  }

  localStorage.setItem(localKey, new Date().toISOString());
}

function initChatBackend() {
  if (!isFirebasePlaceholder && db) {
    try {
      messagesCollection = collection(db, "rooms", state.roomId, "messages");
      demoBanner.classList.add('hidden');
      onlineStatus.textContent = state.isDecoyMode ? "🔒 E2E Encrypted (Innocent Room)" : `🔒 E2E Encrypted (Room: #${state.roomId})`;
      startFirebaseRealtime();
      checkRoomAccessTime();
      initPeerJS();
    } catch (e) {
      console.warn("Firebase Init failed, switching to Local Demo mode", e);
      startLocalDemoMode();
      checkRoomAccessTimeLocal();
      initPeerJS();
    }
  } else {
    startLocalDemoMode();
    checkRoomAccessTimeLocal();
    initPeerJS();
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
    let replyPayload = null;
    if (currentReplyData) {
      replyPayload = {
        author: currentReplyData.author,
        text: encryptText(currentReplyData.text)
      };
    }
    await addDoc(messagesCollection, {
      text: encryptedText,
      author: state.nickname,
      avatarColor: state.avatarColor,
      createdAt: serverTimestamp(),
      timestampStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEncrypted: true,
      replyTo: replyPayload
    });

    currentReplyData = null;
    if (replyPreviewBox) replyPreviewBox.classList.add('hidden');
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
  let replyPayload = null;
  if (currentReplyData) {
    replyPayload = {
      author: currentReplyData.author,
      text: encryptText(currentReplyData.text)
    };
  }
  const newMsg = {
    id: Date.now().toString(),
    text: encryptedText,
    author: state.nickname,
    avatarColor: state.avatarColor,
    timestampStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isEncrypted: true,
    replyTo: replyPayload
  };
  localMessages.push(newMsg);
  if (localMessages.length > 100) localMessages.shift();
  
  localStorage.setItem(getLocalKey(), JSON.stringify(localMessages));
  window.dispatchEvent(new Event('local_msg_update_' + state.roomId));

  currentReplyData = null;
  if (replyPreviewBox) replyPreviewBox.classList.add('hidden');
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

  let quotedHtml = '';
  if (data.replyTo && data.replyTo.author) {
    let quotedText = data.replyTo.text;
    if (quotedText && quotedText.startsWith('U2Fsd')) {
      quotedText = decryptText(quotedText);
    }
    quotedHtml = `
      <div class="quoted-message-box">
        <span class="quoted-author">${escapeHtml(data.replyTo.author)}</span>
        <div class="quoted-text">${escapeHtml(quotedText)}</div>
      </div>
    `;
  }
  
  wrap.innerHTML = `
    <div class="msg-avatar" style="background-color: ${data.avatarColor || '#8a78f7'};">
      ${initial}
    </div>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-author">${escapeHtml(data.author)}</span>
        <span class="msg-time">${data.timestampStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div class="msg-header-actions">
          <button type="button" class="btn-msg-reply" title="Reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a1 1 0 0 1-1.71.71l-6-6a1 1 0 0 1 0-1.42l6-6a1 1 0 0 1 1.71.71v4h4c5 0 9 4 9 9 0 2.82-1.35 5.3-3.46 6.94-.37.28-.92.05-.92-.41 0-.9-1-5.53-8.62-5.53h-1z"></path></svg>
          </button>
        </div>
      </div>
      <div class="msg-bubble">${quotedHtml}${escapeHtml(displayText)}</div>
    </div>
  `;
  
  const replyBtn = wrap.querySelector('.btn-msg-reply');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      currentReplyData = { author: data.author || 'User', text: displayText };
      if (replyPreviewAuthor) replyPreviewAuthor.textContent = escapeHtml(data.author || 'User');
      if (replyPreviewText) replyPreviewText.textContent = escapeHtml(displayText);
      if (replyPreviewBox) replyPreviewBox.classList.remove('hidden');
      if (chatInput) chatInput.focus();
    });
  }

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

// ==========================================
// P2P WEBRTC MEDIA SHARING (PEERJS)
// ==========================================
function initPeerJS() {
  if (!window.Peer) {
    console.warn("[PeerJS] Library not loaded");
    return;
  }
  cleanupPeerJS();

  try {
    const peer = new window.Peer();
    state.peerInstance = peer;

    peer.on('open', async (id) => {
      state.myPeerId = id;
      console.log("[PeerJS] Peer open with ID:", id);

      if (!isFirebasePlaceholder && db && !state.isDecoyMode) {
        try {
          const peerRef = doc(db, "rooms", state.roomId, "peers", id);
          await setDoc(peerRef, {
            nickname: state.nickname,
            joinedAt: serverTimestamp()
          });

          const peersCol = collection(db, "rooms", state.roomId, "peers");
          state.unsubscribePeers = onSnapshot(peersCol, snapshot => {
            snapshot.forEach(docSnap => {
              const otherId = docSnap.id;
              if (otherId !== state.myPeerId && !state.activeP2PConnections.has(otherId)) {
                connectToPeer(otherId);
              }
            });
          });
        } catch (err) {
          console.warn("[PeerJS] Firebase peer discovery failed, using local fallback", err);
          startLocalPeerDiscovery(id);
        }
      } else {
        startLocalPeerDiscovery(id);
      }
    });

    peer.on('connection', (conn) => {
      console.log("[PeerJS] Incoming connection from:", conn.peer);
      setupDataChannel(conn);
    });

    peer.on('call', handleIncomingCallStream);

    peer.on('error', (err) => {
      console.warn("[PeerJS] Error:", err);
    });
  } catch (err) {
    console.error("[PeerJS] Initialization failed:", err);
  }
}

function connectToPeer(otherPeerId) {
  if (!state.peerInstance) return;
  try {
    const conn = state.peerInstance.connect(otherPeerId, { reliable: true });
    setupDataChannel(conn);
  } catch (err) {
    console.warn("[PeerJS] Connection error:", err);
  }
}

function setupDataChannel(conn) {
  conn.on('open', () => {
    console.log("[PeerJS] Data channel open with:", conn.peer);
    state.activeP2PConnections.set(conn.peer, conn);
    showToastNotification(`P2P direct stream connected ✨`);
  });

  conn.on('data', (data) => {
    if (data && data.type === 'p2p-media') {
      handleIncomingMedia(data);
    } else if (data && data.type === 'p2p-photo') {
      handleIncomingPhoto(data);
    } else if (data && data.type === 'p2p-voice') {
      handleIncomingVoice(data);
    } else if (data && data.type === 'call-signal') {
      handleIncomingCallSignal(data);
    } else if (data && data.type === 'call-declined') {
      showToastNotification(`${data.senderNickname} declined the call.`);
    } else if (data && data.type === 'call-ended') {
      endCurrentCall();
    }
  });

  conn.on('close', () => {
    state.activeP2PConnections.delete(conn.peer);
  });

  conn.on('error', () => {
    state.activeP2PConnections.delete(conn.peer);
  });
}

// ==========================================
// P2P VOICE & VIDEO CALLS (PiP & SILENT RINGING)
// ==========================================

if (btnVoiceCall) {
  btnVoiceCall.addEventListener('click', () => initiateCallSignal('voice'));
}
if (btnVideoCall) {
  btnVideoCall.addEventListener('click', () => initiateCallSignal('video'));
}

function initiateCallSignal(callType) {
  if (state.activeP2PConnections.size === 0) {
    showToastNotification("P2P Error: No online peers in room to call.");
    return;
  }
  if (state.activeCall || state.localStream) {
    showToastNotification("A call is already active.");
    return;
  }

  const payload = {
    type: 'call-signal',
    callType,
    senderNickname: state.nickname,
    senderPeerId: state.myPeerId
  };

  state.activeP2PConnections.forEach(conn => conn.send(payload));
  showToastNotification(`Silent ${callType} call signal sent to room members...`);
}

function handleIncomingCallSignal(data) {
  if (state.activeCall || state.localStream || incomingCallBanner.classList.contains('active')) {
    return;
  }

  state.incomingCall = {
    senderPeerId: data.senderPeerId,
    callType: data.callType,
    senderNickname: data.senderNickname
  };

  if (incomingCallFrom) incomingCallFrom.textContent = data.senderNickname;
  if (incomingCallTitle) incomingCallTitle.textContent = `Incoming ${data.callType} Call`;
  if (incomingCallIcon) incomingCallIcon.textContent = data.callType === 'video' ? '📹' : '📞';

  if (incomingCallBanner) incomingCallBanner.classList.remove('hidden');
}

if (btnDeclineCall) {
  btnDeclineCall.addEventListener('click', () => {
    if (incomingCallBanner) incomingCallBanner.classList.add('hidden');
    if (state.incomingCall && state.activeP2PConnections.has(state.incomingCall.senderPeerId)) {
      const conn = state.activeP2PConnections.get(state.incomingCall.senderPeerId);
      conn.send({ type: 'call-declined', senderNickname: state.nickname });
    }
    state.incomingCall = null;
  });
}

if (btnAcceptCall) {
  btnAcceptCall.addEventListener('click', async () => {
    if (incomingCallBanner) incomingCallBanner.classList.add('hidden');
    if (!state.incomingCall) return;

    const { senderPeerId, callType, senderNickname } = state.incomingCall;
    state.incomingCall = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === 'video',
        audio: true
      });
      state.localStream = stream;

      if (callType === 'video') {
        if (localVideoStream) {
          localVideoStream.srcObject = stream;
          localVideoStream.classList.remove('hidden');
        }
        if (callAudioAvatar) callAudioAvatar.classList.add('hidden');
      } else {
        if (localVideoStream) localVideoStream.classList.add('hidden');
        if (callAudioAvatar) {
          callAudioAvatar.textContent = "🎙️ Audio Call Active";
          callAudioAvatar.classList.remove('hidden');
        }
      }

      if (pipCallWindow) pipCallWindow.classList.remove('hidden');
      if (pipCallStatus) pipCallStatus.textContent = `Calling ${senderNickname}...`;

      const call = state.peerInstance.call(senderPeerId, stream, {
        metadata: { nickname: state.nickname, callType }
      });
      setupCallHandlers(call, callType);
    } catch (err) {
      console.error("[PeerJS] Error accessing media devices:", err);
      showToastNotification("Could not access camera or microphone.");
      endCurrentCall();
    }
  });
}

function handleIncomingCallStream(call) {
  const callType = call.metadata?.callType || 'voice';
  const callerNickname = call.metadata?.nickname || 'Peer';

  async function answerCall() {
    try {
      if (!state.localStream) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true
        });
        state.localStream = stream;
        if (callType === 'video') {
          if (localVideoStream) {
            localVideoStream.srcObject = stream;
            localVideoStream.classList.remove('hidden');
          }
          if (callAudioAvatar) callAudioAvatar.classList.add('hidden');
        } else {
          if (localVideoStream) localVideoStream.classList.add('hidden');
          if (callAudioAvatar) {
            callAudioAvatar.textContent = "🎙️ Audio Call Active";
            callAudioAvatar.classList.remove('hidden');
          }
        }
      }

      if (pipCallWindow) pipCallWindow.classList.remove('hidden');
      if (pipCallStatus) pipCallStatus.textContent = `Connected with ${callerNickname}`;

      call.answer(state.localStream);
      setupCallHandlers(call, callType);
    } catch (err) {
      console.error("[PeerJS] Error answering call:", err);
      showToastNotification("Failed to connect call media.");
      endCurrentCall();
    }
  }

  answerCall();
}

function setupCallHandlers(call, callType) {
  state.activeCall = call;

  call.on('stream', remoteStream => {
    state.remoteStream = remoteStream;
    if (pipCallStatus) pipCallStatus.textContent = `Call in progress`;

    if (callType === 'video') {
      if (remoteVideoStream) {
        remoteVideoStream.srcObject = remoteStream;
        remoteVideoStream.classList.remove('hidden');
      }
      if (callAudioAvatar) callAudioAvatar.classList.add('hidden');
    } else {
      if (remoteAudioStream) {
        remoteAudioStream.srcObject = remoteStream;
      }
      if (remoteVideoStream) remoteVideoStream.classList.add('hidden');
      if (callAudioAvatar) {
        callAudioAvatar.textContent = `🎙️ Audio Call with ${call.metadata?.nickname || 'Peer'}`;
        callAudioAvatar.classList.remove('hidden');
      }
    }
  });

  call.on('close', () => {
    endCurrentCall();
  });
  call.on('error', () => {
    endCurrentCall();
  });
}

if (btnEndCall) {
  btnEndCall.addEventListener('click', () => {
    state.activeP2PConnections.forEach(conn => conn.send({ type: 'call-ended' }));
    endCurrentCall();
  });
}

function endCurrentCall() {
  if (state.activeCall) {
    state.activeCall.close();
    state.activeCall = null;
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach(track => track.stop());
    state.localStream = null;
  }
  state.remoteStream = null;

  if (localVideoStream) {
    localVideoStream.srcObject = null;
    localVideoStream.classList.add('hidden');
  }
  if (remoteVideoStream) {
    remoteVideoStream.srcObject = null;
    remoteVideoStream.classList.add('hidden');
  }
  if (remoteAudioStream) {
    remoteAudioStream.srcObject = null;
  }
  if (callAudioAvatar) callAudioAvatar.classList.add('hidden');

  if (pipCallWindow) pipCallWindow.classList.add('hidden');
  if (incomingCallBanner) incomingCallBanner.classList.add('hidden');
  state.incomingCall = null;
  showToastNotification("Call ended.");
}

// PiP WINDOW DRAGGING LOGIC
let isPipDragging = false;
let pipStartX = 0, pipStartY = 0;
let pipInitialX = 0, pipInitialY = 0;

if (pipDragHandle && pipCallWindow) {
  pipDragHandle.addEventListener('pointerdown', e => {
    isPipDragging = true;
    pipDragHandle.setPointerCapture(e.pointerId);
    pipStartX = e.clientX;
    pipStartY = e.clientY;
    const rect = pipCallWindow.getBoundingClientRect();
    pipInitialX = rect.left;
    pipInitialY = rect.top;
  });

  pipDragHandle.addEventListener('pointermove', e => {
    if (!isPipDragging) return;
    const dx = e.clientX - pipStartX;
    const dy = e.clientY - pipStartY;
    let newX = pipInitialX + dx;
    let newY = pipInitialY + dy;

    newX = Math.max(10, Math.min(window.innerWidth - pipCallWindow.offsetWidth - 10, newX));
    newY = Math.max(10, Math.min(window.innerHeight - pipCallWindow.offsetHeight - 10, newY));

    pipCallWindow.style.left = `${newX}px`;
    pipCallWindow.style.top = `${newY}px`;
    pipCallWindow.style.right = 'auto';
    pipCallWindow.style.bottom = 'auto';
  });

  pipDragHandle.addEventListener('pointerup', e => {
    if (!isPipDragging) return;
    isPipDragging = false;
    try { pipDragHandle.releasePointerCapture(e.pointerId); } catch(err){}
  });
}

function startLocalPeerDiscovery(id) {
  const localKey = 'vibe_peers_' + state.roomId;
  let peers = JSON.parse(localStorage.getItem(localKey) || '[]');
  if (!peers.includes(id)) {
    peers.push(id);
    localStorage.setItem(localKey, JSON.stringify(peers));
  }

  peers.forEach(otherId => {
    if (otherId !== id && !state.activeP2PConnections.has(otherId)) {
      connectToPeer(otherId);
    }
  });

  window.addEventListener('storage', e => {
    if (e.key === localKey && state.isSecretChatOpen) {
      const curPeers = JSON.parse(localStorage.getItem(localKey) || '[]');
      curPeers.forEach(otherId => {
        if (otherId !== state.myPeerId && !state.activeP2PConnections.has(otherId)) {
          connectToPeer(otherId);
        }
      });
    }
  });
}

async function cleanupPeerJS() {
  if (state.unsubscribePeers) {
    state.unsubscribePeers();
    state.unsubscribePeers = null;
  }
  if (state.myPeerId) {
    if (!isFirebasePlaceholder && db && !state.isDecoyMode) {
      try {
        await deleteDoc(doc(db, "rooms", state.roomId, "peers", state.myPeerId));
      } catch(e) {}
    }
    const localKey = 'vibe_peers_' + state.roomId;
    let peers = JSON.parse(localStorage.getItem(localKey) || '[]');
    peers = peers.filter(p => p !== state.myPeerId);
    localStorage.setItem(localKey, JSON.stringify(peers));
  }
  if (state.peerInstance) {
    state.peerInstance.destroy();
    state.peerInstance = null;
  }
  state.activeP2PConnections.clear();
  state.myPeerId = null;
}

window.addEventListener('beforeunload', () => {
  cleanupPeerJS();
});

if (btnAttach && mediaFileInput) {
  btnAttach.addEventListener('click', () => {
    if (state.activeP2PConnections.size === 0) {
      showToastNotification("P2P Error: No online peers in room to receive file.");
      return;
    }
    mediaFileInput.click();
  });

  mediaFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (state.activeP2PConnections.size === 0) {
      showToastNotification("P2P Error: No online peers in room to receive file.");
      mediaFileInput.value = "";
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const payload = {
        type: 'p2p-media',
        fileName: file.name,
        fileType: file.type,
        data: arrayBuffer,
        senderNickname: state.nickname,
        senderAvatarColor: state.avatarColor,
        timestampStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      state.activeP2PConnections.forEach(conn => {
        conn.send(payload);
      });

      renderMediaMessage({
        isSelf: true,
        fileName: file.name,
        fileType: file.type,
        blobUrl: URL.createObjectURL(file),
        author: state.nickname,
        avatarColor: state.avatarColor,
        timestampStr: payload.timestampStr
      });

      showToastNotification("File sent via P2P direct stream 🚀");
    } catch (err) {
      console.error("[PeerJS] Error sending file:", err);
      showToastNotification("Failed to send P2P media file.");
    } finally {
      mediaFileInput.value = "";
    }
  });
}

function handleIncomingMedia(data) {
  try {
    const blob = new Blob([data.data], { type: data.fileType });
    const blobUrl = URL.createObjectURL(blob);
    renderMediaMessage({
      isSelf: false,
      fileName: data.fileName,
      fileType: data.fileType,
      blobUrl,
      author: data.senderNickname,
      avatarColor: data.senderAvatarColor,
      timestampStr: data.timestampStr
    });
    playNotificationSound();
    showToastNotification(`Received P2P file from ${data.senderNickname} ✨`);
  } catch (err) {
    console.error("[PeerJS] Error processing incoming media:", err);
  }
}

function startMediaBurnTimer(wrap, durationSec = 120, blobUrl = null) {
  const container = document.createElement('div');
  container.className = 'burn-timer-container';
  container.innerHTML = `
    <div class="burn-timer-header">
      <span class="burn-icon">🔥 Disappearing in</span>
      <span class="burn-time-label"><b class="burn-time-num">2:00</b></span>
    </div>
    <div class="burn-progress-bar">
      <div class="burn-progress-fill" style="width: 100%;"></div>
    </div>
  `;
  const bubble = wrap.querySelector('.msg-bubble');
  if (bubble) {
    bubble.appendChild(container);
  } else {
    wrap.querySelector('.msg-content').appendChild(container);
  }

  const timeNum = container.querySelector('.burn-time-num');
  const fill = container.querySelector('.burn-progress-fill');
  let timeLeft = durationSec;

  const interval = setInterval(() => {
    timeLeft--;
    const mins = Math.floor(timeLeft / 60);
    const secs = (timeLeft % 60).toString().padStart(2, '0');
    if (timeNum) timeNum.textContent = `${mins}:${secs}`;
    if (fill) fill.style.width = `${(timeLeft / durationSec) * 100}%`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      wrap.classList.add('burning');
      setTimeout(() => {
        wrap.remove();
        if (blobUrl) {
          try { URL.revokeObjectURL(blobUrl); } catch(e){}
        }
      }, 500);
    }
  }, 1000);
}

function renderMediaMessage(mediaData) {
  const isSelf = mediaData.isSelf;
  const wrap = document.createElement('div');
  wrap.className = `message-wrapper ${isSelf ? 'sent' : 'received'}`;
  
  const initial = mediaData.author ? mediaData.author.charAt(0).toUpperCase() : 'V';
  
  const fileType = mediaData.fileType || '';
  const isImage = fileType.startsWith('image/');
  const isVideo = fileType.startsWith('video/');
  const isAudio = fileType.startsWith('audio/');

  let mediaHtml = '';
  if (isImage) {
    mediaHtml = `<img src="${mediaData.blobUrl}" class="p2p-attachment-image" alt="Image Attachment" style="width: 100%; max-height: 280px; object-fit: cover; border-radius: 8px; display: block;">`;
  } else if (isVideo) {
    mediaHtml = `<video controls src="${mediaData.blobUrl}" class="p2p-video"></video>`;
  } else if (isAudio) {
    mediaHtml = `<audio controls src="${mediaData.blobUrl}" class="p2p-audio"></audio>`;
  } else {
    mediaHtml = `<div class="file-icon-box" style="padding: 20px; text-align: center; font-size: 2.5rem;">📄</div>`;
  }

  const downloadOverlayHtml = `
    <a href="${mediaData.blobUrl}" download="${escapeHtml(mediaData.fileName || 'media-attachment')}" class="btn-download-overlay" title="Download Media">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Download</span>
    </a>
  `;

  wrap.innerHTML = `
    <div class="msg-avatar" style="background-color: ${mediaData.avatarColor || '#8a78f7'};">
      ${initial}
    </div>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-author">${escapeHtml(mediaData.author)}</span>
        <span class="msg-time">${mediaData.timestampStr}</span>
        <div class="msg-header-actions">
          <button type="button" class="btn-msg-reply" title="Reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a1 1 0 0 1-1.71.71l-6-6a1 1 0 0 1 0-1.42l6-6a1 1 0 0 1 1.71.71v4h4c5 0 9 4 9 9 0 2.82-1.35 5.3-3.46 6.94-.37.28-.92.05-.92-.41 0-.9-1-5.53-8.62-5.53h-1z"></path></svg>
          </button>
        </div>
      </div>
      <div class="msg-bubble p2p-media-bubble">
        <div class="msg-media-box">
          <div class="media-player-wrap">
            ${mediaHtml}
            ${downloadOverlayHtml}
          </div>
          <div class="media-file-info">
            <span class="media-name" title="${escapeHtml(mediaData.fileName)}">${escapeHtml(mediaData.fileName)}</span>
            <a href="${mediaData.blobUrl}" download="${escapeHtml(mediaData.fileName)}" class="btn-save-device">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Save</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const replyBtn = wrap.querySelector('.btn-msg-reply');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      currentReplyData = { author: mediaData.author || 'User', text: `[Attachment: ${mediaData.fileName || 'Media File'}]` };
      if (replyPreviewAuthor) replyPreviewAuthor.textContent = escapeHtml(mediaData.author || 'User');
      if (replyPreviewText) replyPreviewText.textContent = `[Attachment: ${mediaData.fileName || 'Media File'}]`;
      if (replyPreviewBox) replyPreviewBox.classList.remove('hidden');
      if (chatInput) chatInput.focus();
    });
  }

  chatMessages.appendChild(wrap);
  scrollToBottom();

  startMediaBurnTimer(wrap, 120, mediaData.blobUrl);
}

if (btnCamera && cameraFileInput) {
  btnCamera.addEventListener('click', () => {
    if (state.activeP2PConnections.size === 0) {
      showToastNotification("P2P Error: No online peers in room to receive photo.");
      return;
    }
    cameraFileInput.click();
  });

  cameraFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (state.activeP2PConnections.size === 0) {
      showToastNotification("P2P Error: No online peers in room to receive photo.");
      cameraFileInput.value = "";
      return;
    }

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          const arrayBuffer = await blob.arrayBuffer();
          const payload = {
            type: 'p2p-photo',
            fileName: file.name || 'live-photo.jpg',
            fileType: blob.type,
            data: arrayBuffer,
            senderNickname: state.nickname,
            senderAvatarColor: state.avatarColor,
            timestampStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          state.activeP2PConnections.forEach(conn => conn.send(payload));

          renderPhotoMessage({
            isSelf: true,
            blobUrl: URL.createObjectURL(blob),
            author: state.nickname,
            avatarColor: state.avatarColor,
            timestampStr: payload.timestampStr
          });

          showToastNotification("Live stealth photo sent 🔥 (2m burn)");
        }, 'image/jpeg', 0.85);
      };
    } catch (err) {
      console.error("[PeerJS] Error capturing photo:", err);
      showToastNotification("Failed to process live photo.");
    } finally {
      cameraFileInput.value = "";
    }
  });
}

function handleIncomingPhoto(data) {
  try {
    const blob = new Blob([data.data], { type: data.fileType || 'image/jpeg' });
    const blobUrl = URL.createObjectURL(blob);
    renderPhotoMessage({
      isSelf: false,
      blobUrl,
      author: data.senderNickname,
      avatarColor: data.senderAvatarColor,
      timestampStr: data.timestampStr
    });
    playNotificationSound();
    showToastNotification(`Received live photo from ${data.senderNickname} 🔥 (2m burn)`);
  } catch (err) {
    console.error("[PeerJS] Error processing incoming photo:", err);
  }
}

function renderPhotoMessage(photoData) {
  const isSelf = photoData.isSelf;
  const wrap = document.createElement('div');
  wrap.className = `message-wrapper ${isSelf ? 'sent' : 'received'}`;
  
  const initial = photoData.author ? photoData.author.charAt(0).toUpperCase() : 'V';

  const downloadOverlayHtml = `
    <a href="${photoData.blobUrl}" download="${escapeHtml(photoData.fileName || 'live-photo.jpg')}" class="btn-download-overlay" title="Download Live Photo">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Download</span>
    </a>
  `;

  wrap.innerHTML = `
    <div class="msg-avatar" style="background-color: ${photoData.avatarColor || '#8a78f7'};">
      ${initial}
    </div>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-author">${escapeHtml(photoData.author)}</span>
        <span class="msg-time">${photoData.timestampStr}</span>
        <div class="msg-header-actions">
          <button type="button" class="btn-msg-reply" title="Reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a1 1 0 0 1-1.71.71l-6-6a1 1 0 0 1 0-1.42l6-6a1 1 0 0 1 1.71.71v4h4c5 0 9 4 9 9 0 2.82-1.35 5.3-3.46 6.94-.37.28-.92.05-.92-.41 0-.9-1-5.53-8.62-5.53h-1z"></path></svg>
          </button>
        </div>
      </div>
      <div class="msg-bubble p2p-media-bubble">
        <div class="msg-photo-box">
          <div class="photo-img-wrap">
            <img src="${photoData.blobUrl}" class="p2p-live-photo" alt="Live Photo Capture">
            ${downloadOverlayHtml}
          </div>
        </div>
      </div>
    </div>
  `;
  
  const replyBtn = wrap.querySelector('.btn-msg-reply');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      currentReplyData = { author: photoData.author || 'User', text: '[Live Photo Capture]' };
      if (replyPreviewAuthor) replyPreviewAuthor.textContent = escapeHtml(photoData.author || 'User');
      if (replyPreviewText) replyPreviewText.textContent = '[Live Photo Capture]';
      if (replyPreviewBox) replyPreviewBox.classList.remove('hidden');
      if (chatInput) chatInput.focus();
    });
  }

  chatMessages.appendChild(wrap);
  scrollToBottom();

  startMediaBurnTimer(wrap, 120, photoData.blobUrl);
}

// --- VOICE RECORDING (HOLD-TO-RECORD) ---
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = 0;
let isRecording = false;

async function startVoiceRecording() {
  if (isRecording) return;
  if (state.activeP2PConnections.size === 0) {
    showToastNotification("P2P Error: No online peers in room to receive voice note.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      if (audioChunks.length === 0) return;

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      if (audioBlob.size < 500) {
        showToastNotification("Voice message too short.");
        return;
      }

      const arrayBuffer = await audioBlob.arrayBuffer();
      const payload = {
        type: 'p2p-voice',
        fileName: `VoiceNote_${Date.now()}.webm`,
        fileType: audioBlob.type,
        data: arrayBuffer,
        senderNickname: state.nickname,
        senderAvatarColor: state.avatarColor,
        timestampStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      state.activeP2PConnections.forEach(conn => conn.send(payload));

      renderVoiceMessage({
        isSelf: true,
        blobUrl: URL.createObjectURL(audioBlob),
        author: state.nickname,
        avatarColor: state.avatarColor,
        timestampStr: payload.timestampStr
      });

      showToastNotification("Voice message sent 🎤");
    };

    mediaRecorder.start();
    isRecording = true;
    if (btnMic) btnMic.classList.add('recording');
    if (recordingIndicator) recordingIndicator.classList.remove('hidden');

    recordingStartTime = Date.now();
    if (recordingTimer) clearInterval(recordingTimer);
    recordingTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = (elapsed % 60).toString().padStart(2, '0');
      if (recordingTimeEl) recordingTimeEl.textContent = `${mins}:${secs}`;
    }, 1000);

  } catch (err) {
    console.warn("Microphone access denied or error:", err);
    showToastNotification("Microphone access permission required.");
  }
}

function stopVoiceRecording() {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  if (btnMic) btnMic.classList.remove('recording');
  if (recordingIndicator) recordingIndicator.classList.add('hidden');
  if (recordingTimeEl) recordingTimeEl.textContent = "0:00";

  try {
    mediaRecorder.stop();
  } catch(e){}
}

if (btnMic) {
  btnMic.addEventListener('mousedown', e => {
    e.preventDefault();
    startVoiceRecording();
  });
  window.addEventListener('mouseup', () => {
    if (isRecording) stopVoiceRecording();
  });

  btnMic.addEventListener('touchstart', e => {
    e.preventDefault();
    startVoiceRecording();
  });
  window.addEventListener('touchend', () => {
    if (isRecording) stopVoiceRecording();
  });
}

function handleIncomingVoice(data) {
  try {
    const blob = new Blob([data.data], { type: data.fileType || 'audio/webm' });
    const blobUrl = URL.createObjectURL(blob);
    renderVoiceMessage({
      isSelf: false,
      blobUrl,
      author: data.senderNickname,
      avatarColor: data.senderAvatarColor,
      timestampStr: data.timestampStr
    });
    playNotificationSound();
    showToastNotification(`Received voice note from ${data.senderNickname} 🎤`);
  } catch (err) {
    console.error("[PeerJS] Error processing incoming voice:", err);
  }
}

function renderVoiceMessage(voiceData) {
  const isSelf = voiceData.isSelf;
  const wrap = document.createElement('div');
  wrap.className = `message-wrapper ${isSelf ? 'sent' : 'received'}`;
  
  const initial = voiceData.author ? voiceData.author.charAt(0).toUpperCase() : 'V';

  const downloadOverlayHtml = `
    <a href="${voiceData.blobUrl}" download="${escapeHtml(voiceData.fileName || 'voice-note.webm')}" class="btn-download-overlay" title="Download Voice Note">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      <span>Download</span>
    </a>
  `;

  wrap.innerHTML = `
    <div class="msg-avatar" style="background-color: ${voiceData.avatarColor || '#8a78f7'};">
      ${initial}
    </div>
    <div class="msg-content">
      <div class="msg-header">
        <span class="msg-author">${escapeHtml(voiceData.author)}</span>
        <span class="msg-time">${voiceData.timestampStr}</span>
        <div class="msg-header-actions">
          <button type="button" class="btn-msg-reply" title="Reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a1 1 0 0 1-1.71.71l-6-6a1 1 0 0 1 0-1.42l6-6a1 1 0 0 1 1.71.71v4h4c5 0 9 4 9 9 0 2.82-1.35 5.3-3.46 6.94-.37.28-.92.05-.92-.41 0-.9-1-5.53-8.62-5.53h-1z"></path></svg>
          </button>
        </div>
      </div>
      <div class="msg-bubble p2p-media-bubble">
        <div class="msg-media-box">
          <div class="media-player-wrap">
            <audio controls src="${voiceData.blobUrl}" class="p2p-audio"></audio>
            ${downloadOverlayHtml}
          </div>
        </div>
      </div>
    </div>
  `;
  
  const replyBtn = wrap.querySelector('.btn-msg-reply');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => {
      currentReplyData = { author: voiceData.author || 'User', text: '[Voice Message 🎤]' };
      if (replyPreviewAuthor) replyPreviewAuthor.textContent = escapeHtml(voiceData.author || 'User');
      if (replyPreviewText) replyPreviewText.textContent = '[Voice Message 🎤]';
      if (replyPreviewBox) replyPreviewBox.classList.remove('hidden');
      if (chatInput) chatInput.focus();
    });
  }

  chatMessages.appendChild(wrap);
  scrollToBottom();

  startMediaBurnTimer(wrap, 120, voiceData.blobUrl);
}

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

window.handlePwaPrompt = function(e) {
  deferredPrompt = e;
  if (window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('vibe_pwa_dismissed')) {
    return;
  }
  if (installModalText) installModalText.textContent = "Install this app to your home screen for the best full-screen stealth experience.";
  if (installBtnWrap) installBtnWrap.classList.remove('hidden');
  if (installModal) installModal.classList.remove('hidden');
};

if (window._pwaPromptEvent) {
  window.handlePwaPrompt(window._pwaPromptEvent);
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.handlePwaPrompt(e);
});

function checkPwaInstallPrompt() {
  if (window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('vibe_pwa_dismissed')) {
    return;
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIos) {
    if (installModalText) installModalText.innerHTML = "To install VibeSpace for full-screen stealth mode, tap the Share icon in Safari and select <b>'Add to Home Screen'</b>.";
    if (installBtnWrap) installBtnWrap.classList.add('hidden');
    setTimeout(() => {
      if (installModal) installModal.classList.remove('hidden');
    }, 2000);
  }
}

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
    if (installModal) installModal.classList.add('hidden');
  });
}

if (btnPwaDismiss) {
  btnPwaDismiss.addEventListener('click', () => {
    localStorage.setItem('vibe_pwa_dismissed', 'true');
    if (installModal) installModal.classList.add('hidden');
  });
}

checkPwaInstallPrompt();

function initDetailedClock() {
  const ticksContainer = document.getElementById('clock-ticks');
  const numbersContainer = document.getElementById('clock-numbers');
  if (!ticksContainer || !numbersContainer) return;
  
  ticksContainer.innerHTML = '';
  numbersContainer.innerHTML = '';

  const numberRadius = 110; // Distance from center for the hour numbers

  for (let i = 0; i < 60; i++) {
    const angle = i * 6; // 360 / 60
    const tick = document.createElement('div');
    tick.className = 'clock-tick ' + (i % 5 === 0 ? 'clock-tick-major' : 'clock-tick-minor');
    tick.style.transform = `rotate(${angle}deg)`;
    ticksContainer.appendChild(tick);
  }

  for (let h = 1; h <= 12; h++) {
    const angle = h * 30; // 360 / 12
    const rad = (angle - 90) * (Math.PI / 180);
    const x = Math.round(Math.cos(rad) * numberRadius);
    const y = Math.round(Math.sin(rad) * numberRadius);

    const num = document.createElement('div');
    num.className = 'clock-number';
    num.textContent = h.toString();
    num.style.transform = `translate(${x}px, ${y}px)`;
    numbersContainer.appendChild(num);
  }
}

initDetailedClock();
showDisguiseScreen();

// --- ANALOG CLOCK INTERACTION LOGIC ---
let isClockDragging = false;
let hasStartedClockInteraction = false;
let clockInactivityTimer = null;
let draggedHand = null; // 'hour' or 'minute'
let currentDraggedHour = 12;
let currentDraggedMinute = 0;

function resetClockInactivityTimer() {
  if (clockInactivityTimer) clearTimeout(clockInactivityTimer);
  clockInactivityTimer = setTimeout(() => {
    if (!isClockDragging) {
      hasStartedClockInteraction = false;
      updateClockDisplay();
    }
  }, 10000); // Resume real time after 10 seconds of inactivity
}

function updateClockDisplay() {
  if (isClockDragging || hasStartedClockInteraction || state.isSecretChatOpen || state.isRoomSelectOpen) return;
  const now = new Date();
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;

  const secondAngle = s * 6;
  const minuteAngle = m * 6 + s * 0.1;
  const hourAngle = h * 30 + m * 0.5;

  if (clockHandSecond) clockHandSecond.style.transform = `rotate(${secondAngle}deg)`;
  if (clockHandMinute) clockHandMinute.style.transform = `rotate(${minuteAngle}deg)`;
  if (clockHandHour) clockHandHour.style.transform = `rotate(${hourAngle}deg)`;

  const digitalTime = `${String(now.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (clockDigitalDisplay) clockDigitalDisplay.textContent = digitalTime;
}
setInterval(updateClockDisplay, 1000);
updateClockDisplay();

if (analogClock) {
  analogClock.addEventListener('pointerdown', e => {
    if (state.isSecretChatOpen || state.isRoomSelectOpen) return;
    isClockDragging = true;
    if (!hasStartedClockInteraction) {
      const now = new Date();
      let h = now.getHours() % 12;
      if (h === 0) h = 12;
      currentDraggedHour = h;
      currentDraggedMinute = now.getMinutes();
      hasStartedClockInteraction = true;
      
      // Immediately snap hands to independent clean integer angles to remove real-time fractional drift
      if (clockHandHour) clockHandHour.style.transform = `rotate(${(currentDraggedHour % 12) * 30}deg)`;
      if (clockHandMinute) clockHandMinute.style.transform = `rotate(${currentDraggedMinute * 6}deg)`;
    }
    resetClockInactivityTimer();
    try { analogClock.setPointerCapture(e.pointerId); } catch(err){}

    const rect = analogClock.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientY - cy, e.clientX - cx);

    if (dist < 60) {
      draggedHand = 'hour';
    } else {
      draggedHand = 'minute';
    }
    handleClockDrag(e);
  });

  analogClock.addEventListener('pointermove', e => {
    if (!isClockDragging) return;
    resetClockInactivityTimer();
    handleClockDrag(e);
  });

  function handleClockDrag(e) {
    const rect = analogClock.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(e.clientY - cy, e.clientX - cx);
    let deg = (rad * 180 / Math.PI + 90 + 360) % 360;

    if (draggedHand === 'minute') {
      currentDraggedMinute = Math.round(deg / 6) % 60;
      const angle = currentDraggedMinute * 6;
      if (clockHandMinute) clockHandMinute.style.transform = `rotate(${angle}deg)`;
    } else if (draggedHand === 'hour') {
      let h = Math.round(deg / 30) % 12;
      if (h === 0) h = 12;
      currentDraggedHour = h;
      const angle = (currentDraggedHour % 12) * 30;
      if (clockHandHour) clockHandHour.style.transform = `rotate(${angle}deg)`;
    }

    const formattedTime = `${String(currentDraggedHour).padStart(2, '0')}:${String(currentDraggedMinute).padStart(2, '0')}`;
    if (clockDigitalDisplay) clockDigitalDisplay.textContent = formattedTime;
  }

  function finishClockDrag(e) {
    if (!isClockDragging) return;
    isClockDragging = false;
    try { analogClock.releasePointerCapture(e.pointerId); } catch(err){}
    resetClockInactivityTimer();

    const secretTime = localStorage.getItem('vibe_secret_time') || '12:15';
    const parts = secretTime.split(':');
    let secretH = parseInt(parts[0], 10) % 12;
    if (secretH === 0) secretH = 12;
    const secretM = parseInt(parts[1], 10);
    const targetSecret = `${String(secretH).padStart(2, '0')}:${String(secretM).padStart(2, '0')}`;

    const formattedTime = `${String(currentDraggedHour).padStart(2, '0')}:${String(currentDraggedMinute).padStart(2, '0')}`;

    if (formattedTime === targetSecret) {
      if (clockInactivityTimer) clearTimeout(clockInactivityTimer);
      hasStartedClockInteraction = false;
      state.isDecoyMode = false;
      openRoomSelection();
    }
  }

  analogClock.addEventListener('pointerup', finishClockDrag);
  analogClock.addEventListener('pointercancel', finishClockDrag);
}

// ==========================================
// 6. BIOMETRIC WEBAUTHN UNLOCK & STEALTH TRIGGER
// ==========================================
async function registerBiometric() {
  if (!window.PublicKeyCredential) {
    showToastNotification("Biometric authentication is not supported on this browser/device.");
    return false;
  }
  
  const randomChallenge = new Uint8Array(32);
  window.crypto.getRandomValues(randomChallenge);
  
  const randomUserId = new Uint8Array(16);
  window.crypto.getRandomValues(randomUserId);

  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge,
        rp: {
          name: "VibeSpace PWA",
          id: window.location.hostname || "localhost"
        },
        user: {
          id: randomUserId,
          name: "vibespace-user",
          displayName: "VibeSpace User"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },  // ES256
          { type: "public-key", alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000
      }
    });

    if (cred) {
      const rawId = Array.from(new Uint8Array(cred.rawId));
      localStorage.setItem('vibe_webauthn_id', JSON.stringify(rawId));
      localStorage.setItem('vibe_biometric_enabled', 'true');
      showToastNotification("Biometric unlock successfully registered! 🔒✨");
      return true;
    }
  } catch (err) {
    console.error("[WebAuthn] Registration error:", err);
    showToastNotification("Biometric setup cancelled or failed.");
    return false;
  }
}

async function unlockWithBiometric() {
  if (!window.PublicKeyCredential) return false;
  const isEnabled = localStorage.getItem('vibe_biometric_enabled') === 'true';
  if (!isEnabled) return false;

  const storedIdRaw = localStorage.getItem('vibe_webauthn_id');
  if (!storedIdRaw) return false;

  let credIdArray;
  try {
    credIdArray = new Uint8Array(JSON.parse(storedIdRaw));
  } catch(e) { return false; }

  const randomChallenge = new Uint8Array(32);
  window.crypto.getRandomValues(randomChallenge);

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge,
        allowCredentials: [{
          type: "public-key",
          id: credIdArray
        }],
        userVerification: "required",
        timeout: 60000
      }
    });

    if (assertion) {
      showToastNotification("Biometric verification successful! 🚀");
      state.isDecoyMode = false;
      openRoomSelection();
      return true;
    }
  } catch (err) {
    console.error("[WebAuthn] Authentication error:", err);
    showToastNotification("Biometric unlock failed.");
    return false;
  }
}

// 2-Second Long-Press Stealth Trigger on Disguise Screen Headers
const triggerElements = document.querySelectorAll('.stealth-header-trigger');
let longPressTimer = null;

triggerElements.forEach(elem => {
  elem.addEventListener('pointerdown', e => {
    if (state.isSecretChatOpen || state.isRoomSelectOpen) return;
    
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(async () => {
      longPressTimer = null;
      if (localStorage.getItem('vibe_biometric_enabled') === 'true') {
        try { if (navigator.vibrate) navigator.vibrate([50, 50]); } catch(e){}
        await unlockWithBiometric();
      } else {
        showToastNotification("Biometric unlock is disabled in Settings.");
      }
    }, 2000);
  });

  const cancelLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  elem.addEventListener('pointerup', cancelLongPress);
  elem.addEventListener('pointerleave', cancelLongPress);
  elem.addEventListener('pointercancel', cancelLongPress);
});
