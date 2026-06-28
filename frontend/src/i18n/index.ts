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
  'interro.evidence':   { ja: '証拠',                    en: 'Evidence' },
  'interro.unit':       { ja: '件',                      en: '' },
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

  /* ConfrontationPage */
  'confront.label':     { ja: '— 対決 —',               en: '— Confrontation —' },
  'confront.back':      { ja: '← 戻る',                 en: '← Back' },
  'confront.skip':      { ja: 'タップでスキップ',        en: 'Tap to skip' },
  'confront.evidence':  { ja: '証拠を選ぶ',              en: 'Select Evidence' },
  'confront.noevidence':{ ja: '証拠がない',              en: 'No evidence' },
  'confront.used':      { ja: '（提示済み）',            en: '(presented)' },
  'confront.comment':   { ja: 'コメントを追加（省略可）...', en: 'Add a comment (optional)…' },
  'confront.input':     { ja: '発言を入力...',           en: 'Enter statement…' },
  'confront.send':      { ja: '送信',                    en: 'Send' },
  'confront.present':   { ja: 'を突きつける',            en: '— Present' },
  'confront.evidence.fmt': { ja: '【証拠】',             en: '[Evidence] ' },
  'confront.detective': { ja: '探偵：「',                en: 'Detective: "' },

  /* Endings */
  'ending.confession':  { ja: '— 自白 —',               en: '— Confession —' },
  'ending.confessed':   { ja: 'は観念したように俯いた。\n探偵の追及の前に、すべての嘘が崩れ落ちた。',
                          en: 'bowed their head in resignation.\nEvery lie crumbled before the detective\'s relentless pursuit.' },
  'ending.solved':      { ja: '事件は解決した。',        en: 'The case is solved.' },
  'ending.toTitle':     { ja: 'タイトルへ戻る',          en: 'Return to Title' },
  'ending.wrong':       { ja: '— 見当違い —',           en: '— Wrong Accusation —' },
  'ending.innocent':    { ja: 'は無実だった。\n証拠が足りない。もう一度調査しよう。',
                          en: 'is innocent.\nNot enough evidence. Investigate again.' },
  'ending.reaccuse':    { ja: '告発し直す',              en: 'Try Again' },
  'ending.backinv':     { ja: '調査に戻る',              en: 'Back to Investigation' },
  'ending.cutoff':      { ja: '— 会話終了 —',           en: '— Conversation Ended —' },
  'ending.cutoff.text': { ja: 'は口を閉ざした。\n的外れな証拠を出しすぎた。証拠を整理し直そう。',
                          en: 'has gone silent.\nToo many wrong pieces of evidence. Rethink your strategy.' },

  /* AccusationPage */
  'accuse.title':       { ja: '— 犯人を告発せよ —',     en: '— Accuse the Culprit —' },
  'accuse.subtitle':    { ja: '真犯人だと思う人物を選べ',en: 'Select who you believe is the culprit' },

  /* EvidencePage */
  'evidence.title':     { ja: '証拠一覧',                en: 'Evidence' },
  'evidence.empty':     { ja: 'まだ証拠がない',          en: 'No evidence collected yet' },
  'evidence.back':      { ja: '← 戻る',                  en: '← Back' },

  /* Common */
  'back':               { ja: '← 戻る',                  en: '← Back' },
  'not.found':          { ja: '見つかりません',           en: 'Not found' },
}

/* ─── ゲームデータ翻訳 ─── */
export type BiText = Record<Lang, string>

export const locationData: Record<string, { name: BiText; description: BiText }> = {
  garden: {
    name:        { ja: '庭園',        en: 'Garden' },
    description: {
      ja: 'Wemblyの遺体が発見された場所。噴水の近くに血痕が残っている。',
      en: "Where Wembly's body was found. Blood traces remain near the fountain.",
    },
  },
  ballroom: {
    name:        { ja: '舞踏室',      en: 'Ballroom' },
    description: {
      ja: 'パーティーの中心。煌びやかな装飾が並ぶ。多くのゲストがここにいた。',
      en: 'The heart of the party. Glittering decorations fill the room where most guests gathered.',
    },
  },
  study: {
    name:        { ja: '書斎',        en: 'Study' },
    description: {
      ja: '21時頃に物音がしたという書斎。書類が荒らされた形跡がある。',
      en: 'Sounds were heard from here around 9 PM. Papers appear to have been disturbed.',
    },
  },
}

