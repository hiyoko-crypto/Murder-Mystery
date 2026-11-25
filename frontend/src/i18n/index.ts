export type Lang = 'ja' | 'en'

/* ─── UI文字列 ─── */
export const ui: Record<string, Record<Lang, string>> = {
  /* LocationPage */
  'loc.examine':        { ja: '調べる',                  en: 'Examine' },
  'loc.examine.hint':   { ja: '何かあるかも',            en: 'Something might be here' },
  'loc.found.hint':     { ja: '件 発見済み',             en: 'found' },
  'loc.talk':           { ja: '話す',                    en: 'Talk' },
  'loc.nobody':         { ja: '誰もいない',              en: 'Nobody here' },
  'loc.people':         { ja: '人いる',                  en: 'person(s) here' },
  'loc.examine.done0':  { ja: 'ここには何もないようだ。', en: 'Nothing to find here.' },

  /* InterrogationPage */
  'interro.log':        { ja: '会話ログ',                en: 'Chat Log' },
  'interro.hint':       { ja: '何か聞いてみよう',        en: 'Ask something…' },
  'interro.typing':     { ja: '……',                      en: '……' },
  'interro.skip':       { ja: 'タップでスキップ',        en: 'Tap to skip' },
  'interro.panel':      { ja: '証拠を提示する',          en: 'Present Evidence' },
  'interro.noevidence': { ja: 'まだ証拠がない',          en: 'No evidence yet' },
  'interro.comment':    { ja: 'コメントを追加（省略可）...', en: 'Add a comment (optional)…' },
  'interro.question':   { ja: '質問を入力...',           en: 'Enter your question…' },
  'interro.send':       { ja: '送信',                    en: 'Send' },
  'interro.present':    { ja: 'を提示する',              en: '— Present' },
  'interro.present.fmt':{ ja: '【証拠提示】',            en: '[Evidence] ' },
  'interro.detective':  { ja: '探偵',                    en: 'Detective' },

  /* Endings */
  'ending.confession':  { ja: '— 自白 —',               en: '— Confession —' },
  'ending.toTitle':     { ja: 'タイトルへ戻る',          en: 'Return to Title' },

  /* Common */
  'not.found':          { ja: '見つかりません',           en: 'Not found' },
}
