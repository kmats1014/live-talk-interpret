/**
 * Gemini API 超高速・同時通訳サービス (@google/genai SDK + ブラウザ直接SSE最適化)
 *
 * 【高速化アーキテクチャ】
 * 1. 動的スマート用語集注入: 全辞書を毎回送るのではなく、今回の発話に含まれる教会用語のみをピンポイント注入し入力トークンを約85%削減
 * 2. 思考待機ゼロ化 (thinkingBudget: 0): Flash系モデルの内部思考(Thinking)による1.5〜3秒の初動遅延をカット
 * 3. Flash-Lite 最優先ルーティング + マルチモデル即時フェイルオーバー (503 high demand 回避)
 */

import { GoogleGenAI } from '@google/genai';
import { SAMPLE_SERMON_SEGMENTS } from './glossary-presets.js';

export const AVAILABLE_GEMINI_MODELS = [
  {
    id: 'gemini-3.5-flash-lite',
    label: '⚡ Gemini 3.5 Flash-Lite（最速・同時通訳に推奨）',
  },
  {
    id: 'gemini-3.8-flash',
    label: '✨ Gemini 3.8 Flash（高精度・標準）',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: '🚀 Gemini 3.1 Flash-Lite（超軽量・高速）',
  },
];

export const SUPPORTED_LANGUAGES = {
  ja: {
    code: 'ja',
    speechLang: 'ja-JP',
    ttsLang: 'ja-JP',
    flag: '🇯🇵',
    nameJa: '日本語',
    nameEn: 'Japanese',
    sourceBoxTitle: '音声認識 書き起こし（日本語）',
    targetBoxTitle: '同時通訳（日本語 / Japanese）',
    copySourceLabel: '📋 書き起こしコピー',
    copyTargetLabel: '📋 日本語通訳コピー',
    ttsLabel: '🔊 日本語読み上げ',
    listeningHint: '音声認識中（日本語でお話しください）',
    manualPlaceholder:
      'マイクを使わずに日本語を入力してEnterで即時通訳・追加することもできます（例：本日は聖餐式を行います）',
    sourcePlaceholder:
      'マイクをONにして話し始めるか、下のテキスト入力から送信すると、この枠の中に音声認識した内容が一連の文章としてリアルタイムに繋がって表示されます...',
    targetPlaceholder:
      '「同時通訳を開始」を押すと、この枠の中に同時通訳が一連の文章としてリアルタイムに表示されます...',
  },
  en: {
    code: 'en',
    speechLang: 'en-US',
    ttsLang: 'en-US',
    flag: '🇺🇸',
    nameJa: '英語',
    nameEn: 'English',
    sourceBoxTitle: '音声認識 書き起こし（英語 / English）',
    targetBoxTitle: '同時通訳（英語 / English Interpretation）',
    copySourceLabel: '📋 英語書き起こしコピー',
    copyTargetLabel: '📋 英語通訳コピー',
    ttsLabel: '🔊 英語読み上げ',
    listeningHint: '音声認識中（英語でお話しください / Speak in English）',
    manualPlaceholder:
      'マイクを使わずに英語を入力してEnterで即時通訳・追加することもできます (e.g., Beloved brothers and sisters, welcome to our service today.)',
    sourcePlaceholder:
      'マイクをONにして英語で話し始めるか、下の入力欄から送信すると、音声認識した英語が一連の文章としてリアルタイムに表示されます...',
    targetPlaceholder:
      'Press “同時通訳を開始” or type below. The English interpretation will flow continuously in this single box in real time...',
  },
  tl: {
    code: 'tl',
    speechLang: 'fil-PH',
    ttsLang: 'fil-PH',
    flag: '🇵🇭',
    nameJa: 'タガログ語',
    nameEn: 'Tagalog (Filipino)',
    sourceBoxTitle: '音声認識 書き起こし（タガログ語 / Tagalog）',
    targetBoxTitle: '同時通訳（タガログ語 / Tagalog Interpretation）',
    copySourceLabel: '📋 タガログ語書き起こしコピー',
    copyTargetLabel: '📋 タガログ語通訳コピー',
    ttsLabel: '🔊 タガログ語読み上げ',
    listeningHint: '音声認識中（タガログ語でお話しください / Magsalita sa Tagalog）',
    manualPlaceholder:
      'マイクを使わずにタガログ語を入力してEnterで即時通訳・追加できます (Halimbawa: Minamahal kong mga kapatid...)',
    sourcePlaceholder:
      'マイクをONにしてタガログ語で話し始めるか、下の入力欄から送信すると、音声認識したタガログ語がリアルタイムに表示されます...',
    targetPlaceholder:
      'Press “同時通訳を開始” or type below. Ang pagsasalin sa Tagalog ay lalabas nang tuluy-tuloy sa kahon na ito...',
  },
  id: {
    code: 'id',
    speechLang: 'id-ID',
    ttsLang: 'id-ID',
    flag: '🇮🇩',
    nameJa: 'インドネシア語',
    nameEn: 'Indonesian (Bahasa Indonesia)',
    sourceBoxTitle: '音声認識 書き起こし（インドネシア語 / Indonesian）',
    targetBoxTitle: '同時通訳（インドネシア語 / Indonesian Interpretation）',
    copySourceLabel: '📋 インドネシア語書き起こしコピー',
    copyTargetLabel: '📋 インドネシア語通訳コピー',
    ttsLabel: '🔊 インドネシア語読み上げ',
    listeningHint: '音声認識中（インドネシア語でお話しください / Berbicara dalam Bahasa Indonesia）',
    manualPlaceholder:
      'マイクを使わずにインドネシア語を入力してEnterで即時通訳・追加できます (Contoh: Saudara-saudari yang terkasih...)',
    sourcePlaceholder:
      'マイクをONにしてインドネシア語で話し始めるか、下の入力欄から送信すると、音声認識したインドネシア語がリアルタイムに表示されます...',
    targetPlaceholder:
      'Press “同時通訳を開始” or type below. Terjemahan Bahasa Indonesia akan ditampilkan secara langsung di kotak ini...',
  },
};

export const SCENE_MODES = {
  sermon: {
    id: 'sermon',
    label: '説教・メッセージ (Sermon)',
    instruction:
      'Style: Reverent, natural contemporary church sermon tone (faithful to LDS / Christian scripture and doctrine).',
  },
  prayer: {
    id: 'prayer',
    label: '祈祷・祝祷 (Prayer & Benediction)',
    instruction:
      'Style: Warm, reverent Christian/LDS prayer tone (e.g., "Heavenly Father" / "愛する天の御父" / "Ama sa Langit" / "Bapa Surgawi", closing in the name of Jesus Christ, Amen).',
  },
  worship: {
    id: 'worship',
    label: '礼拝司会・式次第 (Liturgy & Worship)',
    instruction:
      'Style: Reverent, dignified church service conducting and sacrament/worship liturgy.',
  },
  announcement: {
    id: 'announcement',
    label: '報告・交わり案内 (Announcements)',
    instruction:
      'Style: Warm, clear church announcement for members and visitors.',
  },
};

