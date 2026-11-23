/**
 * LDS Interpret Talk — 双方向リアルタイム通訳会話コントローラー
 *
 * 【主な機能】
 * 1. ルーム会話モード（ホスト＋ゲスト複数人・MQTT over WSS・QR招待・APIキーはホストのみ保持）
 * 2. 1端末対面モード（2つの言語マイクボタン＋相手側180°反転表示）
 * 3. 日常会話 / 丁寧・ビジネス / 教会・交わり のトーン切替 ＋ 教会用語集 ON/OFF
 * 4. 字幕メイン設計 ＋ 必要な時だけの音声出力（吹き出し個別🔊再生 / 自動読上トグル / 再生中マイク自動ミュート）
 * 5. URLハッシュ鍵 (#key=...) による AES-GCM 簡易E2E暗号化
 */

import { ChurchInterpreterService, SUPPORTED_LANGUAGES } from './gemini-service.js';
import { DEFAULT_PROTESTANT_GLOSSARY } from './glossary-presets.js';

const SHARED_STORAGE_KEYS = {
  SETTINGS: 'grace_interpret_settings_v2',
  GLOSSARY: 'grace_interpret_glossary_v1',
};

const TALK_STORAGE_KEY = 'lds_talk_settings_v1';
const MQTT_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

const UI_LOCALES = {
  ja: {
    title: '💬 双方向通訳',
    myLang: '自分',
    tapSpeak: 'タップして話す',
    listening: '話し中…（タップで停止）',
    textPlaceholder: 'テキストで入力して送信...',
    autoSpeakOff: '自動読上 OFF',
    autoSpeakOn: '自動読上 ON',
    emptyTitle: '双方向リアルタイム通訳',
    emptyDescHost:
      'マイクボタンを押して話すか、下の入力欄から送信すると自動で通訳されます。「📱 招待」からQRコードを共有すると、海外の相手もブラウザだけで参加できます。',
    emptyDescGuest:
      '下のマイクボタンを押して自分の言語で話すか、テキストを送信すると自動で通訳されます。',
    connectedHost: 'オンライン',
    connectedGuest: 'ホスト接続中',
    connecting: '接続中…',
    waitingHost: 'ホスト待機中…',
    offline: 'オフライン',
    faceModeBadge: '1端末対面モード',
    translating: '翻訳中…',
    speakBtn: '再生',
    speakingBtn: '再生中…',
    settingsTitle: '⚙️ 会話設定',
    displayName: 'あなたの表示名',
    ttsEngine: '音声読み上げエンジン（🔊ボタン / 自動読上時）',
    theme: '表示テーマ',
    historyActions: '会話ログ',
    copiedUrl: '招待URLをコピーしました',
    copiedLog: '会話ログをコピーしました',
    clearedLog: '会話履歴をクリアしました',
    savedApiKey: 'APIキーを保存しました',
    micUnsupported: 'このブラウザは音声認識に対応していません。下のテキスト入力をご利用ください。',
  },
  en: {
    title: '💬 Live Interpret',
    myLang: 'My Language',
    tapSpeak: 'Tap to Speak',
    listening: 'Listening… (Tap to stop)',
    textPlaceholder: 'Type a message to translate...',
    autoSpeakOff: 'Auto Voice OFF',
    autoSpeakOn: 'Auto Voice ON',
    emptyTitle: 'Two-Way Live Translation',
    emptyDescHost: 'Tap the microphone or type below to start a translated conversation.',
    emptyDescGuest:
      'Tap the microphone below to speak in your language, or type a message. It will be translated in real time.',
    connectedHost: 'Online',
    connectedGuest: 'Connected',
    connecting: 'Connecting…',
    waitingHost: 'Waiting for host…',
    offline: 'Offline',
    faceModeBadge: 'Face-to-Face Mode',
    translating: 'Translating…',
    speakBtn: 'Listen',
    speakingBtn: 'Playing…',
    settingsTitle: '⚙️ Settings',
    displayName: 'Your Name',
    ttsEngine: 'Voice Engine (🔊 button / Auto Voice)',
    theme: 'Theme',
    historyActions: 'Conversation Log',
    copiedUrl: 'Invite link copied!',
    copiedLog: 'Conversation log copied!',
    clearedLog: 'Conversation cleared',
    savedApiKey: 'API key saved',
    micUnsupported: 'Speech recognition is not supported in this browser. Please use text input below.',
  },
  tl: {
    title: '💬 Live Interpret',
    myLang: 'Wika Ko',
    tapSpeak: 'Pindutin para Magsalita',
    listening: 'Nakikinig… (Pindutin para ihinto)',
    textPlaceholder: 'Mag-type ng mensahe para isalin...',
    autoSpeakOff: 'Auto Voice OFF',
    autoSpeakOn: 'Auto Voice ON',
    emptyTitle: 'Dalawang-Daan na Salin',
    emptyDescHost: 'Pindutin ang mikropono o mag-type sa ibaba.',
    emptyDescGuest:
      'Pindutin ang mikropono sa ibaba para magsalita sa iyong wika, o mag-type ng mensahe.',
    connectedHost: 'Online',
    connectedGuest: 'Konektado',
    connecting: 'Kumokonekta…',
    waitingHost: 'Naghihintay sa host…',
    offline: 'Offline',
    faceModeBadge: 'Face-to-Face',
    translating: 'Isinasalin…',
    speakBtn: 'Pakinggan',
    speakingBtn: 'Nagpe-play…',
    settingsTitle: '⚙️ Mga Setting',
    displayName: 'Iyong Pangalan',
    ttsEngine: 'Voice Engine',
    theme: 'Tema',
    historyActions: 'Log ng Usapan',
    copiedUrl: 'Nakopya na ang link!',
    copiedLog: 'Nakopya na ang usapan!',
    clearedLog: 'Nabura na ang kasaysayan',
    savedApiKey: 'Nai-save ang API key',
    micUnsupported: 'Hindi sinusuportahan ang voice input sa browser na ito. Gamitin ang text input.',
  },
  id: {
    title: '💬 Live Interpret',
    myLang: 'Bahasa Saya',
    tapSpeak: 'Ketuk untuk Bicara',
    listening: 'Mendengarkan… (Ketuk untuk berhenti)',
    textPlaceholder: 'Ketik pesan untuk diterjemahkan...',
    autoSpeakOff: 'Suara Otomatis OFF',
    autoSpeakOn: 'Suara Otomatis ON',
    emptyTitle: 'Penerjemah Dua Arah',
    emptyDescHost: 'Ketuk mikrofon atau ketik di bawah untuk memulai.',
    emptyDescGuest:
      'Ketuk mikrofon di bawah untuk berbicara dalam bahasa Anda, atau ketik pesan.',
    connectedHost: 'Online',
    connectedGuest: 'Terhubung',
    connecting: 'Menghubungkan…',
    waitingHost: 'Menunggu host…',
    offline: 'Offline',
    faceModeBadge: 'Mode Tatap Muka',
    translating: 'Menerjemahkan…',
    speakBtn: 'Dengar',
    speakingBtn: 'Memutar…',
    settingsTitle: '⚙️ Pengaturan',
    displayName: 'Nama Anda',
    ttsEngine: 'Mesin Suara',
    theme: 'Tema',
    historyActions: 'Riwayat Percakapan',
    copiedUrl: 'Tautan undangan disalin!',
    copiedLog: 'Riwayat disalin!',
    clearedLog: 'Riwayat dihapus',
    savedApiKey: 'API key disimpan',
    micUnsupported: 'Pengenalan suara tidak didukung di browser ini. Silakan gunakan input teks.',
  },
};

/* ============================================================================
 * 簡易 E2E 暗号化ヘルパー (Web Crypto API / AES-GCM 128-bit)
 * 共有URLの #key=<base64url> を使うためサーバー・ブローカーには鍵が送られない
 * ========================================================================== */
