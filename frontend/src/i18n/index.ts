export type Lang = 'ja' | 'en'

/* ─── UI文字列 ─── */
export const ui: Record<string, Record<Lang, string>> = {
  /* TitlePage */
  'title.subtitle':     { ja: '— 推理ゲーム —',       en: '— Mystery Game —' },
  'title.start':        { ja: 'ゲームスタート',          en: 'Start Game' },

  /* OpeningPage */
  'opening.next':       { ja: '捜査を始める →',         en: 'Begin Investigation →' },

  /* MapPage */
  'map.title':          { ja: '— 場所を選べ —',         en: '— Choose a Location —' },
  'map.evidence':       { ja: '証拠カード',              en: 'Evidence' },
  'map.evidenceUnit':   { ja: '件',                      en: '' },
  'map.viewEvidence':   { ja: '証拠を確認',              en: 'View Evidence' },
  'map.accuse':         { ja: '⚖️ 犯人を告発する',      en: '⚖️ Accuse the Culprit' },

  /* LocationPage */
  'loc.back.map':       { ja: '← マップ',               en: '← Map' },
  'loc.back':           { ja: '← 戻る',                 en: '← Back' },
  'loc.examine':        { ja: '調べる',                  en: 'Examine' },
  'loc.examine.hint':   { ja: '何かあるかも',            en: 'Something might be here' },
  'loc.found.hint':     { ja: '件 発見済み',             en: 'found' },
  'loc.talk':           { ja: '話す',                    en: 'Talk' },
  'loc.nobody':         { ja: '誰もいない',              en: 'Nobody here' },
  'loc.people':         { ja: '人いる',                  en: 'person(s) here' },
  'loc.examine.title':  { ja: 'を調べる',                en: 'Examining' },
  'loc.examine.start':  { ja: '部屋を見回す……',         en: 'Looking around the room…' },
  'loc.examine.done0':  { ja: 'ここには何もないようだ。', en: 'Nothing to find here.' },
  'loc.examine.doneN':  { ja: 'もう見落としはないようだ。', en: 'Nothing left to find.' },
  'loc.item.detail':    { ja: 'を詳しく調べる →',        en: '→ Examine closely' },
  'loc.examine.btn':    { ja: '🔍 調べる',               en: '🔍 Examine' },
  'loc.talk.title':     { ja: '— 話す —',               en: '— Talk —' },

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
  'ending.confessed':   { ja: 'は観念したように俯いた。\n探偵の追及の前に、すべての嘘が崩れ落ちた。',
                          en: 'bowed their head in resignation.\nEvery lie crumbled before the detective\'s relentless pursuit.' },
  'ending.solved':      { ja: '事件は解決した。',        en: 'The case is solved.' },
  'ending.toTitle':     { ja: 'タイトルへ戻る',          en: 'Return to Title' },
  'ending.cutoff':      { ja: '— 会話終了 —',           en: '— Conversation Ended —' },
  'ending.cutoff.text': { ja: 'は口を閉ざした。\n的外れな証拠を出しすぎた。証拠を整理し直そう。',
                          en: 'has gone silent.\nToo many wrong pieces of evidence. Rethink your strategy.' },

  /* EvidencePage */
  'evidence.title':     { ja: '証拠一覧',                en: 'Evidence' },
  'evidence.empty':     { ja: 'まだ証拠がない',          en: 'No evidence collected yet' },
  'evidence.back':      { ja: '← 戻る',                  en: '← Back' },

  /* Common */
  'back':               { ja: '← 戻る',                  en: '← Back' },
  'not.found':          { ja: '見つかりません',           en: 'Not found' },
}