export const CONVERSATION_TONES = {
  casual: {
    id: 'casual',
    label: '日常会話（フレンドリー）',
    labelEn: 'Casual',
    instruction:
      'Style: Natural, warm, everyday spoken conversation. Keep it concise, idiomatic, and friendly—like talking with a friend or acquaintance.',
    jaStyle: '自然な日常会話の日本語（親しみやすく、堅苦しすぎない話し言葉）で出力すること。',
  },
  polite: {
    id: 'polite',
    label: '丁寧・ビジネス',
    labelEn: 'Polite / Business',
    instruction:
      'Style: Polite, clear, respectful spoken conversation suitable for work, travel assistance, or formal discussions.',
    jaStyle: '丁寧で分かりやすい敬語（です・ます調）の自然な日本語で出力すること。',
  },
  church: {
    id: 'church',
    label: '教会・交わり',
    labelEn: 'Church / Fellowship',
    instruction:
      'Style: Warm, reverent, and welcoming conversation for church fellowship, pastoral care, or gospel discussions.',
    jaStyle: '温かく丁寧な敬体（です・ます調）で、教会・信仰生活にふさわしい自然な日本語で出力すること。',
  },
};

export class ChurchInterpreterService {
  constructor() {
    this.apiKey = '';
    this.model = 'gemini-3.5-flash-lite';
    this.resolvedModel = '';
    this.cachedAvailableModels = null;
    this.overloadedModels = new Map();
    this.noThinkingSupportModels = new Set(); // thinkingConfig非対応モデルの記録
    this.sceneMode = 'sermon';
    this.sourceLang = 'ja';
    this.targetLang = 'en';
    this.churchName = '';
    this.feedbackRules = []; // ユーザーのフィードバックから学習した通訳改善ルール
    this.correctionExamples = []; // ユーザーが通訳結果を修正したお手本ペア { ja, beforeEn, afterEn }
    this.client = null;
    this.recentContext = [];
    this.liveSession = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
  }