function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

class E2EECrypto {
  constructor() {
    this.key = null;
    this.keyB64 = '';
  }

  get enabled() {
    return Boolean(this.key);
  }

  static isSupported() {
    return Boolean(window.crypto && window.crypto.subtle);
  }

  async generateNewKey() {
    if (!E2EECrypto.isSupported()) {
      this.key = null;
      this.keyB64 = '';
      return '';
    }
    const raw = window.crypto.getRandomValues(new Uint8Array(16));
    this.keyB64 = bytesToBase64Url(raw);
    this.key = await window.crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    return this.keyB64;
  }

  async importKey(keyB64) {
    if (!E2EECrypto.isSupported() || !keyB64) {
      this.key = null;
      this.keyB64 = '';
      return false;
    }
    try {
      const raw = base64UrlToBytes(keyB64);
      if (raw.length !== 16 && raw.length !== 32) return false;
      this.key = await window.crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      this.keyB64 = keyB64;
      return true;
    } catch {
      this.key = null;
      this.keyB64 = '';
      return false;
    }
  }

  async encryptJson(obj) {
    const plain = JSON.stringify(obj);
    if (!this.key) return plain;
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plain);
    const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, encoded);
    return JSON.stringify({
      _e2ee: 1,
      iv: bytesToBase64Url(iv),
      ct: bytesToBase64Url(new Uint8Array(cipherBuf)),
    });
  }

  async decryptJson(rawStr) {
    const parsed = JSON.parse(rawStr);
    if (!parsed || parsed._e2ee !== 1) return parsed;
    if (!this.key) return null;
    const iv = base64UrlToBytes(parsed.iv);
    const ct = base64UrlToBytes(parsed.ct);
    const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.key, ct);
    return JSON.parse(new TextDecoder().decode(plainBuf));
  }
}

/* ============================================================================
 * メインコントローラー
 * ========================================================================== */