export const itemData: Record<string, { name: BiText; detail: BiText; discoveryText: BiText }> = {
  letter_opener: {
    name:          { ja: '銀のペーパーナイフ',  en: 'Silver Letter Opener' },
    detail:        { ja: 'Reginald Wemblyの銘入りペーパーナイフ。刃に血痕。これが凶器か。',
                     en: "Engraved letter opener belonging to Reginald Wembly. Blood on the blade — is this the murder weapon?" },
    discoveryText: { ja: '噴水の縁に何かが光っている。近づくと血のついた銀のペーパーナイフだ。銘が刻まれている。',
                     en: 'Something glints at the edge of the fountain. A silver letter opener, stained with blood. An inscription is engraved on it.' },
  },
  handkerchief: {
    name:          { ja: '血染めのハンカチ',     en: 'Bloodstained Handkerchief' },
    detail:        { ja: '「L.D.」のイニシャル入り。血痕がある。犯人が拭き取ったものか。',
                     en: 'Monogrammed "L.D." with visible bloodstains. Did the culprit use this to wipe the blade?' },
    discoveryText: { ja: '茂みの陰に白いハンカチが落ちている。血が染み込んでおり、角に「L.D.」のイニシャルが刺繍されている。',
                     en: 'A white handkerchief lies in the shadow of the bushes. Blood has soaked through it, and the corner bears the embroidered initials "L.D."' },
  },
  guest_list: {
    name:          { ja: '招待客リスト',         en: 'Guest List' },
    detail:        { ja: 'Wemblyの直筆による当日の招待客リスト。一名分だけ追記された跡がある。',
                     en: "The night's guest list in Wembly's own hand. One entry appears to have been added later." },
    discoveryText: { ja: '受付テーブルにリストが置いてある。Wemblyの直筆で全員の名前にチェックが入っているが、一か所だけ書き直した跡がある。',
                     en: 'A list sits on the reception table. Every name is checked in Wembly\'s handwriting — but one entry has clearly been rewritten.' },
  },
  torn_note: {
    name:          { ja: '破れたメモ',           en: 'Torn Note' },
    detail:        { ja: '「計画通りに進む」という文字が残る焼け焦げたメモ。事件前に書かれたものと見られる。',
                     en: 'A charred note bearing the words "The plan proceeds as arranged." Written before the murder.' },
    discoveryText: { ja: '暖炉の灰の中に紙切れが残っている。ほぼ燃えているが「計画通りに進む」という文字が読み取れる。',
                     en: 'A scrap of paper remains in the fireplace ash. Nearly destroyed by fire, but the words "The plan proceeds as arranged" can still be read.' },
  },
}

export const suspectData: Record<string, { name: string; bio: BiText }> = {
  lucien: {
    name: 'Lucien DeVille',
    bio:  { ja: 'ビジネスライバル。Wemblyとの取引で大きな損失を被った。',
            en: "Business rival. Suffered heavy losses in dealings with Wembly." },
  },
  sophia: {
    name: 'Sophia Patel',
    bio:  { ja: 'Wemblyの姪。叔父を崇拝していた社交界の花形。',
            en: "Wembly's niece. A socialite who idolised her uncle." },
  },
  max: {
    name: 'Max Wellington',
    bio:  { ja: '著名なジャーナリスト。Wemblyの旧友で内情を知り過ぎていた。',
            en: "Prominent journalist. An old friend of Wembly who knew too much." },
  },
}