  configure({
    apiKey,
    model,
    sceneMode,
    sourceLang,
    targetLang,
    churchName,
    feedbackRules,
    correctionExamples,
  }) {
    if (typeof apiKey === 'string') {
      const trimmed = apiKey.trim();
      if (trimmed !== this.apiKey) {
        this.apiKey = trimmed;
        this.resolvedModel = '';
        this.cachedAvailableModels = null;
        this.overloadedModels.clear();
        this.client = trimmed ? new GoogleGenAI({ apiKey: trimmed }) : null;
      }
    }
    if (model && model !== this.model) {
      this.model = model;
      this.resolvedModel = '';
    }
    if (sceneMode) this.sceneMode = sceneMode;
    if (sourceLang && SUPPORTED_LANGUAGES[sourceLang]) this.sourceLang = sourceLang;
    if (targetLang && SUPPORTED_LANGUAGES[targetLang]) this.targetLang = targetLang;
    if (typeof churchName === 'string') this.churchName = churchName.trim();
    if (Array.isArray(feedbackRules)) this.feedbackRules = feedbackRules;
    if (Array.isArray(correctionExamples)) this.correctionExamples = correctionExamples;
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.client);
  }

  getActiveModelName() {
    return this.resolvedModel || this.model;
  }

  clearContext() {
    this.recentContext = [];
  }

  getSourceLangInfo() {
    return SUPPORTED_LANGUAGES[this.sourceLang] || SUPPORTED_LANGUAGES.ja;
  }

  getTargetLangInfo() {
    return SUPPORTED_LANGUAGES[this.targetLang] || SUPPORTED_LANGUAGES.en;
  }

  /**
   * 高速レスポンス向けに最適化した軽量システムプロンプトを構築
   * - 発話に登場した教会用語（matchedTerms）を最優先で注入し、トークン数を最小化
   * - 入力言語 (sourceLang) ➔ 出力言語 (targetLang) に応じて指示と用語集マッピングを自動切替
   */
  buildFastSystemInstruction(
    matchedTerms = [],
    fullGlossaryList = [],
    includeFullGlossary = false,
    currentSourceText = ''
  ) {
    const sceneConfig = SCENE_MODES[this.sceneMode] || SCENE_MODES.sermon;
    const srcInfo = this.getSourceLangInfo();
    const tgtInfo = this.getTargetLangInfo();

    const churchRole = this.churchName
      ? `Simultaneous interpreter for ${this.churchName} (${srcInfo.nameEn} to ${tgtInfo.nameEn}).`
      : `Simultaneous interpreter for an LDS / Christian church service (${srcInfo.nameEn} to ${tgtInfo.nameEn}).`;

    const termsToInclude = includeFullGlossary
      ? fullGlossaryList.filter((item) => item.enabled)
      : matchedTerms;

    let glossarySection = '';
    if (termsToInclude.length > 0) {
      if (this.sourceLang === 'ja' && this.targetLang === 'en') {
        glossarySection =
          '\nMandatory Glossary (JA -> EN):\n' +
          termsToInclude
            .map((t) => `- ${t.ja} = ${t.PrimaryEn || t.en}${t.note ? ` (${t.note})` : ''}`)
            .join('\n');
      } else if (this.sourceLang === 'en' && this.targetLang === 'ja') {
        glossarySection =
          '\nMandatory Glossary (EN -> JA, MUST use these exact Japanese church terms):\n' +
          termsToInclude
            .map((t) => `- "${t.PrimaryEn || t.en}" = ${t.ja}${t.note ? ` (${t.note})` : ''}`)
            .join('\n');
      } else if (this.targetLang === 'ja') {
        glossarySection =
          `\nMandatory Church Glossary Reference (Translate into these exact Japanese terms):\n` +
          termsToInclude
            .map((t) => `- Concept "${t.PrimaryEn || t.en}" => Japanese: 「${t.ja}」`)
            .join('\n');
      } else {
        // タガログ語 (tl) やインドネシア語 (id) などへの通訳時は、日英用語集の意味を基準に該当言語の教会正式用語へ訳させる
        glossarySection =
          `\nChurch Glossary Reference (Ensure accurate ${tgtInfo.nameEn} LDS/Christian terms matching these concepts):\n` +
          termsToInclude
            .map((t) => `- ${t.ja} ("${t.PrimaryEn || t.en}")${t.note ? ` [${t.note}]` : ''}`)
            .join('\n');
      }
    }

    const activeFeedback = (this.feedbackRules || []).filter((r) => r.enabled !== false);
    const feedbackSection =
      activeFeedback.length > 0
        ? '\nUser Feedback & Style Preferences (MUST FOLLOW):\n' +
          activeFeedback.slice(0, 12).map((r) => `- ${r.text}`).join('\n')
        : '';

    const activeCorrections = (this.correctionExamples || []).filter((c) => c.enabled !== false);
    let correctionsSection = '';
    if (activeCorrections.length > 0 && this.sourceLang === 'ja' && this.targetLang === 'en') {
      const relevant = activeCorrections
        .filter(
          (c) =>
            !currentSourceText ||
            currentSourceText.includes(c.ja.slice(0, 6)) ||
            c.ja.includes(currentSourceText.slice(0, 6))
        )
        .slice(0, 3);
      const recent = activeCorrections.slice(0, 4);
      const combined = [
        ...new Map([...relevant, ...recent].map((item) => [item.id || item.ja, item])).values(),
      ].slice(0, 5);
      correctionsSection =
        '\nApproved Translation Corrections (Follow these phrasing patterns):\n' +
        combined.map((c) => `- JA: "${c.ja}" => Preferred EN: "${c.afterEn}"`).join('\n');
    }

    let targetStyleExtra = '';
    if (this.targetLang === 'ja') {
      targetStyleExtra =
        '\n3. Output in polite, natural, reverent Japanese (丁寧な敬体「です・ます調」で、教会・聖典の自然な日本語表現を使用すること).';
    } else if (this.targetLang === 'tl') {
      targetStyleExtra =
        '\n3. Output in natural, reverent Tagalog (Filipino) appropriate for church sermons and prayers (e.g., Ama sa Langit, Panginoong Jesucristo, Espiritu Santo, tipan, batas ng pag-aayuno, sakramento).';
    } else if (this.targetLang === 'id') {
      targetStyleExtra =
        '\n3. Output in natural, reverent Indonesian (Bahasa Indonesia) appropriate for church sermons and prayers (e.g., Bapa Surgawi, Tuhan Yesus Kristus, Roh Kudus, perjanjian, hukum puasa, sakramen).';
    }

    return `${churchRole}
${sceneConfig.instruction}
Rules:
1. Output ONLY the ${tgtInfo.nameEn} translation. No notes, no romaji, no explanations.
2. Translate incomplete spoken clauses naturally so they read smoothly as live subtitles.
3. Silently infer and correct obvious speech-to-text homophone errors from context (e.g., church terms, scripture names, ward/stake names, prayer phrases) without mentioning the typo.${targetStyleExtra}${glossarySection}${feedbackSection}${correctionsSection}`;
  }

  /**
   * 1フレーズの入力テキストを超低遅延ストリーミングで目標言語に通訳する
   */
  async translateSegmentStream(sourceText, glossaryList = [], onDelta = () => {}) {
    return this.translateToLangStream(sourceText, this.targetLang, glossaryList, onDelta);
  }

  /**
   * 指定した特定のターゲット言語へ1フレーズを通訳する（複数言語同時通訳向け）
   */
  async translateToLangStream(sourceText, targetLangCode, glossaryList = [], onDelta = () => {}) {
    const cleanSource = sourceText.trim();
    if (!cleanSource) {
      return {
        englishText: '',
        matchedTerms: [],
        usedDemo: false,
        activeModel: this.getActiveModelName(),
      };
    }

    const matchedTerms = this.findMatchedGlossaryTerms(cleanSource, glossaryList);

    // 過去にユーザーが完全に同じ文を修正学習していた場合は、日→英かつAPI未設定時でもその修正文を優先使用
    const exactCorrection =
      this.sourceLang === 'ja' && targetLangCode === 'en'
        ? (this.correctionExamples || []).find(
            (c) =>
              c.enabled !== false &&
              c.ja.replace(/[。！？\s]/g, '') === cleanSource.replace(/[。！？\s]/g, '')
          )
        : null;

    // APIキー未設定時はデモ・スマート通訳エンジンで即座に動作
    if (!this.hasApiKey()) {
      const demoOut = exactCorrection
        ? await this.streamPresetText(exactCorrection.afterEn, onDelta)
        : await this.simulateDemoStreamForLang(cleanSource, targetLangCode, glossaryList, matchedTerms, onDelta);
      this.pushContext(cleanSource, demoOut);
      return {
        englishText: demoOut,
        matchedTerms,
        usedDemo: true,
        activeModel: 'Demo Engine',
      };
    }

    // 指定ターゲット言語用のシステムプロンプトを構築
    const savedTarget = this.targetLang;
    this.targetLang = targetLangCode;
    const systemInstruction = this.buildFastSystemInstruction(
      matchedTerms,
      glossaryList,
      false,
      cleanSource
    );
    this.targetLang = savedTarget;

    const srcTag = this.sourceLang.toUpperCase();
    const tgtTag = targetLangCode.toUpperCase();

    // 直近2文のみを軽量コンテキストとして付与
    let contextBlock = '';
    if (this.recentContext.length > 0) {
      const recentStr = this.recentContext
        .slice(-2)
        .map((c) => `${srcTag}: ${c.ja} -> ${tgtTag}: ${c.en}`)
        .join('\n');
      contextBlock = `Context:\n${recentStr}\n\n`;
    }

    const userInput = `${contextBlock}${srcTag}: ${cleanSource}\n${tgtTag}:`;

    const finalOut = await this.streamWithBrowserSafeFallback(
      userInput,
      systemInstruction,
      onDelta
    );

    this.pushContext(cleanSource, finalOut);

    return {
      englishText: finalOut,
      matchedTerms,
      usedDemo: false,
      activeModel: this.getActiveModelName(),
    };
  }

  /**
   * 複数言語（最大3つ）へ同時に並列通訳する
   */
  async translateMultiLangStream(sourceText, targetLangCodes = [], glossaryList = [], onLangDelta = () => {}) {
    const cleanSource = sourceText.trim();
    if (!cleanSource || !Array.isArray(targetLangCodes) || targetLangCodes.length === 0) {
      return {};
    }

    const results = {};
    const promises = targetLangCodes.map(async (targetCode) => {
      try {
        const res = await this.translateToLangStream(
          cleanSource,
          targetCode,
          glossaryList,
          (delta) => {
            onLangDelta(targetCode, delta);
          }
        );
        results[targetCode] = res;
      } catch (err) {
        console.error(`Translation error for ${targetCode}:`, err);
        results[targetCode] = {
          englishText: `[Error: ${err?.message || '通訳エラー'}]`,
          matchedTerms: [],
          usedDemo: false,
          activeModel: this.getActiveModelName(),
        };
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * 双方向会話向けの軽量システムプロンプトを構築
   * - 日常 / 丁寧 / 教会のトーン切替と、用語集ON/OFFに対応
   */
  buildConversationSystemInstruction({
    sourceLang = 'ja',
    targetLang = 'en',
    tone = 'casual',
    useGlossary = false,
    matchedTerms = [],
  } = {}) {
    const srcInfo = SUPPORTED_LANGUAGES[sourceLang] || SUPPORTED_LANGUAGES.ja;
    const tgtInfo = SUPPORTED_LANGUAGES[targetLang] || SUPPORTED_LANGUAGES.en;
    const toneConfig = CONVERSATION_TONES[tone] || CONVERSATION_TONES.casual;

    let glossarySection = '';
    if (useGlossary && matchedTerms.length > 0) {
      if (sourceLang === 'ja' && targetLang === 'en') {
        glossarySection =
          '\nPreferred Glossary (JA -> EN):\n' +
          matchedTerms
            .map((t) => `- ${t.ja} = ${t.PrimaryEn || t.en}${t.note ? ` (${t.note})` : ''}`)
            .join('\n');
      } else if (sourceLang === 'en' && targetLang === 'ja') {
        glossarySection =
          '\nPreferred Glossary (EN -> JA):\n' +
          matchedTerms
            .map((t) => `- "${t.PrimaryEn || t.en}" = ${t.ja}${t.note ? ` (${t.note})` : ''}`)
            .join('\n');
      } else if (targetLang === 'ja') {
        glossarySection =
          '\nPreferred Glossary (Translate into these Japanese terms when relevant):\n' +
          matchedTerms
            .map((t) => `- "${t.PrimaryEn || t.en}" => 「${t.ja}」`)
            .join('\n');
      } else {
        glossarySection =
          `\nGlossary Reference (Use natural ${tgtInfo.nameEn} equivalents):\n` +
          matchedTerms
            .map((t) => `- ${t.ja} ("${t.PrimaryEn || t.en}")`)
            .join('\n');
      }
    }

    let targetStyleExtra = '';
    if (targetLang === 'ja') {
      targetStyleExtra = `\n3. ${toneConfig.jaStyle}`;
    } else if (targetLang === 'tl') {
      targetStyleExtra =
        '\n3. Output in natural, conversational Tagalog (Filipino) matching the requested tone.';
    } else if (targetLang === 'id') {
      targetStyleExtra =
        '\n3. Output in natural, conversational Indonesian (Bahasa Indonesia) matching the requested tone.';
    }

    const roleDesc =
      tone === 'church'
        ? `Real-time bidirectional interpreter for church fellowship (${srcInfo.nameEn} to ${tgtInfo.nameEn}).`
        : `Real-time bidirectional spoken conversation interpreter (${srcInfo.nameEn} to ${tgtInfo.nameEn}).`;

    return `${roleDesc}
${toneConfig.instruction}
Rules:
1. Output ONLY the ${tgtInfo.nameEn} translation of the latest utterance. No notes, no speaker labels, no quotation marks, no explanations.
2. Preserve the speaker's intent, emotion, and conversational flow, using the recent dialogue context to resolve pronouns ("it", "that", "they", etc.).
3. Silently fix obvious speech-to-text recognition errors from context without commenting on them.${targetStyleExtra}${glossarySection}`;
  }

  /**
   * 双方向会話の1発話を指定された複数言語へ並列ストリーミング翻訳する
   */
  async translateConversationTurn({
    sourceText,
    sourceLang = 'ja',
    targetLangs = ['en'],
    speakerName = 'Speaker',
    tone = 'casual',
    useGlossary = false,
    glossaryList = [],
    conversationHistory = [],
    onLangDelta = () => {},
  }) {
    const cleanSource = (sourceText || '').trim();
    const uniqueTargets = [...new Set((targetLangs || []).filter((l) => l && l !== sourceLang))];
    if (!cleanSource || uniqueTargets.length === 0) {
      return { translations: {}, matchedTerms: [], usedDemo: false, activeModel: this.getActiveModelName() };
    }

    const matchedTerms = useGlossary
      ? this.findMatchedGlossaryTerms(cleanSource, glossaryList, sourceLang)
      : [];

    const translations = {};
    let usedDemo = false;

    const recentTurns = (conversationHistory || []).slice(-4);

    const promises = uniqueTargets.map(async (targetLang) => {
      if (!this.hasApiKey()) {
        usedDemo = true;
        const tgtInfo = SUPPORTED_LANGUAGES[targetLang] || SUPPORTED_LANGUAGES.en;
        const demoText = `[Demo ${tgtInfo.code.toUpperCase()}] ${cleanSource}`;
        await this.streamPresetText(demoText, (delta) => onLangDelta(targetLang, delta));
        translations[targetLang] = demoText;
        return;
      }

      const systemInstruction = this.buildConversationSystemInstruction({
        sourceLang,
        targetLang,
        tone,
        useGlossary,
        matchedTerms,
      });

      let contextBlock = '';
      if (recentTurns.length > 0) {
        const lines = recentTurns.map((turn) => {
          const turnText = turn.sourceText || '';
          const turnTarget = turn.translations?.[targetLang];
          return turnTarget
            ? `${turn.speakerName || 'Speaker'} (${turn.sourceLang}): ${turnText} => (${targetLang}): ${turnTarget}`
            : `${turn.speakerName || 'Speaker'} (${turn.sourceLang}): ${turnText}`;
        });
        contextBlock = `Recent conversation:\n${lines.join('\n')}\n\n`;
      }

      const userInput = `${contextBlock}Translate this latest utterance from ${speakerName} (${sourceLang.toUpperCase()}) into ${targetLang.toUpperCase()}:\n${cleanSource}`;

      try {
        const out = await this.streamWithBrowserSafeFallback(
          userInput,
          systemInstruction,
          (delta) => onLangDelta(targetLang, delta)
        );
        translations[targetLang] = (out || '').trim();
      } catch (err) {
        console.error(`Conversation translation error (${sourceLang}->${targetLang}):`, err);
        translations[targetLang] = `[Translation Error: ${err?.message || 'Error'}]`;
      }
    });

    await Promise.all(promises);

    return {
      translations,
      matchedTerms,
      usedDemo,
      activeModel: usedDemo ? 'Demo Engine' : this.getActiveModelName(),
    };
  }

  /**
   * ブラウザ直接SSEストリーミング + サーバー混雑 (503 high demand / 429) 時のマルチモデル自動フェイルオーバー
   */
  async streamWithBrowserSafeFallback(userInput, systemInstruction, onDelta) {
    const candidateModels = await this.getCandidateModelsForKey();
    let lastError = null;

    for (const candidateModel of candidateModels) {
      try {
        const resultText = await this.streamViaCorsSafeSSE(
          candidateModel,
          userInput,
          systemInstruction,
          onDelta
        );
        if (resultText) {
          this.resolvedModel = candidateModel;
          this.overloadedModels.delete(candidateModel);
          return resultText;
        }
      } catch (err) {
        lastError = err;
        const msgLower = String(err?.message || '').toLowerCase();

        if ((err?.status === 400 || err?.status === 403) && msgLower.includes('api key')) {
          throw new Error('Gemini APIキーが無効です。「⚙ API・設定」から正しいAPIキーをご確認ください。');
        }

        if (
          err?.status === 503 ||
          err?.status === 429 ||
          msgLower.includes('high demand') ||
          msgLower.includes('overloaded') ||
          msgLower.includes('resource_exhausted') ||
          msgLower.includes('quota')
        ) {
          console.warn(
            `Model "${candidateModel}" is experiencing high demand/rate-limit (${err.message}). Failing over immediately...`
          );
          this.overloadedModels.set(candidateModel, Date.now() + 60000);
          if (this.resolvedModel === candidateModel) {
            this.resolvedModel = '';
          }
          continue;
        }
      }
    }

    const liteFallbacks = candidateModels.filter((m) => m.includes('lite') || m.includes('flash'));
    if (liteFallbacks.length > 0) {
      await new Promise((r) => setTimeout(r, 450));
      for (const retryModel of liteFallbacks.slice(0, 2)) {
        try {
          const retryText = await this.streamViaCorsSafeSSE(
            retryModel,
            userInput,
            systemInstruction,
            onDelta
          );
          if (retryText) {
            this.resolvedModel = retryModel;
            return retryText;
          }
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
    }

    throw lastError || new Error('Gemini APIとの通信に失敗しました。APIキーまたはネットワーク接続をご確認ください。');
  }

  /**
   * ユーザーのAPIキーで利用可能な高速モデルの優先リストを取得
   * - 同時通訳の速度を最大化するため、安定版 flash-lite を最優先に配置
   */
  async getCandidateModelsForKey() {
    const preferredOrder = [
      this.model,
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
    ];

    if (!this.cachedAvailableModels) {
      try {
        const res = await window.fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(this.apiKey)}`
        );
        if (res.ok) {
          const data = await res.json();
          this.cachedAvailableModels = (data.models || [])
            .filter(
              (m) =>
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes('generateContent')
            )
            .map((m) => m.name.replace(/^models\//, ''));
        } else if (res.status === 400 || res.status === 403) {
          const errJson = await res.json().catch(() => ({}));
          const msg = errJson?.error?.message || `HTTP ${res.status}`;
          const error = new Error(`APIキー認証エラー: ${msg}`);
          error.status = res.status;
          throw error;
        }
      } catch (err) {
        if (err?.status === 400 || err?.status === 403) {
          throw err;
        }
      }
    }

    const availableNames = this.cachedAvailableModels || [];
    if (availableNames.length === 0) {
      return [...new Set(preferredOrder)];
    }

    const isSuitableTextModel = (name) =>
      !name.includes('image') &&
      !name.includes('tts') &&
      !name.includes('audio') &&
      !name.includes('embedding') &&
      !name.includes('veo') &&
      !name.includes('imagen') &&
      !name.includes('aqa') &&
      !name.includes('robotics') &&
      !name.includes('computer-use');

    const textModels = availableNames.filter(isSuitableTextModel);

    // 1. 優先指定モデルの中で利用可能なもの
    const matchedPreferred = preferredOrder.filter((m) => textModels.includes(m));

    // 2. 安定版 flash-lite 系（最速・思考オーバーヘッド最小）
    const stableFlashLite = textModels
      .filter(
        (n) =>
          n.includes('flash') &&
          n.includes('lite') &&
          !n.includes('preview') &&
          !n.includes('exp')
      )
      .sort()
      .reverse();

    // 3. 安定版 flash 系
    const stableFlash = textModels
      .filter(
        (n) =>
          n.includes('flash') &&
          !n.includes('lite') &&
          !n.includes('preview') &&
          !n.includes('exp') &&
          !n.includes('thinking')
      )
      .sort()
      .reverse();

    // 4. preview / exp を含むその他の flash-lite / flash 系
    const previewFlashLite = textModels
      .filter((n) => n.includes('flash') && n.includes('lite') && (n.includes('preview') || n.includes('exp')))
      .sort()
      .reverse();

    const previewFlash = textModels
      .filter((n) => n.includes('flash') && !n.includes('lite') && (n.includes('preview') || n.includes('exp')))
      .sort()
      .reverse();

    // 5. バックアップモデル
    const backupModels = textModels.filter((n) => !n.includes('flash')).sort().reverse();

    const ordered = [
      ...(this.resolvedModel ? [this.resolvedModel] : []),
      ...matchedPreferred,
      ...stableFlashLite,
      ...stableFlash,
      ...previewFlashLite,
      ...previewFlash,
      ...backupModels,
    ];

    const uniqueOrdered = [...new Set(ordered)];

    const now = Date.now();
    const healthy = [];
    const coolingDown = [];
    for (const m of uniqueOrdered) {
      const expireAt = this.overloadedModels.get(m);
      if (expireAt && expireAt > now) {
        coolingDown.push(m);
      } else {
        if (expireAt) this.overloadedModels.delete(m);
        healthy.push(m);
      }
    }

    return [...healthy, ...coolingDown];
  }

  /**
   * 思考トークン待機ゼロ (thinkingBudget: 0) で超低遅延ストリーミングを行う
   */
  async streamViaCorsSafeSSE(modelId, userInput, systemInstruction, onDelta) {
    const cleanModel = modelId.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cleanModel
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;

    const isGemma = cleanModel.startsWith('gemma');
    const canDisableThinking =
      !isGemma &&
      cleanModel.includes('flash') &&
      !this.noThinkingSupportModels.has(cleanModel);

    const buildPayload = (withZeroThinking) => {
      const generationConfig = {
        temperature: 0.1,
        ...(withZeroThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      };

      if (isGemma) {
        return {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${userInput}` }],
            },
          ],
          generationConfig,
        };
      }

      return {
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userInput }],
          },
        ],
        generationConfig,
      };
    };

    let response = await window.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(canDisableThinking)),
    });

    // もし該当モデルが thinkingConfig パラメータ非対応 (400) だった場合は即座に外して再送
    if (!response.ok && response.status === 400 && canDisableThinking) {
      this.noThinkingSupportModels.add(cleanModel);
      response = await window.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(false)),
      });
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
      const error = new Error(errMsg);
      error.status = response.status;
      throw error;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      const fullData = await response.json();
      const text =
        fullData?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      onDelta(text);
      return text.trim();
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const parts = parsed?.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            // 思考パート (thought: true) はスキップし、テキストのみを即時出力
            if (part.thought) continue;
            if (part.text) {
              accumulated += part.text;
              onDelta(accumulated);
            }
          }
        } catch {}
      }
    }

    return accumulated.trim();
  }

  /**
   * 設定画面の「API接続テスト」ボタン用診断メソッド
   */
  async testConnection(glossaryList = []) {
    if (!this.hasApiKey()) {
      throw new Error('APIキーが入力されていません。');
    }
    this.resolvedModel = '';
    const startTime = performance.now();
    let preview = '';
    const res = await this.translateSegmentStream(
      '主の恵みと平安が皆様と共にありますように。',
      glossaryList,
      (delta) => {
        preview = delta;
      }
    );
    const elapsedMs = Math.round(performance.now() - startTime);
    return {
      ok: true,
      activeModel: res.activeModel,
      elapsedMs,
      sampleTranslation: res.englishText || preview,
    };
  }

  /**
   * Gemini Live API (gemini-3.8-live) を用いたWebSocket双方向音声ストリーム通訳の開始
   */
  async startLiveAudioSession({
    glossaryList = [],
    onInputTranscript = () => {},
    onOutputTranscript = () => {},
    onStatusChange = () => {},
    onError = () => {},
  }) {
    if (!this.hasApiKey()) {
      throw new Error('Gemini Live APIを使用するには、右上の「API設定」からGemini APIキーを設定してください。');
    }

    await this.stopLiveAudioSession();
    onStatusChange('connecting');

    const srcInfo = this.getSourceLangInfo();
    const tgtInfo = this.getTargetLangInfo();

    const systemInstruction =
      this.buildFastSystemInstruction([], glossaryList, true) +
      `\nWait for the speaker to speak in ${srcInfo.nameEn}, and immediately interpret what they say into ${tgtInfo.nameEn}.`;

    this.liveSession = await this.client.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: ['audio'],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          onStatusChange('connected');
        },
        onmessage: (response) => {
          const content = response.serverContent;
          if (!content) return;
          if (content.inputTranscription?.text) {
            onInputTranscript(content.inputTranscription.text);
          }
          if (content.outputTranscription?.text) {
            onOutputTranscript(content.outputTranscription.text, Boolean(content.turnComplete));
          }
        },
        onerror: (err) => {
          onError(err);
        },
        onclose: () => {
          onStatusChange('closed');
        },
      },
    });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (audioEvent) => {
      if (!this.liveSession) return;
      const inputData = audioEvent.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
      try {
        this.liveSession.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } catch {}
    };

    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  async stopLiveAudioSession() {
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    if (this.liveSession) {
      try {
        this.liveSession.sendRealtimeInput({ audioStreamEnd: true });
        this.liveSession.close?.();
      } catch {}
      this.liveSession = null;
    }
  }

  /**
   * Gemini Interactions API (TTSモデル) でテキストを音声合成し、Base64音声データとMIMEタイプを返す
   */
  async synthesizeSpeech(text, { model = 'gemini-3.8-flash-lite-tts', voice = 'Kore', style } = {}) {
    const cleanText = (text || '').trim();
    if (!cleanText || !this.hasApiKey()) return null;

    const cleanModel = (model || 'gemini-3.8-flash-lite-tts').replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(this.apiKey)}`;

    const body = {
      model: cleanModel,
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: cleanText,
              annotations: [
                {
                  type: 'speech_metadata',
                  style: style || 'calm, warm, and reverent tone suitable for a church service',
                },
              ],
            },
          ],
        },
      ],
      response_format: {
        type: 'audio',
      },
      generation_config: {
        speech_config: [
          {
            voice: voice || 'Kore',
          },
        ],
      },
      store: false,
    };

    const response = await window.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TTS API Error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const result = await response.json();
    if (result?.output_audio?.data) {
      return {
        data: result.output_audio.data,
        mimeType: result.output_audio.mime_type || 'audio/wav',
      };
    }

    if (Array.isArray(result?.steps)) {
      for (const step of result.steps) {
        if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
        for (const part of step.content) {
          if (part?.type === 'audio' && part.data) {
            return {
              data: part.data,
              mimeType: part.mime_type || 'audio/wav',
            };
          }
        }
      }
    }

    return null;
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  pushContext(ja, en) {
    if (!ja || !en) return;
    this.recentContext.push({ ja, en });
    if (this.recentContext.length > 4) {
      this.recentContext.shift();
    }
  }

  /**
   * 入力テキスト中に含まれる有効な教会用語を検出する（日→他言語、英→日など双方向対応）
   */
  findMatchedGlossaryTerms(sourceText, glossaryList = [], explicitSourceLang = null) {
    if (!sourceText) return [];
    const activeSourceLang = explicitSourceLang || this.sourceLang;
    const activeItems = [...glossaryList].filter((item) => item.enabled && item.ja);
    const matched = [];

    if (activeSourceLang === 'ja' || /[一-龠ぁ-んァ-ヶ]/.test(sourceText)) {
      const sortedJa = [...activeItems].sort((a, b) => b.ja.length - a.ja.length);
      for (const item of sortedJa) {
        if (sourceText.includes(item.ja)) {
          const primaryEn = item.en.replace(/\s*\(.*?\)\s*/g, '').trim();
          matched.push({
            ...item,
            PrimaryEn: primaryEn || item.en,
          });
        }
      }
      if (matched.length > 0 || activeSourceLang === 'ja') {
        return matched;
      }
    }

    // 英語などのアルファベット入力から用語集（item.en）を逆引き検出
    const lowerSource = sourceText.toLowerCase();
    const sortedEn = [...activeItems].sort((a, b) => (b.en?.length || 0) - (a.en?.length || 0));

    for (const item of sortedEn) {
      const primaryEn = (item.en || '').replace(/\s*\(.*?\)\s*/g, '').trim();
      const candidates = primaryEn
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s.length >= 3);

      const hit = candidates.some((cand) => {
        const cleanCand = cand.replace(/^the\s+/i, '').toLowerCase();
        return cleanCand.length >= 3 && lowerSource.includes(cleanCand);
      });

      if (hit) {
        matched.push({
          ...item,
          PrimaryEn: primaryEn || item.en,
        });
      }
    }

    return matched;
  }

  /**
   * APIキー未設定時でもリアルな同時通訳ストリーミングと教会用語集の適用を体験できるデモエンジン（多言語対応）
   */
  async simulateDemoStream(sourceText, glossaryList, matchedTerms, onDelta) {
    return this.simulateDemoStreamForLang(sourceText, this.targetLang, glossaryList, matchedTerms, onDelta);
  }

  async simulateDemoStreamForLang(sourceText, targetLangCode, glossaryList, matchedTerms, onDelta) {
    const presetMatch = SAMPLE_SERMON_SEGMENTS.find(
      (seg) =>
        seg.ja === sourceText ||
        seg.fallbackEn === sourceText ||
        seg.tl === sourceText ||
        seg.id === sourceText ||
        (seg.ja && sourceText.includes(seg.ja.slice(0, 18))) ||
        (seg.fallbackEn &&
          sourceText.toLowerCase().includes(seg.fallbackEn.slice(0, 26).toLowerCase()))
    );

    let targetOutput = '';
    if (presetMatch) {
      if (targetLangCode === 'ja') {
        targetOutput = presetMatch.ja;
      } else if (targetLangCode === 'tl') {
        targetOutput = presetMatch.tl || presetMatch.fallbackEn;
      } else if (targetLangCode === 'id') {
        targetOutput = presetMatch.id || presetMatch.fallbackEn;
      } else {
        targetOutput = presetMatch.fallbackEn;
      }
    } else {
      targetOutput = this.composeRuleBasedChurchTranslationForLang(sourceText, targetLangCode, matchedTerms);
    }

    return this.streamPresetText(targetOutput, onDelta);
  }

  composeRuleBasedChurchTranslation(sourceText, matchedTerms) {
    return this.composeRuleBasedChurchTranslationForLang(sourceText, this.targetLang, matchedTerms);
  }

  composeRuleBasedChurchTranslationForLang(sourceText, targetLangCode, matchedTerms) {
    const tgtInfo = SUPPORTED_LANGUAGES[targetLangCode] || SUPPORTED_LANGUAGES.en;
    const patterns = [
      {
        test: /おはようございます|good morning|magandang umaga|selamat pagi/i,
        en: 'Good morning, everyone.',
        ja: '皆様、おはようございます。',
        tl: 'Magandang umaga po sa inyong lahat.',
        id: 'Selamat pagi semuanya.',
      },
      {
        test: /ようこそ|welcome|maligayang pagdating|selamat datang/i,
        en: 'Welcome to our service today.',
        ja: '本日の礼拝へようこそお越しくださいました。',
        tl: 'Maligayang pagdating po sa ating pagsamba ngayon.',
        id: 'Selamat datang di kebaktian kita hari ini.',
      },
      {
        test: /お祈り(いた)?します|祈りましょう|let us pray|manalangin tayo|mari kita berdoa/i,
        en: 'Let us pray together.',
        ja: '共にお祈りいたしましょう。',
        tl: 'Manalangin po tayo nang magkakasama.',
        id: 'Marilah kita berdoa bersama-sama.',
      },
      {
        test: /感謝(いた)?します|感謝します|thank you|we thank thee|nagpapasalamat|kami bersyukur/i,
        en: 'We give You our heartfelt thanks.',
        ja: '心から感謝いたします。',
        tl: 'Taos-puso po kaming nagpapasalamat sa Iyo.',
        id: 'Kami mengucapkan syukur dari lubuk hati kami.',
      },
      {
        test: /アーメン|\bamen\b|\bamin\b/i,
        en: 'Amen.',
        ja: 'アーメン。',
        tl: 'Amen.',
        id: 'Amin.',
      },
    ];

    const parts = [];
    for (const p of patterns) {
      if (p.test.test(sourceText)) {
        parts.push(p[targetLangCode] || p.en);
      }
    }

    if (matchedTerms.length > 0) {
      const termPhrases = matchedTerms.map((t) =>
        targetLangCode === 'ja' ? t.ja : t.PrimaryEn || t.en
      );
      if (parts.length > 0) {
        return `${parts.join(' ')} [適用用語: ${termPhrases.join(', ')}]`;
      }
      if (targetLangCode === 'ja') {
        return `[デモモード — 教会用語適用: ${termPhrases.join(' ／ ')}] （全文のAI通訳を行うには右上の「⚙ API・設定」からGemini APIキーを設定してください）`;
      }
      return `[Demo Mode (${tgtInfo.nameEn}) — Glossary Applied: ${termPhrases.join(' / ')}] (Set Gemini API key in Settings for full AI interpretation)`;
    }

    if (parts.length > 0) {
      return parts.join(' ');
    }

    if (targetLangCode === 'ja') {
      return `[デモモード (${tgtInfo.nameJa}通訳)] "${sourceText}" — 右上の「⚙ API・設定」からGemini APIキーを設定すると、リアルタイムAI通訳が動作します。`;
    }
    return `[Demo Mode (${tgtInfo.nameEn})] "${sourceText}" — Please set your Gemini API Key in "⚙ API・設定" to enable full real-time AI interpretation.`;
  }

  async streamPresetText(text, onDelta) {
    // 日本語などスペース区切りでないテキストは数文字単位で滑らかにストリーミング表示
    if (!text.includes(' ') && text.length > 10) {
      let current = '';
      const step = 4;
      for (let i = 0; i < text.length; i += step) {
        current = text.slice(0, i + step);
        onDelta(current);
        await new Promise((r) => setTimeout(r, 15));
      }
      return text;
    }

    const words = text.split(' ');
    let current = '';
    for (let i = 0; i < words.length; i++) {
      current += (i === 0 ? '' : ' ') + words[i];
      onDelta(current);
      await new Promise((r) => setTimeout(r, 15));
    }
    return text;
  }

  /**
   * ユーザーの自由記述フィードバックや、通訳結果の修正差分（Before/After）を解析し、
   * 1) 辞書に登録・更新すべき用語ペア (terms)
   * 2) 今後の通訳システムプロンプトに追加すべき通訳改善ルール (rules)
   * を自動抽出する
   */
  async analyzeFeedbackAndCorrections({ feedbackText = '', modifiedPairs = [] }) {
    const extractedTerms = [];
    const extractedRules = [];

    // 1. ローカル正規表現による即時抽出（「〇〇」は「△△」と訳す / 〇〇 = △△ 等）
    const cleanFeedback = feedbackText.trim();
    if (cleanFeedback) {
      const lines = cleanFeedback
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      for (const line of lines) {
        // パターン例: 「兄弟姉妹」は「Brothers and sisters in Christ」 / 「礼拝堂」は sanctuary に統一
        const quoteMatch = line.match(
          /[「『"]([^」』"]+)[」』"]\s*(?:は|を|＝|=|->|➔)\s*[「『"]?([A-Za-z0-9\s,'\-/().]+?)[」』"]?(?:\s*(?:と訳|に統一|にする|にして|で通訳|へ変更).*)?$/
        );
        if (quoteMatch && quoteMatch[1] && quoteMatch[2]) {
          const jaTerm = quoteMatch[1].trim();
          const enTerm = quoteMatch[2].trim();
          if (jaTerm && enTerm && /[A-Za-z]/.test(enTerm)) {
            extractedTerms.push({
              ja: jaTerm,
              en: enTerm,
              category: 'custom',
              note: 'フィードバックから自動登録',
            });
          }
        }
        extractedRules.push(line);
      }
    }

    // 2. Gemini APIキーが設定されている場合は、修正前後の英文差分やフィードバックからAIでさらに用語と通訳ルールを抽出
    if (this.hasApiKey() && (cleanFeedback || modifiedPairs.length > 0)) {
      try {
        const promptParts = [
          'You are an expert Protestant church interpretation trainer.',
          'Analyze the user feedback and/or user-edited translation corrections below, and return ONLY valid JSON with two arrays:',
          '{"terms": [{"ja": "日本語用語", "en": "Preferred English term", "note": "context note"}], "rules": ["Concise rule for future interpretation (in Japanese or English)"]}',
        ];

        if (cleanFeedback) {
          promptParts.push(`\nUser Feedback:\n${cleanFeedback}`);
        }
        if (modifiedPairs.length > 0) {
          const pairsStr = modifiedPairs
            .map(
              (p, idx) =>
                `${idx + 1}. JA: ${p.ja}\n   Original EN: ${p.beforeEn}\n   User Corrected EN: ${p.afterEn}`
            )
            .join('\n');
          promptParts.push(`\nUser-Edited Translations:\n${pairsStr}`);
        }

        const rawResponse = await this.streamWithBrowserSafeFallback(
          promptParts.join('\n'),
          'Return ONLY raw JSON without markdown fences.',
          () => {}
        );

        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.terms)) {
            for (const t of parsed.terms) {
              if (t?.ja && t?.en) {
                const exists = extractedTerms.some((et) => et.ja === t.ja.trim());
                if (!exists) {
                  extractedTerms.push({
                    ja: t.ja.trim(),
                    en: t.en.trim(),
                    category: 'custom',
                    note: t.note || '通訳修正・フィードバックからAI抽出',
                  });
                }
              }
            }
          }
          if (Array.isArray(parsed.rules)) {
            for (const r of parsed.rules) {
              if (typeof r === 'string' && r.trim()) {
                if (!extractedRules.includes(r.trim())) {
                  extractedRules.push(r.trim());
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('AI feedback extraction fallback to local rules:', err);
      }
    }

    return {
      terms: extractedTerms,
      rules: extractedRules,
    };
  }

  /**
   * 教会の説教の日本語原稿と英語訳原稿（対訳テキスト）を比較解析し、
   * 辞書登録すべき教会用語・固有名詞・神学表現・定型フレーズの候補リストを自動抽出する
   */
  async extractGlossaryCandidatesFromSermonPair(
    jaManuscript = '',
    enManuscript = '',
    existingGlossary = []
  ) {
    const cleanJa = jaManuscript.trim();
    const cleanEn = enManuscript.trim();
    if (!cleanJa || !cleanEn) {
      throw new Error('日本語の説教原稿と英語訳の文章の両方を入力してください。');
    }

    const existingMap = new Map(
      (existingGlossary || []).map((g) => [g.ja.trim(), g])
    );

    const candidates = [];
    const addCandidate = (item) => {
      if (!item?.ja || !item?.en) return;
      const jaKey = item.ja.trim();
      const enVal = item.en.trim();
      if (!jaKey || !enVal) return;
      if (candidates.some((c) => c.ja === jaKey)) return;

      const existing = existingMap.get(jaKey);
      const isAlreadySame =
        existing &&
        existing.en.toLowerCase().includes(enVal.toLowerCase());

      candidates.push({
        ja: jaKey,
        en: enVal,
        category: item.category || existing?.category || 'theology',
        reading: item.reading || existing?.reading || '',
        variants: Array.isArray(item.variants)
          ? item.variants
          : existing?.variants || [],
        note: item.note || (existing ? `既存訳「${existing.en}」からの更新候補` : '説教対訳から抽出'),
        status: existing
          ? isAlreadySame
            ? 'already_registered'
            : 'update_existing'
          : 'new',
        selected: !isAlreadySame, // 新規または既存と異なる訳語はデフォルトでチェックON
      });
    };

    // 1. Gemini API が設定されている場合は、対訳全文をAIで精密に比較して用語リストを抽出
    if (this.hasApiKey()) {
      const prompt = `You are a specialist in Protestant Christian sermon translation (Japanese to English).