class BidirectionalTalkApp {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));

    // URLに ?room=xxx があればゲスト参加、なければホスト起動
    this.isGuest = Boolean(this.params.get('room')) && this.params.get('role') !== 'host';
    this.clientId = `${this.isGuest ? 'guest' : 'host'}-${Math.random().toString(36).slice(2, 9)}`;

    this.crypto = new E2EECrypto();
    this.interpreter = new ChurchInterpreterService();
    this.sharedSettings = this.loadSharedSettings();
    this.glossary = this.loadSharedGlossary();
    this.talkSettings = this.loadTalkSettings();

    // ゲスト初期言語の決定
    if (this.isGuest) {
      const urlLang = this.params.get('lang');
      if (urlLang && SUPPORTED_LANGUAGES[urlLang]) {
        this.talkSettings.myLang = urlLang;
      } else if (!this.talkSettings.guestLangSet) {
        const navLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
        this.talkSettings.myLang = SUPPORTED_LANGUAGES[navLang] ? navLang : 'en';
      }
      if (!this.talkSettings.displayName || this.talkSettings.displayName === 'Host') {
        this.talkSettings.displayName = 'Guest';
      }
    }

    // 状態管理
    this.talkMode = 'room'; // 'room' | 'face' (ホストのみ切替可)
    this.splitFlip = false;
    this.autoSpeak = false; // 要件通りデフォルトOFF
    this.messages = []; // { id, senderId, senderName, sourceLang, sourceText, translations, ts, pending, sideRole? }
    this.participants = new Map(); // clientId -> { name, lang, lastSeen }

    // 音声認識
    this.recognition = null;
    this.isListening = false;
    this.listeningSide = 'self'; // 'self' | 'partner'
    this.pausedMicForSpeech = false;
    this.resumeMicSide = null;

    // 音声再生
    this.isSpeaking = false;
    this.audioPlayer = new Audio();
    this.audioPlayer.playsInline = true;
    this.currentAudioUrl = null;
    this.pendingTtsRequests = new Map(); // reqId -> resolve

    // MQTT
    this.mqttClient = null;
    this.roomId = this.isGuest ? this.params.get('room') : this.talkSettings.roomId;
    this.hostOnline = !this.isGuest;
    this.presenceTimer = null;
    this.pruneTimer = null;
    this.pingTimer = null;

    this.initElements();
    this.applyInitialState();
    this.bindEvents();
    this.boot();
  }

  initElements() {
    this.el = {
      headerTitle: document.getElementById('headerTitle'),
      connStatusBadge: document.getElementById('connStatusBadge'),
      connStatusText: document.getElementById('connStatusText'),
      e2eeBadge: document.getElementById('e2eeBadge'),

      modeRoomBtn: document.getElementById('modeRoomBtn'),
      modeFaceBtn: document.getElementById('modeFaceBtn'),
      openInviteBtn: document.getElementById('openInviteBtn'),
      peerCountBadge: document.getElementById('peerCountBadge'),
      autoSpeakToggleBtn: document.getElementById('autoSpeakToggleBtn'),
      autoSpeakIcon: document.getElementById('autoSpeakIcon'),
      autoSpeakLabel: document.getElementById('autoSpeakLabel'),
      openSettingsBtn: document.getElementById('openSettingsBtn'),

      myLangLabel: document.getElementById('myLangLabel'),
      myLangSelect: document.getElementById('myLangSelect'),
      partnerLangSelect: document.getElementById('partnerLangSelect'),
      toneSelect: document.getElementById('toneSelect'),
      useGlossaryCheck: document.getElementById('useGlossaryCheck'),
      flipSplitBtn: document.getElementById('flipSplitBtn'),
      apiModePill: document.getElementById('apiModePill'),

      facePartnerStage: document.getElementById('facePartnerStage'),
      facePartnerMeta: document.getElementById('facePartnerMeta'),
      facePartnerMain: document.getElementById('facePartnerMain'),
      facePartnerSub: document.getElementById('facePartnerSub'),

      talkMain: document.getElementById('talkMain'),
      emptyState: document.getElementById('emptyState'),
      emptyTitle: document.getElementById('emptyTitle'),
      emptyDesc: document.getElementById('emptyDesc'),
      messagesList: document.getElementById('messagesList'),
      interimBubble: document.getElementById('interimBubble'),
      interimSpeakerBadge: document.getElementById('interimSpeakerBadge'),
      interimText: document.getElementById('interimText'),

      roomControls: document.getElementById('roomControls'),
      roomMicBtn: document.getElementById('roomMicBtn'),
      roomMicLabel: document.getElementById('roomMicLabel'),
      roomTextForm: document.getElementById('roomTextForm'),
      roomTextInput: document.getElementById('roomTextInput'),

      faceControls: document.getElementById('faceControls'),
      faceMicSelfBtn: document.getElementById('faceMicSelfBtn'),
      faceMicSelfLabel: document.getElementById('faceMicSelfLabel'),
      faceMicPartnerBtn: document.getElementById('faceMicPartnerBtn'),
      faceMicPartnerLabel: document.getElementById('faceMicPartnerLabel'),
      faceTextForm: document.getElementById('faceTextForm'),
      faceTextSenderSelect: document.getElementById('faceTextSenderSelect'),
      faceTextInput: document.getElementById('faceTextInput'),

      inviteDialog: document.getElementById('inviteDialog'),
      inviteQrBox: document.getElementById('inviteQrBox'),
      inviteDefaultLangSelect: document.getElementById('inviteDefaultLangSelect'),
      inviteRoomIdCode: document.getElementById('inviteRoomIdCode'),
      regenRoomBtn: document.getElementById('regenRoomBtn'),
      inviteUrlInput: document.getElementById('inviteUrlInput'),
      copyInviteUrlBtn: document.getElementById('copyInviteUrlBtn'),
      dialogPeerCount: document.getElementById('dialogPeerCount'),
      participantsList: document.getElementById('participantsList'),

      settingsDialog: document.getElementById('settingsDialog'),
      settingsDialogTitle: document.getElementById('settingsDialogTitle'),
      displayNameLabel: document.getElementById('displayNameLabel'),
      displayNameInput: document.getElementById('displayNameInput'),
      ttsEngineLabel: document.getElementById('ttsEngineLabel'),
      ttsEngineSelect: document.getElementById('ttsEngineSelect'),
      themeLabel: document.getElementById('themeLabel'),
      themeLightBtn: document.getElementById('themeLightBtn'),
      themeDarkBtn: document.getElementById('themeDarkBtn'),
      talkApiKeyInput: document.getElementById('talkApiKeyInput'),
      saveTalkApiKeyBtn: document.getElementById('saveTalkApiKeyBtn'),
      historyActionsLabel: document.getElementById('historyActionsLabel'),
      copyLogBtn: document.getElementById('copyLogBtn'),
      exportLogBtn: document.getElementById('exportLogBtn'),
      clearLogBtn: document.getElementById('clearLogBtn'),

      toast: document.getElementById('toast'),
    };
  }

  loadSharedSettings() {
    try {
      const saved = localStorage.getItem(SHARED_STORAGE_KEYS.SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      apiKey: '',
      model: 'gemini-3.5-flash-lite',
      ttsModel: 'gemini-3.8-flash-lite-tts',
      ttsVoice: 'Kore',
    };
  }

  saveSharedSettings() {
    try {
      localStorage.setItem(SHARED_STORAGE_KEYS.SETTINGS, JSON.stringify(this.sharedSettings));
    } catch {}
  }

  loadSharedGlossary() {
    try {
      const saved = localStorage.getItem(SHARED_STORAGE_KEYS.GLOSSARY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return structuredClone(DEFAULT_PROTESTANT_GLOSSARY);
  }

  loadTalkSettings() {
    const defaults = {
      myLang: 'ja',
      partnerLang: 'en',
      tone: 'casual',
      useGlossary: false,
      displayName: this.isGuest ? 'Guest' : 'Host',
      ttsEngine: 'browser',
      theme: 'light',
      roomId: 'talk-' + Math.random().toString(36).slice(2, 10),
      roomKey: '',
      guestLangSet: false,
    };
    try {
      const saved = localStorage.getItem(TALK_STORAGE_KEY);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  }

  saveTalkSettings() {
    try {
      localStorage.setItem(TALK_STORAGE_KEY, JSON.stringify(this.talkSettings));
    } catch {}
  }

  t(key) {
    const lang = this.talkSettings.myLang || 'ja';
    const dict = UI_LOCALES[lang] || UI_LOCALES.en;
    return dict[key] || UI_LOCALES.en[key] || key;
  }

  applyInitialState() {
    document.body.dataset.role = this.isGuest ? 'guest' : 'host';
    document.body.dataset.talkMode = this.talkMode;
    document.body.dataset.theme = this.talkSettings.theme || 'light';

    this.el.myLangSelect.value = this.talkSettings.myLang;
    this.el.partnerLangSelect.value = this.talkSettings.partnerLang;
    this.el.toneSelect.value = this.talkSettings.tone;
    this.el.useGlossaryCheck.checked = Boolean(this.talkSettings.useGlossary);
    this.el.displayNameInput.value = this.talkSettings.displayName || '';
    this.el.ttsEngineSelect.value = this.talkSettings.ttsEngine || 'browser';
    if (this.el.talkApiKeyInput) {
      this.el.talkApiKeyInput.value = this.sharedSettings.apiKey || '';
    }

    if (!this.isGuest) {
      this.configureInterpreter();
    }

    this.applyLocaleUI();
    this.updateFaceModeButtons();
  }

  configureInterpreter() {
    this.interpreter.configure({
      apiKey: this.sharedSettings.apiKey || '',
      model: this.sharedSettings.model || 'gemini-3.5-flash-lite',
      sourceLang: this.talkSettings.myLang,
      targetLang: this.talkSettings.partnerLang,
    });
    const hasKey = this.interpreter.hasApiKey();
    if (this.el.apiModePill) {
      this.el.apiModePill.textContent = hasKey ? '✨ Gemini' : 'Demo';
      this.el.apiModePill.classList.toggle('is-live', hasKey);
      this.el.apiModePill.title = hasKey
        ? `Gemini API 有効 (${this.sharedSettings.model || 'gemini-3.5-flash-lite'})`
        : 'APIキー未設定（デモモード）— 右上の⚙️から設定できます';
    }
  }

  applyLocaleUI() {
    this.el.headerTitle.textContent = this.t('title');
    this.el.myLangLabel.textContent = this.t('myLang');
    this.el.roomTextInput.placeholder = this.t('textPlaceholder');
    this.el.emptyTitle.textContent = this.t('emptyTitle');
    this.el.emptyDesc.textContent = this.isGuest ? this.t('emptyDescGuest') : this.t('emptyDescHost');
    this.el.settingsDialogTitle.textContent = this.t('settingsTitle');
    this.el.displayNameLabel.textContent = this.t('displayName');
    this.el.ttsEngineLabel.textContent = this.t('ttsEngine');
    this.el.themeLabel.textContent = this.t('theme');
    this.el.historyActionsLabel.textContent = this.t('historyActions');

    this.updateAutoSpeakUI();
    this.updateMicButtonUI();
  }

  async boot() {
    // E2E暗号鍵の準備
    if (this.isGuest) {
      const hashKey = this.hashParams.get('key') || '';
      if (hashKey) {
        await this.crypto.importKey(hashKey);
      }
    } else {
      if (this.talkSettings.roomKey) {
        const ok = await this.crypto.importKey(this.talkSettings.roomKey);
        if (!ok) {
          this.talkSettings.roomKey = await this.crypto.generateNewKey();
          this.saveTalkSettings();
        }
      } else {
        this.talkSettings.roomKey = await this.crypto.generateNewKey();
        this.saveTalkSettings();
      }
    }

    if (this.el.e2eeBadge) {
      this.el.e2eeBadge.hidden = !this.crypto.enabled;
    }

    this.connectMqtt();
  }

  /* ==========================================================================
   * イベントバインド
   * ======================================================================== */
  bindEvents() {
    // モード切替（ホスト）
    this.el.modeRoomBtn?.addEventListener('click', () => this.setTalkMode('room'));
    this.el.modeFaceBtn?.addEventListener('click', () => this.setTalkMode('face'));

    // 1端末対面：相手側180°反転
    this.el.flipSplitBtn?.addEventListener('click', () => {
      this.splitFlip = !this.splitFlip;
      document.body.dataset.splitFlip = String(this.splitFlip);
      this.el.flipSplitBtn.setAttribute('aria-pressed', String(this.splitFlip));
      this.el.facePartnerStage.hidden = !this.splitFlip || this.talkMode !== 'face';
      this.updateFacePartnerStage();
    });

    // 言語選択
    this.el.myLangSelect.addEventListener('change', () => {
      this.talkSettings.myLang = this.el.myLangSelect.value;
      if (this.isGuest) this.talkSettings.guestLangSet = true;
      this.saveTalkSettings();
      this.applyLocaleUI();
      this.updateFaceModeButtons();
      this.renderAllMessages();
      if (this.isGuest) {
        this.sendGuestCtrl('lang_update');
      } else {
        this.configureInterpreter();
      }
    });

    this.el.partnerLangSelect?.addEventListener('change', () => {
      this.talkSettings.partnerLang = this.el.partnerLangSelect.value;
      this.saveTalkSettings();
      this.updateFaceModeButtons();
      this.renderAllMessages();
      this.configureInterpreter();
      if (this.el.inviteDefaultLangSelect) {
        this.el.inviteDefaultLangSelect.value = this.talkSettings.partnerLang;
      }
    });

    // トーン＆用語集
    this.el.toneSelect?.addEventListener('change', () => {
      const tone = this.el.toneSelect.value;
      this.talkSettings.tone = tone;
      // 教会モードを選んだら自動で用語集ON、日常会話ならOFF（後から手動切替も可）
      this.talkSettings.useGlossary = tone === 'church';
      this.el.useGlossaryCheck.checked = this.talkSettings.useGlossary;
      this.saveTalkSettings();
    });

    this.el.useGlossaryCheck?.addEventListener('change', () => {
      this.talkSettings.useGlossary = this.el.useGlossaryCheck.checked;
      this.saveTalkSettings();
    });

    // 自動読み上げトグル
    this.el.autoSpeakToggleBtn.addEventListener('click', () => {
      this.autoSpeak = !this.autoSpeak;
      if (this.autoSpeak) {
        this.unlockAudioPlayback();
      } else {
        this.stopSpeaking();
      }
      this.updateAutoSpeakUI();
    });

    // ルームモードのマイク＆テキスト
    this.el.roomMicBtn.addEventListener('click', () => {
      if (this.isListening) {
        this.stopSpeechRecognition();
      } else {
        this.startSpeechRecognition('self');
      }
    });

    this.el.roomTextForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.el.roomTextInput.value.trim();
      if (!text) return;
      this.el.roomTextInput.value = '';
      this.handleUserInput(text, 'self');
    });

    // 1端末対面モードのマイク＆テキスト
    this.el.faceMicSelfBtn?.addEventListener('click', () => {
      if (this.isListening && this.listeningSide === 'self') {
        this.stopSpeechRecognition();
      } else {
        this.startSpeechRecognition('self');
      }
    });

    this.el.faceMicPartnerBtn?.addEventListener('click', () => {
      if (this.isListening && this.listeningSide === 'partner') {
        this.stopSpeechRecognition();
      } else {
        this.startSpeechRecognition('partner');
      }
    });

    this.el.faceTextForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.el.faceTextInput.value.trim();
      if (!text) return;
      this.el.faceTextInput.value = '';
      const side = this.el.faceTextSenderSelect.value === 'partner' ? 'partner' : 'self';
      this.handleUserInput(text, side);
    });

    // 招待ダイアログ
    this.el.openInviteBtn?.addEventListener('click', () => this.openInviteDialog());
    this.el.inviteDefaultLangSelect?.addEventListener('change', () => this.refreshInviteQrAndUrl());
    this.el.copyInviteUrlBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.el.inviteUrlInput.value);
        this.showToast(this.t('copiedUrl'));
      } catch {
        this.el.inviteUrlInput.select();
        document.execCommand('copy');
        this.showToast(this.t('copiedUrl'));
      }
    });
    this.el.regenRoomBtn?.addEventListener('click', async () => {
      this.roomId = 'talk-' + Math.random().toString(36).slice(2, 10);
      this.talkSettings.roomId = this.roomId;
      this.talkSettings.roomKey = await this.crypto.generateNewKey();
      this.saveTalkSettings();
      this.participants.clear();
      this.updateParticipantsUI();
      this.connectMqtt();
      this.refreshInviteQrAndUrl();
      this.showToast('新しいルームを発行しました');
    });

    // 設定ダイアログ
    this.el.openSettingsBtn.addEventListener('click', () => {
      this.el.displayNameInput.value = this.talkSettings.displayName || '';
      this.el.ttsEngineSelect.value = this.talkSettings.ttsEngine || 'browser';
      if (this.el.talkApiKeyInput) {
        this.el.talkApiKeyInput.value = this.sharedSettings.apiKey || '';
      }
      this.el.settingsDialog.showModal();
    });

    this.el.displayNameInput.addEventListener('change', () => {
      this.talkSettings.displayName = this.el.displayNameInput.value.trim() || (this.isGuest ? 'Guest' : 'Host');
      this.saveTalkSettings();
      if (this.isGuest) this.sendGuestCtrl('lang_update');
    });

    this.el.ttsEngineSelect.addEventListener('change', () => {
      this.talkSettings.ttsEngine = this.el.ttsEngineSelect.value;
      this.saveTalkSettings();
    });

    this.el.themeLightBtn.addEventListener('click', () => this.setTheme('light'));
    this.el.themeDarkBtn.addEventListener('click', () => this.setTheme('dark'));

    this.el.saveTalkApiKeyBtn?.addEventListener('click', () => {
      this.sharedSettings.apiKey = this.el.talkApiKeyInput.value.trim();
      this.saveSharedSettings();
      this.configureInterpreter();
      this.showToast(this.t('savedApiKey'));
    });

    this.el.copyLogBtn.addEventListener('click', () => this.copyConversationLog());
    this.el.exportLogBtn.addEventListener('click', () => this.exportConversationLog());
    this.el.clearLogBtn.addEventListener('click', () => this.clearConversation());

    // ダイアログ閉じるボタン＆背景クリック
    document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-dialog');
        document.getElementById(id)?.close();
      });
    });
    [this.el.inviteDialog, this.el.settingsDialog].forEach((dlg) => {
      dlg?.addEventListener('click', (e) => {
        if (e.target === dlg) dlg.close();
      });
    });

    window.addEventListener('beforeunload', () => {
      this.stopSpeechRecognition();
      this.stopSpeaking();
      if (this.mqttClient?.connected) {
        if (this.isGuest) {
          this.sendGuestCtrl('bye');
        } else {
          this.publishHostPresence(false);
        }
        try {
          this.mqttClient.end(true);
        } catch {}
      }
    });
  }

  setTalkMode(mode) {
    if (this.isGuest) return;
    this.stopSpeechRecognition();
    this.talkMode = mode === 'face' ? 'face' : 'room';
    document.body.dataset.talkMode = this.talkMode;

    const isFace = this.talkMode === 'face';
    this.el.modeRoomBtn.classList.toggle('is-active', !isFace);
    this.el.modeRoomBtn.setAttribute('aria-selected', String(!isFace));
    this.el.modeFaceBtn.classList.toggle('is-active', isFace);
    this.el.modeFaceBtn.setAttribute('aria-selected', String(isFace));

    this.el.roomControls.hidden = isFace;
    this.el.faceControls.hidden = !isFace;
    this.el.facePartnerStage.hidden = !isFace || !this.splitFlip;

    if (isFace) {
      this.setConnectionBadge('connected', this.t('faceModeBadge'));
      this.updateFacePartnerStage();
    } else if (this.mqttClient?.connected) {
      this.setConnectionBadge('connected', this.t('connectedHost'));
    } else {
      this.setConnectionBadge('connecting', this.t('connecting'));
    }
    this.renderAllMessages();
  }

  setTheme(theme) {
    this.talkSettings.theme = theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.theme = this.talkSettings.theme;
    this.saveTalkSettings();
  }

  setConnectionBadge(state, text) {
    this.el.connStatusBadge.className = `status-pill status-${state}`;
    this.el.connStatusText.textContent = text;
  }

  updateAutoSpeakUI() {
    this.el.autoSpeakToggleBtn.setAttribute('aria-pressed', String(this.autoSpeak));
    this.el.autoSpeakIcon.textContent = this.autoSpeak ? '🔊' : '🔇';
    this.el.autoSpeakLabel.textContent = this.autoSpeak ? this.t('autoSpeakOn') : this.t('autoSpeakOff');
  }

  updateFaceModeButtons() {
    const myInfo = SUPPORTED_LANGUAGES[this.talkSettings.myLang] || SUPPORTED_LANGUAGES.ja;
    const partnerInfo = SUPPORTED_LANGUAGES[this.talkSettings.partnerLang] || SUPPORTED_LANGUAGES.en;

    const speakPrompts = {
      ja: '日本語で話す',
      en: 'Speak English',
      tl: 'Magsalita (Tagalog)',
      id: 'Bicara (Indonesia)',
    };

    if (this.el.faceMicSelfLabel) {
      this.el.faceMicSelfLabel.textContent = `${myInfo.flag} ${speakPrompts[myInfo.code] || myInfo.nameEn}`;
    }
    if (this.el.faceMicPartnerLabel) {
      this.el.faceMicPartnerLabel.textContent = `${partnerInfo.flag} ${speakPrompts[partnerInfo.code] || partnerInfo.nameEn}`;
    }
    if (this.el.faceTextSenderSelect) {
      this.el.faceTextSenderSelect.options[0].textContent = `自分 (${myInfo.flag})`;
      this.el.faceTextSenderSelect.options[1].textContent = `相手 (${partnerInfo.flag})`;
    }
    this.updateFacePartnerStage();
  }

  /* ==========================================================================
   * MQTT 双方向通信
   * ======================================================================== */
  getTopics() {
    const prefix = `lds-talk/room/${this.roomId}`;
    return {
      presence: `${prefix}/presence`,
      ctrl: `${prefix}/ctrl`,
      utterance: `${prefix}/utterance`,
      stream: `${prefix}/stream`,
    };
  }

  connectMqtt() {
    if (typeof mqtt === 'undefined') {
      this.setConnectionBadge('offline', this.t('offline'));
      return;
    }

    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch {}
      this.mqttClient = null;
    }
    clearInterval(this.presenceTimer);
    clearInterval(this.pruneTimer);
    clearInterval(this.pingTimer);

    const topics = this.getTopics();
    this.setConnectionBadge('connecting', this.t('connecting'));

    const options = {
      clientId: `lds-talk-${this.clientId}`,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
      keepalive: 25,
      timerVariant: 'native',
    };

    if (!this.isGuest) {
      options.will = {
        topic: topics.presence,
        payload: JSON.stringify({ online: false, ts: Date.now() }),
        qos: 1,
        retain: true,
      };
    }

    this.mqttClient = mqtt.connect(MQTT_BROKER_URL, options);

    this.mqttClient.on('connect', () => {
      if (!this.isGuest) {
        if (this.talkMode === 'room') {
          this.setConnectionBadge('connected', this.t('connectedHost'));
        }
        this.mqttClient.subscribe([topics.ctrl, topics.utterance], { qos: 0 });
        this.publishHostPresence(true);

        this.presenceTimer = setInterval(() => this.publishHostPresence(true), 20000);
        this.pruneTimer = setInterval(() => this.pruneInactiveParticipants(), 15000);
      } else {
        this.mqttClient.subscribe([topics.presence, topics.stream], { qos: 0 });
        this.sendGuestCtrl('hello');
        this.pingTimer = setInterval(() => this.sendGuestCtrl('ping'), 18000);
      }
    });

    this.mqttClient.on('message', async (topic, payloadBuf) => {
      const raw = payloadBuf.toString();
      if (topic === topics.presence) {
        try {
          const p = JSON.parse(raw);
          if (this.isGuest) {
            this.hostOnline = Boolean(p?.online);
            this.setConnectionBadge(
              this.hostOnline ? 'connected' : 'connecting',
              this.hostOnline ? this.t('connectedGuest') : this.t('waitingHost')
            );
          }
        } catch {}
        return;
      }

      let data = null;
      try {
        data = await this.crypto.decryptJson(raw);
      } catch (err) {
        console.warn('Decrypt/parse error:', err);
        return;
      }
      if (!data) return;

      if (!this.isGuest) {
        if (topic === topics.ctrl) this.handleHostCtrlMessage(data);
        if (topic === topics.utterance) this.handleHostIncomingUtterance(data);
      } else if (topic === topics.stream) {
        this.handleGuestStreamMessage(data);
      }
    });

    this.mqttClient.on('reconnect', () => {
      if (this.talkMode === 'room') {
        this.setConnectionBadge('connecting', this.t('connecting'));
      }
    });

    this.mqttClient.on('error', () => {
      if (this.talkMode === 'room') {
        this.setConnectionBadge('offline', this.t('offline'));
      }
    });
  }

  publishHostPresence(online) {
    if (!this.mqttClient?.connected || this.isGuest) return;
    const topics = this.getTopics();
    try {
      this.mqttClient.publish(
        topics.presence,
        JSON.stringify({ online, ts: Date.now() }),
        { retain: true, qos: 1 }
      );
    } catch {}
  }

  async publishEncrypted(topic, obj) {
    if (!this.mqttClient?.connected) return;
    try {
      const payload = await this.crypto.encryptJson(obj);
      this.mqttClient.publish(topic, payload, { qos: 0 });
    } catch (err) {
      console.warn('MQTT publish error:', err);
    }
  }

  sendGuestCtrl(type, extra = {}) {
    if (!this.isGuest || !this.mqttClient?.connected) return;
    const topics = this.getTopics();
    this.publishEncrypted(topics.ctrl, {
      type,
      clientId: this.clientId,
      name: this.talkSettings.displayName || 'Guest',
      lang: this.talkSettings.myLang,
      ts: Date.now(),
      ...extra,
    });
  }

  handleHostCtrlMessage(data) {
    if (!data?.clientId) return;
    const now = Date.now();

    if (data.type === 'hello' || data.type === 'ping' || data.type === 'lang_update') {
      this.participants.set(data.clientId, {
        name: data.name || 'Guest',
        lang: SUPPORTED_LANGUAGES[data.lang] ? data.lang : 'en',
        lastSeen: now,
      });
      this.updateParticipantsUI();

      if (data.type === 'hello') {
        const topics = this.getTopics();
        this.publishEncrypted(topics.stream, {
          type: 'history',
          targetClient: data.clientId,
          messages: this.messages.slice(-50),
        });
      }
    } else if (data.type === 'bye') {
      this.participants.delete(data.clientId);
      this.updateParticipantsUI();
    } else if (data.type === 'tts_request') {
      // ゲストがGemini AI音声の個別再生を要求した場合、ホストが生成して返す
      this.handleHostTtsRequest(data);
    }
  }

  pruneInactiveParticipants() {
    const now = Date.now();
    let changed = false;
    for (const [cid, info] of this.participants.entries()) {
      if (now - info.lastSeen > 50000) {
        this.participants.delete(cid);
        changed = true;
      }
    }
    if (changed) this.updateParticipantsUI();
  }

  updateParticipantsUI() {
    const count = this.participants.size;
    if (this.el.peerCountBadge) this.el.peerCountBadge.textContent = String(count);
    if (this.el.dialogPeerCount) this.el.dialogPeerCount.textContent = String(count);
    if (!this.el.participantsList) return;

    if (count === 0) {
      this.el.participantsList.innerHTML = '<li class="participant-empty">まだ他の参加者はいません</li>';
      return;
    }

    this.el.participantsList.innerHTML = '';
    for (const [, info] of this.participants.entries()) {
      const langInfo = SUPPORTED_LANGUAGES[info.lang] || SUPPORTED_LANGUAGES.en;
      const li = document.createElement('li');
      li.innerHTML = `<span>${this.escapeHtml(info.name)}</span><span>${langInfo.flag} ${langInfo.nameEn}</span>`;
      this.el.participantsList.appendChild(li);
    }
  }

  /* ==========================================================================
   * 発話ハンドリング & ホスト集約翻訳
   * ======================================================================== */
  async handleUserInput(text, side = 'self') {
    const cleanText = (text || '').trim();
    if (!cleanText) return;

    if (this.isGuest) {
      const msgId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const msg = {
        id: msgId,
        senderId: this.clientId,
        senderName: this.talkSettings.displayName || 'Guest',
        sourceLang: this.talkSettings.myLang,
        sourceText: cleanText,
        translations: {},
        ts: Date.now(),
        pending: true,
      };
      this.upsertMessage(msg);
      const topics = this.getTopics();
      await this.publishEncrypted(topics.utterance, {
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderName,
        lang: msg.sourceLang,
        text: msg.sourceText,
        ts: msg.ts,
      });
      return;
    }

    // ホスト自身の発話（ルームモード または 1端末対面モード）
    const isPartnerSide = this.talkMode === 'face' && side === 'partner';
    const sourceLang = isPartnerSide ? this.talkSettings.partnerLang : this.talkSettings.myLang;
    const senderName = isPartnerSide
      ? (SUPPORTED_LANGUAGES[sourceLang]?.nameEn || 'Partner')
      : (this.talkSettings.displayName || 'Host');

    await this.processHostTurn({
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: isPartnerSide ? 'face-partner' : this.clientId,
      senderName,
      sourceLang,
      sourceText: cleanText,
      ts: Date.now(),
      sideRole: isPartnerSide ? 'partner' : 'self',
    });
  }

  async handleHostIncomingUtterance(data) {
    if (!data?.text || !data?.senderId) return;
    if (this.messages.some((m) => m.id === data.id)) return;

    this.participants.set(data.senderId, {
      name: data.senderName || 'Guest',
      lang: SUPPORTED_LANGUAGES[data.lang] ? data.lang : 'en',
      lastSeen: Date.now(),
    });
    this.updateParticipantsUI();

    await this.processHostTurn({
      id: data.id || `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: data.senderId,
      senderName: data.senderName || 'Guest',
      sourceLang: SUPPORTED_LANGUAGES[data.lang] ? data.lang : 'en',
      sourceText: data.text,
      ts: data.ts || Date.now(),
      sideRole: 'partner',
    });
  }

  getTargetLangsForTurn(sourceLang) {
    if (this.talkMode === 'face') {
      const target = sourceLang === this.talkSettings.myLang
        ? this.talkSettings.partnerLang
        : this.talkSettings.myLang;
      return target && target !== sourceLang ? [target] : [];
    }

    // ルームモード：ホスト言語 + デフォルト相手言語 + 接続中全ゲストの言語
    const set = new Set([this.talkSettings.myLang, this.talkSettings.partnerLang]);
    for (const [, info] of this.participants.entries()) {
      if (info.lang) set.add(info.lang);
    }
    set.delete(sourceLang);
    return [...set];
  }

  async processHostTurn(turn) {
    const msg = {
      id: turn.id,
      senderId: turn.senderId,
      senderName: turn.senderName,
      sourceLang: turn.sourceLang,
      sourceText: turn.sourceText,
      translations: {},
      ts: turn.ts,
      pending: true,
      sideRole: turn.sideRole,
    };

    this.upsertMessage(msg);
    const topics = this.getTopics();
    if (this.talkMode === 'room') {
      this.publishEncrypted(topics.stream, { type: 'msg_start', message: msg });
    }

    const targetLangs = this.getTargetLangsForTurn(msg.sourceLang);
    if (targetLangs.length === 0) {
      msg.pending = false;
      this.upsertMessage(msg);
      if (this.talkMode === 'room') {
        this.publishEncrypted(topics.stream, { type: 'msg_final', message: msg });
      }
      return;
    }

    let lastBroadcastAt = 0;
    const historySnapshot = this.messages.filter((m) => m.id !== msg.id && !m.pending).slice(-4);

    const res = await this.interpreter.translateConversationTurn({
      sourceText: msg.sourceText,
      sourceLang: msg.sourceLang,
      targetLangs,
      speakerName: msg.senderName,
      tone: this.talkSettings.tone || 'casual',
      useGlossary: Boolean(this.talkSettings.useGlossary),
      glossaryList: this.glossary,
      conversationHistory: historySnapshot,
      onLangDelta: (lang, delta) => {
        msg.translations[lang] = (msg.translations[lang] || '') + delta;
        this.updateMessageDom(msg);
        this.updateFacePartnerStage();

        const now = Date.now();
        if (this.talkMode === 'room' && now - lastBroadcastAt > 120) {
          lastBroadcastAt = now;
          this.publishEncrypted(topics.stream, {
            type: 'msg_delta',
            id: msg.id,
            translations: msg.translations,
          });
        }
      },
    });

    msg.translations = { ...msg.translations, ...res.translations };
    msg.pending = false;
    this.upsertMessage(msg);
    this.updateFacePartnerStage();

    if (this.talkMode === 'room') {
      this.publishEncrypted(topics.stream, { type: 'msg_final', message: msg });
    }

    // 自動読み上げがONの場合、相手の言語へ訳されたテキスト（または相手からの翻訳）を再生
    if (this.autoSpeak) {
      if (this.talkMode === 'face') {
        const outLang = msg.sideRole === 'self' ? this.talkSettings.partnerLang : this.talkSettings.myLang;
        const outText = msg.translations[outLang];
        if (outText) this.speakText(outText, outLang);
      } else if (msg.senderId !== this.clientId) {
        const myLang = this.talkSettings.myLang;
        const outText = msg.translations[myLang] || msg.sourceText;
        if (outText) this.speakText(outText, myLang);
      }
    }
  }

  handleGuestStreamMessage(data) {
    if (!data?.type) return;
    if (data.targetClient && data.targetClient !== this.clientId) return;

    if (data.type === 'history' && Array.isArray(data.messages)) {
      this.messages = data.messages;
      this.renderAllMessages();
    } else if (data.type === 'msg_start' && data.message) {
      this.upsertMessage(data.message);
    } else if (data.type === 'msg_delta' && data.id) {
      const target = this.messages.find((m) => m.id === data.id);
      if (target) {
        target.translations = { ...target.translations, ...(data.translations || {}) };
        this.updateMessageDom(target);
      }
    } else if (data.type === 'msg_final' && data.message) {
      this.upsertMessage({ ...data.message, pending: false });
      if (this.autoSpeak && data.message.senderId !== this.clientId) {
        const myLang = this.talkSettings.myLang;
        const outText = data.message.translations?.[myLang] || data.message.sourceText;
        if (outText) this.speakText(outText, myLang);
      }
    } else if (data.type === 'tts_audio' && data.reqId) {
      const resolver = this.pendingTtsRequests.get(data.reqId);
      if (resolver) {
        this.pendingTtsRequests.delete(data.reqId);
        resolver(data.audio || null);
      }
    } else if (data.type === 'clear') {
      this.messages = [];
      this.renderAllMessages();
    }
  }

  /* ==========================================================================
   * チャットタイムライン描画
   * ======================================================================== */
  upsertMessage(msg) {
    const idx = this.messages.findIndex((m) => m.id === msg.id);
    if (idx >= 0) {
      this.messages[idx] = { ...this.messages[idx], ...msg };
    } else {
      this.messages.push(msg);
      if (this.messages.length > 200) this.messages.shift();
    }
    this.el.emptyState.hidden = this.messages.length > 0;
    this.updateMessageDom(this.messages[idx >= 0 ? idx : this.messages.length - 1]);
    this.updateFacePartnerStage();
    this.scrollToBottom();
  }

  renderAllMessages() {
    this.el.messagesList.innerHTML = '';
    this.el.emptyState.hidden = this.messages.length > 0;
    for (const msg of this.messages) {
      this.updateMessageDom(msg);
    }
    this.updateFacePartnerStage();
    this.scrollToBottom();
  }

  getDisplayTextsForMessage(msg) {
    const myLang = this.talkSettings.myLang;
    const isSelf = msg.senderId === this.clientId;
    const srcInfo = SUPPORTED_LANGUAGES[msg.sourceLang] || SUPPORTED_LANGUAGES.en;

    if (isSelf) {
      // 自分の発言：上段に自分の原文、下段に相手言語への訳文（確認用）
      const partnerLang = this.isGuest
        ? Object.keys(msg.translations || {})[0]
        : this.talkSettings.partnerLang;
      const translated = partnerLang ? msg.translations?.[partnerLang] : '';
      const tgtInfo = partnerLang ? SUPPORTED_LANGUAGES[partnerLang] : null;
      return {
        isSelf: true,
        primaryText: msg.sourceText,
        secondaryText: translated || (msg.pending ? this.t('translating') : ''),
        secondaryLang: partnerLang || msg.sourceLang,
        speakText: translated || msg.sourceText,
        speakLang: translated && partnerLang ? partnerLang : msg.sourceLang,
        langTag: tgtInfo ? `${srcInfo.flag} → ${tgtInfo.flag}` : srcInfo.flag,
      };
    }

    // 相手の発言：上段に自分の言語への訳文、下段に相手の原文
    const translatedToMe = msg.sourceLang === myLang
      ? msg.sourceText
      : msg.translations?.[myLang] || '';
    const myInfo = SUPPORTED_LANGUAGES[myLang] || SUPPORTED_LANGUAGES.ja;

    return {
      isSelf: false,
      primaryText: translatedToMe || (msg.pending ? this.t('translating') : msg.sourceText),
      secondaryText: msg.sourceLang === myLang ? '' : msg.sourceText,
      secondaryLang: msg.sourceLang,
      speakText: translatedToMe || msg.sourceText,
      speakLang: translatedToMe ? myLang : msg.sourceLang,
      langTag: msg.sourceLang === myLang ? srcInfo.flag : `${srcInfo.flag} → ${myInfo.flag}`,
    };
  }

  updateMessageDom(msg) {
    let row = document.getElementById(`msg-${msg.id}`);
    const view = this.getDisplayTextsForMessage(msg);

    if (!row) {
      row = document.createElement('article');
      row.id = `msg-${msg.id}`;
      row.className = `msg-row ${view.isSelf ? 'is-self' : 'is-other'}`;
      row.innerHTML = `
        <div class="msg-meta">
          <span class="msg-speaker"></span>
          <span class="msg-lang-tag"></span>
          <span class="msg-time"></span>
        </div>
        <div class="msg-bubble">
          <div class="msg-primary"></div>
          <div class="msg-secondary"></div>
        </div>
        <div class="msg-actions">
          <button type="button" class="btn-bubble-action btn-speak-msg">🔊 <span class="speak-label"></span></button>
        </div>
      `;
      row.querySelector('.btn-speak-msg').addEventListener('click', (e) => {
        const currentMsg = this.messages.find((m) => m.id === msg.id);
        if (!currentMsg) return;
        const currentView = this.getDisplayTextsForMessage(currentMsg);
        this.speakText(currentView.speakText, currentView.speakLang, e.currentTarget);
      });
      this.el.messagesList.appendChild(row);
    }

    row.className = `msg-row ${view.isSelf ? 'is-self' : 'is-other'}`;
    row.querySelector('.msg-speaker').textContent = msg.senderName || 'Speaker';
    row.querySelector('.msg-lang-tag').textContent = view.langTag;
    row.querySelector('.msg-time').textContent = new Date(msg.ts || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const primaryEl = row.querySelector('.msg-primary');
    primaryEl.textContent = view.primaryText;
    primaryEl.classList.toggle('msg-translating', Boolean(msg.pending && !view.isSelf && !msg.translations?.[this.talkSettings.myLang]));

    const secondaryEl = row.querySelector('.msg-secondary');
    if (view.secondaryText) {
      secondaryEl.hidden = false;
      secondaryEl.textContent = view.secondaryText;
      secondaryEl.classList.toggle('msg-translating', Boolean(msg.pending && view.isSelf && !msg.translations?.[view.secondaryLang]));
    } else {
      secondaryEl.hidden = true;
    }

    const speakLabel = row.querySelector('.speak-label');
    if (speakLabel) speakLabel.textContent = this.t('speakBtn');
  }

  updateFacePartnerStage() {
    if (this.talkMode !== 'face' || !this.splitFlip) return;
    const partnerLang = this.talkSettings.partnerLang;
    const partnerInfo = SUPPORTED_LANGUAGES[partnerLang] || SUPPORTED_LANGUAGES.en;
    this.el.facePartnerMeta.textContent = `${partnerInfo.flag} ${partnerInfo.nameEn}`;

    const latest = this.messages[this.messages.length - 1];
    if (!latest) {
      this.el.facePartnerMain.textContent = 'Ready…';
      this.el.facePartnerSub.textContent = '';
      return;
    }

    const partnerText =
      latest.sourceLang === partnerLang
        ? latest.sourceText
        : latest.translations?.[partnerLang] || this.t('translating');
    const subText = latest.sourceLang === partnerLang ? '' : latest.sourceText;

    this.el.facePartnerMain.textContent = partnerText;
    this.el.facePartnerSub.textContent = subText;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.el.talkMain.scrollTop = this.el.talkMain.scrollHeight;
    });
  }

  /* ==========================================================================
   * 音声認識 (Web Speech API) ＋ 読み上げ中のハウリング防止
   * ======================================================================== */
  startSpeechRecognition(side = 'self') {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.showToast(this.t('micUnsupported'));
      return;
    }

    this.stopSpeechRecognition();
    this.stopSpeaking();

    const langCode =
      this.talkMode === 'face' && side === 'partner'
        ? this.talkSettings.partnerLang
        : this.talkSettings.myLang;
    const langInfo = SUPPORTED_LANGUAGES[langCode] || SUPPORTED_LANGUAGES.ja;

    const rec = new SpeechRec();
    rec.lang = langInfo.speechLang;
    rec.continuous = true;
    rec.interimResults = true;

    this.recognition = rec;
    this.isListening = true;
    this.listeningSide = side;
    this.updateMicButtonUI();

    rec.onresult = (event) => {
      if (this.isSpeaking) return; // ハウリング防止
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim.trim()) {
        this.el.interimBubble.hidden = false;
        this.el.interimSpeakerBadge.textContent = `🎤 ${langInfo.flag}`;
        this.el.interimText.textContent = interim.trim();
        this.scrollToBottom();
      } else {
        this.el.interimBubble.hidden = true;
      }

      if (finalChunk.trim()) {
        this.el.interimBubble.hidden = true;
        this.handleUserInput(finalChunk.trim(), side);
      }
    };

    rec.onerror = (err) => {
      if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
        this.showToast('マイクの使用が許可されていません');
        this.stopSpeechRecognition();
      }
    };

    rec.onend = () => {
      // 意図的に停止していない場合（モバイルSafari等の自動終了）は状態を整える
      if (this.isListening && !this.pausedMicForSpeech) {
        this.isListening = false;
        this.el.interimBubble.hidden = true;
        this.updateMicButtonUI();
      }
    };

    try {
      rec.start();
    } catch {
      this.stopSpeechRecognition();
    }
  }

  stopSpeechRecognition() {
    this.isListening = false;
    this.pausedMicForSpeech = false;
    this.resumeMicSide = null;
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    this.el.interimBubble.hidden = true;
    this.updateMicButtonUI();
  }

  pauseMicDuringSpeech() {
    if (!this.isListening) return;
    this.pausedMicForSpeech = true;
    this.resumeMicSide = this.listeningSide;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  resumeMicAfterSpeech() {
    if (!this.pausedMicForSpeech) return;
    const side = this.resumeMicSide || 'self';
    this.pausedMicForSpeech = false;
    this.resumeMicSide = null;
    if (this.isListening) {
      this.startSpeechRecognition(side);
    }
  }

  updateMicButtonUI() {
    const activeRoom = this.isListening && this.talkMode === 'room';
    this.el.roomMicBtn.classList.toggle('is-listening', activeRoom);
    this.el.roomMicBtn.setAttribute('aria-pressed', String(activeRoom));
    this.el.roomMicLabel.textContent = activeRoom ? this.t('listening') : this.t('tapSpeak');

    const activeSelf = this.isListening && this.talkMode === 'face' && this.listeningSide === 'self';
    const activePartner = this.isListening && this.talkMode === 'face' && this.listeningSide === 'partner';
    this.el.faceMicSelfBtn?.classList.toggle('is-listening', activeSelf);
    this.el.faceMicSelfBtn?.setAttribute('aria-pressed', String(activeSelf));
    this.el.faceMicPartnerBtn?.classList.toggle('is-listening', activePartner);
    this.el.faceMicPartnerBtn?.setAttribute('aria-pressed', String(activePartner));
  }

  /* ==========================================================================
   * 音声出力（オンデマンド🔊ボタン / 自動読上ON時のみ）
   * ======================================================================== */
  unlockAudioPlayback() {
    try {
      this.audioPlayer.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      const p = this.audioPlayer.play();
      if (p?.then) {
        p.then(() => {
          this.audioPlayer.pause();
          this.audioPlayer.currentTime = 0;
        }).catch(() => {});
      }
    } catch {}
  }

  stopSpeaking() {
    this.isSpeaking = false;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    try {
      this.audioPlayer.pause();
      this.audioPlayer.removeAttribute('src');
    } catch {}
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }

  async speakText(text, langCode = 'en', triggerBtn = null) {
    const clean = (text || '').trim();
    if (!clean) return;

    this.stopSpeaking();
    this.isSpeaking = true;
    this.pauseMicDuringSpeech();

    const setBtnState = (playing) => {
      if (!triggerBtn) return;
      triggerBtn.classList.toggle('is-speaking', playing);
      const lbl = triggerBtn.querySelector('.speak-label');
      if (lbl) lbl.textContent = playing ? this.t('speakingBtn') : this.t('speakBtn');
    };
    setBtnState(true);

    const finish = () => {
      this.isSpeaking = false;
      setBtnState(false);
      this.resumeMicAfterSpeech();
    };

    // Gemini AI音声が選択されている場合
    if (this.talkSettings.ttsEngine === 'gemini') {
      try {
        let audio = null;
        if (!this.isGuest && this.interpreter.hasApiKey()) {
          audio = await this.interpreter.synthesizeSpeech(clean, {
            model: this.sharedSettings.ttsModel || 'gemini-3.8-flash-lite-tts',
            voice: this.sharedSettings.ttsVoice || 'Kore',
            style: 'natural, clear, friendly conversational tone',
          });
        } else if (this.isGuest && this.mqttClient?.connected) {
          audio = await this.requestGuestGeminiTts(clean, langCode);
        }

        if (audio?.data) {
          await this.playBase64Audio(audio.data, audio.mimeType || 'audio/wav');
          finish();
          return;
        }
      } catch (err) {
        console.warn('Gemini TTS fallback to browser speech:', err);
      }
    }

    // ブラウザ標準音声（高速・無料・オフライン可）
    if (!('speechSynthesis' in window)) {
      finish();
      return;
    }

    const langInfo = SUPPORTED_LANGUAGES[langCode] || SUPPORTED_LANGUAGES.en;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = langInfo.ttsLang || 'en-US';
    utter.rate = 1.0;
    utter.onend = finish;
    utter.onerror = finish;
    window.speechSynthesis.speak(utter);
  }

  async handleHostTtsRequest(data) {
    if (!data?.reqId || !data?.text || !this.interpreter.hasApiKey()) return;
    try {
      const audio = await this.interpreter.synthesizeSpeech(data.text, {
        model: this.sharedSettings.ttsModel || 'gemini-3.8-flash-lite-tts',
        voice: this.sharedSettings.ttsVoice || 'Kore',
        style: 'natural, clear, friendly conversational tone',
      });
      const topics = this.getTopics();
      await this.publishEncrypted(topics.stream, {
        type: 'tts_audio',
        targetClient: data.clientId,
        reqId: data.reqId,
        audio,
      });
    } catch (err) {
      console.warn('Host TTS request failed:', err);
    }
  }

  requestGuestGeminiTts(text, langCode) {
    return new Promise((resolve) => {
      const reqId = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const timer = setTimeout(() => {
        this.pendingTtsRequests.delete(reqId);
        resolve(null);
      }, 9000);

      this.pendingTtsRequests.set(reqId, (audio) => {
        clearTimeout(timer);
        resolve(audio);
      });

      this.sendGuestCtrl('tts_request', { reqId, text, lang: langCode });
    });
  }

  playBase64Audio(base64Data, mimeType) {
    return new Promise((resolve) => {
      const bin = atob(base64Data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      this.currentAudioUrl = URL.createObjectURL(blob);
      this.audioPlayer.src = this.currentAudioUrl;
      this.audioPlayer.onended = () => resolve();
      this.audioPlayer.onerror = () => resolve();
      const p = this.audioPlayer.play();
      if (p?.catch) p.catch(() => resolve());
    });
  }

  /* ==========================================================================
   * 招待QR / URL 生成
   * ======================================================================== */
  openInviteDialog() {
    if (this.el.inviteDefaultLangSelect) {
      this.el.inviteDefaultLangSelect.value = this.talkSettings.partnerLang || 'en';
    }
    this.refreshInviteQrAndUrl();
    this.updateParticipantsUI();
    this.el.inviteDialog.showModal();
  }

  refreshInviteQrAndUrl() {
    const guestLang = this.el.inviteDefaultLangSelect?.value || this.talkSettings.partnerLang || 'en';
    const baseUrl = window.location.origin + window.location.pathname;
    const hash = this.crypto.keyB64 ? `#key=${encodeURIComponent(this.crypto.keyB64)}` : '';
    const inviteUrl = `${baseUrl}?room=${encodeURIComponent(this.roomId)}&lang=${encodeURIComponent(guestLang)}${hash}`;

    this.el.inviteRoomIdCode.textContent = this.roomId;
    this.el.inviteUrlInput.value = inviteUrl;
    this.renderQRCodeInto(this.el.inviteQrBox, inviteUrl);
  }

  renderQRCodeInto(qrBox, url) {
    qrBox.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 140;
    qrBox.appendChild(canvas);

    let rendered = false;
    if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
      try {
        QRCode.toCanvas(canvas, url, { width: 140, margin: 1 }, (err) => {
          if (!err) rendered = true;
        });
      } catch {}
    }

    if (!rendered) {
      const img = document.createElement('img');
      img.width = 140;
      img.height = 140;
      img.alt = 'QR Code';
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent(url)}`;
      qrBox.innerHTML = '';
      qrBox.appendChild(img);
    }
  }

  /* ==========================================================================
   * ログ出力・ユーティリティ
   * ======================================================================== */
  formatConversationLog() {
    return this.messages
      .map((m) => {
        const time = new Date(m.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const transLines = Object.entries(m.translations || {})
          .map(([lang, txt]) => `  [${lang.toUpperCase()}] ${txt}`)
          .join('\n');
        return `[${time}] ${m.senderName} (${(m.sourceLang || '').toUpperCase()}): ${m.sourceText}${transLines ? '\n' + transLines : ''}`;
      })
      .join('\n\n');
  }

  async copyConversationLog() {
    const text = this.formatConversationLog();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(this.t('copiedLog'));
    } catch {}
  }

  exportConversationLog() {
    const text = this.formatConversationLog();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talk-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearConversation() {
    this.messages = [];
    this.renderAllMessages();
    if (!this.isGuest && this.talkMode === 'room') {
      const topics = this.getTopics();
      this.publishEncrypted(topics.stream, { type: 'clear' });
    }
    this.showToast(this.t('clearedLog'));
  }

  showToast(message) {
    if (!this.el.toast) return;
    this.el.toast.textContent = message;
    this.el.toast.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.el.toast.hidden = true;
    }, 2600);
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.talkApp = new BidirectionalTalkApp();
});