export const openingTextData: BiText = {
  ja: `
仮面舞踏会の夜。

富豪実業家 Reginald Wembly が主催する豪華なパーティー。
世界中のエリートが集まるその夜、Wemblyが庭園の噴水近くで
刺殺体となって発見された。

凶器は彼自身のペーパーナイフ。
容疑者は3人——いずれも深い因縁を持つ招待客だ。

あなたは探偵として呼ばれた。
真犯人を突き止めよ。
`,
  en: `
The night of the masquerade ball.

A lavish party hosted by wealthy industrialist Reginald Wembly.
As the world's elite gathered beneath his roof,
Wembly was found stabbed to death near the garden fountain.

The murder weapon: his own letter opener.
Three suspects — each an invited guest with deep ties to the victim.

You have been called as the detective.
Find the truth.
`,
}

export const mockRepliesData: Record<string, Record<string, { text: BiText; emotion: string }[]>> = {
  lucien: {
    replies: [
      { text: { ja: '私はあの夜、ずっとホールにいた。何十人もの目撃者がいる。',
                en: 'I was in the hall the entire evening. Dozens of witnesses will confirm it.' }, emotion: 'neutral' },
      { text: { ja: 'Wemblyとはビジネス上のトラブルがあった。しかし、それは解決済みだ。',
                en: 'There was a business dispute with Wembly, yes. But it was settled.' }, emotion: 'neutral' },
      { text: { ja: '私が庭に近づいたとでも？馬鹿げている。証拠を出してみろ。',
                en: "You think I went near the garden? Ridiculous. Show me your proof." }, emotion: 'angry' },
      { text: { ja: 'あのペーパーナイフは……Wemblyの書斎にいつも置いてあったものだ。',
                en: 'That letter opener... it always stayed in Wembly\'s study.' }, emotion: 'nervous' },
      { text: { ja: '私を疑うのは勝手だが、真犯人を逃すことになるぞ。',
                en: "Suspect me all you like, but you're letting the real culprit escape." }, emotion: 'neutral' },
    ],
  },
  sophia: {
    replies: [
      { text: { ja: '叔父が……信じられない。なぜこんなことに……',
                en: 'Uncle... I still can\'t believe it. Why did this have to happen…' }, emotion: 'sad' },
      { text: { ja: '私はずっとSophiaやAvaと舞踏室にいた。叔父に何かあるなんて思いもしなかった。',
                en: 'I was in the ballroom with the others all night. I never imagined anything was happening to uncle.' }, emotion: 'sad' },
      { text: { ja: 'Lucienのことは信用できなかった。叔父も彼を警戒していたわ。',
                en: "I never trusted Lucien. Uncle was wary of him too." }, emotion: 'nervous' },
      { text: { ja: 'そのハンカチ……見覚えがある気がする。でも誰のものかは……',
                en: 'That handkerchief... it looks familiar. But I can\'t recall whose it is…' }, emotion: 'surprised' },
      { text: { ja: '叔父を殺した人を絶対に許さない。何でも協力する。',
                en: "I will never forgive whoever did this to uncle. I'll help however I can." }, emotion: 'sad' },
    ],
  },
  max: {
    replies: [
      { text: { ja: '私はジャーナリストだ。この事件、必ず真相を暴いてみせる。',
                en: "I'm a journalist. I will expose the truth of this case." }, emotion: 'neutral' },
      { text: { ja: 'Wemblyには多くの敵がいた。ビジネス界では彼を憎む者も少なくない。',
                en: 'Wembly had many enemies. No shortage of people in business who despised him.' }, emotion: 'neutral' },
      { text: { ja: '21時頃、書斎の方から物音がした。私以外にも聞いた者がいるはずだ。',
                en: 'Around 9 PM I heard sounds from the direction of the study. Others must have heard it too.' }, emotion: 'neutral' },
      { text: { ja: 'Lucienは終始落ち着かない様子だった。普段の彼とは明らかに違った。',
                en: 'Lucien seemed agitated throughout the evening. Clearly not himself.' }, emotion: 'neutral' },
      { text: { ja: 'その招待客リスト……当日いたはずの人物が欠けているかもしれない。',
                en: 'That guest list... there may be a name missing that should have been there.' }, emotion: 'surprised' },
    ],
  },
}