Compare the following Japanese sermon text and its English translation.
List up all important terms, theological concepts, Bible book/character names, church events/roles, proper nouns, and recurring key phrases that should be registered in a Simultaneous Interpretation Glossary so the AI interpreter translates them consistently.

Japanese Sermon Text:
"""
${cleanJa.slice(0, 12000)}
"""

English Sermon Translation:
"""
${cleanEn.slice(0, 12000)}
"""

Return ONLY a valid JSON object in this exact format (no markdown fences):
{
  "candidates": [
    {
      "ja": "日本語の単語・熟語・表現",
      "en": "English translation used in the text",
      "category": "worship | theology | roles | life | scripture | custom",
      "reading": "よみがな(ひらがな)",
      "variants": ["音声認識が誤変換しやすい同音異義語があれば1〜2個"],
      "note": "簡単な補足（例：説教の主題語 / 聖書箇所 / 固有名詞 など）"
    }
  ]
}`;

      try {
        const rawJson = await this.streamWithBrowserSafeFallback(
          prompt,
          'Return ONLY valid JSON without markdown code blocks.',
          () => {}
        );
        const match = rawJson.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.candidates)) {
            for (const c of parsed.candidates) {
              addCandidate(c);
            }
          }
        }
      } catch (err) {
        console.warn('AI sermon glossary extraction fallback to local analyzer:', err);
      }
    }

    // 2. ローカル対訳アナライザー（API未設定時やAI抽出の補完として聖書名・教会頻出表現・カギ括弧語を検出）
    const builtInPatterns = [
      { ja: '神の国', enRegex: /\b(Kingdom of God|Kingdom of Heaven)\b/i, category: 'theology', reading: 'かみのくに', variants: ['髪の国'] },
      { ja: '永遠の命', enRegex: /\b(eternal life|everlasting life)\b/i, category: 'theology', reading: 'えいえんのいのち', variants: [] },
      { ja: '十字架', enRegex: /\b(the cross|cross of Christ)\b/i, category: 'theology', reading: 'じゅうじか', variants: [] },
      { ja: '復活', enRegex: /\b(resurrection)\b/i, category: 'theology', reading: 'ふっかつ', variants: [] },
      { ja: '悔い改め', enRegex: /\b(repentance|repent)\b/i, category: 'theology', reading: 'くいあらため', variants: ['食い改め'] },
      { ja: '罪の赦し', enRegex: /\b(forgiveness of sins)\b/i, category: 'theology', reading: 'つみのゆるし', variants: ['罪の許し'] },
      { ja: '義とされる', enRegex: /\b(justified|justification)\b/i, category: 'theology', reading: 'ぎとされる', variants: [] },
      { ja: '聖化', enRegex: /\b(sanctification|sanctified)\b/i, category: 'theology', reading: 'せいか', variants: ['聖火', '成果'] },
      { ja: '召命', enRegex: /\b(calling|vocation)\b/i, category: 'life', reading: 'しょうめい', variants: ['照明', '証明'] },
      { ja: '宣教', enRegex: /\b(mission|evangelism|ministry)\b/i, category: 'life', reading: 'せんきょう', variants: ['選挙', '船橋'] },
      { ja: '礼拝堂', enRegex: /\b(sanctuary|chapel)\b/i, category: 'worship', reading: 'れいはいどう', variants: [] },
      { ja: '講壇', enRegex: /\b(pulpit)\b/i, category: 'worship', reading: 'こうだん', variants: ['公団', '後段'] },
      { ja: '会衆', enRegex: /\b(congregation)\b/i, category: 'roles', reading: 'かいしゅう', variants: ['回収', '改修'] },
      { ja: '兄弟姉妹', enRegex: /\b(brothers and sisters(?: in Christ)?)\b/i, category: 'roles', reading: 'きょうだいしまい', variants: [] },
      { ja: '使徒言行録', enRegex: /\b(Book of Acts|Acts of the Apostles|Acts)\b/i, category: 'scripture', reading: 'しとげんこうろく', variants: [] },
      { ja: '使徒の働き', enRegex: /\b(Book of Acts|Acts)\b/i, category: 'scripture', reading: 'しとのはたらき', variants: [] },
      { ja: 'ローマ人への手紙', enRegex: /\b(Romans|Book of Romans)\b/i, category: 'scripture', reading: 'ろーまびとへのてがみ', variants: [] },
      { ja: 'コリントの信徒への手紙', enRegex: /\b(Corinthians)\b/i, category: 'scripture', reading: 'こりんとのしんとへのてがみ', variants: [] },
      { ja: 'マタイによる福音書', enRegex: /\b(Gospel of Matthew|Matthew)\b/i, category: 'scripture', reading: 'またいによるふくいんしょ', variants: [] },
      { ja: 'マルコによる福音書', enRegex: /\b(Gospel of Mark|Mark)\b/i, category: 'scripture', reading: 'まるこによるふくいんしょ', variants: [] },
      { ja: 'ルカによる福音書', enRegex: /\b(Gospel of Luke|Luke)\b/i, category: 'scripture', reading: 'るかによるふくいんしょ', variants: [] },
      { ja: 'ヨハネによる福音書', enRegex: /\b(Gospel of John|John)\b/i, category: 'scripture', reading: 'よはねによるふくいんしょ', variants: [] },
      { ja: '詩篇', enRegex: /\b(Psalm|Psalms)\b/i, category: 'scripture', reading: 'しへん', variants: ['紙片'] },
      { ja: '創世記', enRegex: /\b(Genesis)\b/i, category: 'scripture', reading: 'そうせいき', variants: [] },
      { ja: '出エジプト記', enRegex: /\b(Exodus)\b/i, category: 'scripture', reading: 'しゅつえじぷとき', variants: [] },
      { ja: 'イザヤ書', enRegex: /\b(Isaiah)\b/i, category: 'scripture', reading: 'いざやしょ', variants: [] },
      { ja: '黙示録', enRegex: /\b(Revelation|Book of Revelation)\b/i, category: 'scripture', reading: 'もくしろく', variants: [] },
    ];

    for (const pat of builtInPatterns) {
      if (cleanJa.includes(pat.ja)) {
        const m = cleanEn.match(pat.enRegex);
        if (m && m[1]) {
          addCandidate({
            ja: pat.ja,
            en: m[1],
            category: pat.category,
            reading: pat.reading,
            variants: pat.variants,
            note: '説教原稿内の対訳一致から検出',
          });
        }
      }
    }

    // 既存辞書に含まれる用語が原稿内でどう英訳されているかも照合してリストアップ
    for (const item of existingGlossary) {
      if (cleanJa.includes(item.ja)) {
        addCandidate({
          ja: item.ja,
          en: item.en,
          category: item.category,
          reading: item.reading,
          variants: item.variants,
          note: '原稿内に登場する登録済み教会用語',
        });
      }
    }

    // 新規・更新候補を優先してソート（new -> update_existing -> already_registered）
    const orderScore = { new: 0, update_existing: 1, already_registered: 2 };
    candidates.sort((a, b) => (orderScore[a.status] ?? 9) - (orderScore[b.status] ?? 9));

    return candidates;
  }
}