export const mockEvidenceRepliesData: Record<string, Record<string, { text: BiText; emotion: string }>> = {
  letter_opener: {
    lucien: { text: { ja: 'そのペーパーナイフは……確かにWemblyのものだ。書斎に置いてあったはずだ。私は触っていない。',
                      en: "That letter opener... yes, it's Wembly's. It should have been in his study. I never touched it." }, emotion: 'nervous' },
    sophia: { text: { ja: '叔父のペーパーナイフだわ。なぜそんなところに……誰が持ち出したの？',
                      en: "Uncle's letter opener. Why was it out there... who took it out?" }, emotion: 'surprised' },
    max:    { text: { ja: '銘入りのペーパーナイフか。Wemblyのコレクションだ。持ち出せた人物は限られる。',
                      en: "An engraved letter opener. Part of Wembly's collection. Only a few people could have taken it." }, emotion: 'neutral' },
  },
  handkerchief: {
    lucien: { text: { ja: 'そのハンカチは知らない。血がついているって？私には関係ない。',
                      en: "I don't know that handkerchief. Blood on it? That has nothing to do with me." }, emotion: 'nervous' },
    sophia: { text: { ja: 'そのイニシャル……「L.D.」？まさか……Lucienの？',
                      en: 'Those initials... "L.D."? Could it be... Lucien\'s?' }, emotion: 'surprised' },
    max:    { text: { ja: 'イニシャルが入っている。「L.D.」——Lucien DeVilleのものじゃないか。',
                      en: 'There are initials on it. "L.D." — isn\'t that Lucien DeVille\'s?' }, emotion: 'neutral' },
  },
  guest_list: {
    lucien: { text: { ja: '招待客リストなど知らん。私はWemblyに招待された正規のゲストだ。',
                      en: "I know nothing of the guest list. I was a properly invited guest." }, emotion: 'neutral' },
    sophia: { text: { ja: '叔父が直筆で書いたリストよ。全員のチェックがしてある。あれ……ここ、書き直した跡がある。',
                      en: "Uncle wrote this himself. Everyone is checked off... wait, there's an erasure here." }, emotion: 'nervous' },
    max:    { text: { ja: 'ちょっと待て。このリスト、本来招待されていないはずの名前がある。誰かが潜り込んだのか？',
                      en: "Hold on. This list has a name that shouldn't have been invited. Did someone sneak in?" }, emotion: 'surprised' },
  },
  torn_note: {
    lucien: { text: { ja: 'そんな紙切れは知らん。でたらめだ！',
                      en: "I know nothing of that note. This is nonsense!" }, emotion: 'angry' },
    sophia: { text: { ja: '「計画通りに進む」……これ、Lucienの筆跡に似ている気がする。',
                      en: '"The plan proceeds as arranged"... this handwriting looks like Lucien\'s.' }, emotion: 'nervous' },
    max:    { text: { ja: '「計画通りに進む」——これは事件前に書かれたものだ。誰かが殺害を計画していた証拠だ。',
                      en: '"The plan proceeds as arranged" — this was written before the murder. Proof that someone planned it.' }, emotion: 'surprised' },
  },
}

export const confrontScriptData: Record<string, {
  opening: BiText
  openingEmotion: string
  denials: { text: BiText; emotion: string }[]
  keyEvidence: Record<string, { text: BiText; emotion: string }>
  confession: BiText
  wrongAccusation: BiText
  cutoff: BiText
}> = {
  lucien: {
    opening:       { ja: '私が犯人だと？馬鹿げている！証拠でもあるのか！',
                     en: "You think I'm the killer? Ridiculous! Show me your proof!" },
    openingEmotion: 'angry',
    denials: [
      { text: { ja: 'それが証拠になるとでも？笑わせるな。',   en: "That's supposed to be evidence? Don't make me laugh." }, emotion: 'angry' },
      { text: { ja: '状況証拠に過ぎない。私の弁護士を呼べ。', en: 'Circumstantial at best. Get my lawyer.' }, emotion: 'angry' },
      { text: { ja: 'こんな茶番、いつまで続けるつもりだ。',   en: 'How long do you intend to keep up this farce?' }, emotion: 'neutral' },
    ],
    keyEvidence: {
      handkerchief: { text: { ja: 'そのハンカチは……っ。それは……落としたものだ。ただそれだけだ！',
                               en: 'That handkerchief... it... I dropped it. That\'s all!' }, emotion: 'nervous' },
      torn_note:    { text: { ja: 'その紙切れをどこで……！燃やしたはずだ！',
                               en: 'Where did you find that...! I burned it!' }, emotion: 'surprised' },
    },
    confession: {
      ja: '……もういい。全部話す。\nWemblyは私の会社を乗っ取ろうとしていた。このままでは全てを失う。\nだからあの夜、庭に呼び出して……ペーパーナイフで……',
      en: '...Fine. I\'ll tell you everything.\nWembly was trying to take over my company. I stood to lose everything.\nSo that night I called him to the garden... and used the letter opener...',
    },
    wrongAccusation: { ja: '', en: '' },
    cutoff: {
      ja: '……もう話すことはない。弁護士以外とは口をきかない。出て行け。',
      en: '...I have nothing more to say. I won\'t speak to anyone but my lawyer. Get out.',
    },
  },
  sophia: {
    opening:       { ja: '私が……叔父を？！あなたは正気ですか！',
                     en: 'Me? Kill my uncle?! Are you out of your mind?!' },
    openingEmotion: 'surprised',
    denials: [
      { text: { ja: '私は叔父を愛していた。絶対に傷つけたりしない！', en: 'I loved my uncle. I would never harm him!' }, emotion: 'angry' },
      { text: { ja: 'ひどい。なぜ私を疑うの……',                       en: 'This is outrageous. Why are you suspecting me…' }, emotion: 'sad' },
      { text: { ja: '証拠もないのに。私はずっと舞踏室にいた。',         en: 'No evidence whatsoever. I was in the ballroom the entire time.' }, emotion: 'sad' },
    ],
    keyEvidence: {},
    confession:      { ja: '', en: '' },
    wrongAccusation: {
      ja: '……もう十分でしょう。私が犯人じゃないことはあなたも分かっているはずよ。\n真犯人を見つけてほしい。叔父のために。',
      en: '...That\'s enough. You know I\'m not the murderer.\nPlease find the real culprit. For uncle\'s sake.',
    },
    cutoff: {
      ja: '……これ以上あなたとは話せない。もう帰ってください。',
      en: "...I can't speak with you any further. Please leave.",
    },
  },
  max: {
    opening:       { ja: '私が犯人？面白い仮説だ。だが間違っている。',
                     en: 'Me? The killer? An interesting theory. But wrong.' },
    openingEmotion: 'neutral',
    denials: [
      { text: { ja: '証拠もなしに著名なジャーナリストを告発するのか？', en: "You're accusing a prominent journalist without evidence?" }, emotion: 'neutral' },
      { text: { ja: '私はWemblyの死を悼んでいる。彼は旧友だった。',     en: 'I mourn Wembly\'s death. He was an old friend.' }, emotion: 'sad' },
      { text: { ja: 'この告発は的外れだ。時間を無駄にしている。',       en: "This accusation is off-base. You're wasting time." }, emotion: 'neutral' },
    ],
    keyEvidence: {},
    confession:      { ja: '', en: '' },
    wrongAccusation: {
      ja: 'もう終わりにしよう。私が犯人でないことは明白だ。\nLucienをもっとよく調べてみろ。',
      en: "Let's end this. It's obvious I'm not the killer.\nTake a closer look at Lucien.",
    },
    cutoff: {
      ja: '……これ以上この茶番に付き合う気はない。名誉毀損で訴えるぞ。',
      en: "...I refuse to continue this farce. I'll sue for defamation.",
    },
  },
}
