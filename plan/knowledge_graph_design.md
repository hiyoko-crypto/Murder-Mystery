# 知識グラフの設計意図（`the_final_act.json`）

現在の`the_final_act.json`は、ノード77個・エッジ138個からなる1つの知識グラフを、**3つの異なる消費者**が同じデータソースとして参照する構造になっている。

1. **容疑者LLM** — 各容疑者は自分が「知っている」部分グラフだけを見せられ、それを演じる（`modules/subgraph_to_prompt.py`）
2. **指摘（起訴）の推論検証LLM** — プレイヤーの自由記述の推理文を、証拠として使われたエッジ集合にマッピングし、ルールベースで採点する（`modules/reason_edge_extractor.py` / `modules/indictment_evaluator.py`）
3. **ゲームメカニクス** — 場所・アイテムの発見/開放判定（`modules/location_tracker.py`）

この3つが同じグラフの異なる切り口を読むことで、「容疑者の発言」「プレイヤーの推理」「ゲーム上の探索進行」の3つが常に同じ事実の集合に対して整合するようになっている。これが今日までの一連の変更（イベントノードの導入、`examine_rules`の統合など）に共通する設計意図。

## 1. ノードの設計

### 1.1 キャラクター系: `Character` + `Suspect` / `Witness` / `Victim`

```json
"n_elena": {
  "labels": ["Character", "Suspect"],
  "properties": {
    "name": "Elena Rostova",
    "role": "suspect",
    "guilty": true,
    "bio": "...",
    "tags": ["composed", "calculating", "deflects with charm", ...],
    "victim_connection": "...",
    "motive": "...",
    "interrogation_style": "Calm and composed. ... Never acknowledge entering the shaft or striking Marcus."
  }
}
```

- `guilty`はゲームロジック（正誤判定）用。プレイヤーへの説明文には出さない。
- `bio` / `tags` / `interrogation_style`は容疑者LLMのシステムプロンプトに直接差し込まれる、キャラクター演技のための固定プロファイル（`subgraph_to_prompt.py`の`build_system_prompt()`冒頭）。
- `interrogation_style`は「何を隠すか」を明示する唯一の場所。真犯人であるElenaだけがここで具体的な隠蔽対象（換気ダクト・燭台・コンパクトミラー）を名指しされている。
- `Witness`（`n_barton`、`n_finch`、`n_tommy`など）は容疑者ではなく、証言や目撃の対象としてだけグラフに登場する軽量ノード（`name`のみ）。

### 1.2 場所ノード: `Location`（+ `CrimeScene` / `EscapeRoute`）

```json
"n_dressing_room": {
  "labels": ["Location", "CrimeScene"],
  "properties": {
    "name": "Marcus's Dressing Room",
    "description": "...(LLM向けの詳細説明)...",
    "room_description": "...(プレイヤー向けの調査時表示テキスト)...",
    "initially_available": true,
    "unlock_from_testimony": false
  }
}
```

- `description`と`room_description`は役割が違う。`description`はLLMの文脈用（推論抽出プロンプトの`_node_text()`で使われる）、`room_description`は`examine_location()`がプレイヤーに返す表示文。
- `initially_available` / `unlock_from_testimony`は**純粋にゲームメカニクス用のフラグ**であり、LLMのプロンプトには一切含まれない（`LocationTracker`だけが読む）。これは今回の変更で`examine_rules`から場所ノード自身の`properties`に移設したもの。詳細は§4参照。
- `CrimeScene` / `EscapeRoute`ラベルは現状コード上では未参照（将来の分岐用の意味タグとして残っている）。

### 1.3 アイテム/証拠ノード: `Item` / `Evidence` / `MurderWeapon`

```json
"n_candlestick": {
  "labels": ["Item", "Evidence", "MurderWeapon"],
  "properties": {
    "name": "Brass Candlestick",
    "description": "...",
    "significance": "..."
  }
}
```

- `description`はプレイヤーが調査した際に見るテキスト、`significance`は「なぜこれが手がかりなのか」という追加の考察テキスト（`ItemDetail.significance`）。
- どこにあるかは**ノードのプロパティではなくエッジ**（`FOUND_IN`）で表現される。「アイテムがどこにあるか」を事実グラフの外に置かない、という一貫した方針。

### 1.4 イベントノード（`Event` + サブタイプ）— 最も設計意図が濃い部分

`Event`ラベルを持つノードが13種類・19個ある（`CrimeEvent`, `DiscoveryEvent`, `PerformanceEvent`, `VisitEvent`, `MovementEvent`, `EvidenceEvent`, `DocumentEvent`, `ObservationEvent`, `PresenceEvent`, `TerminationEvent`, `AccessEvent`, `TamperingEvent`など）。

```json
"ev_julian_lobby_presence": {
  "labels": ["Event", "PresenceEvent"],
  "properties": { "name": "Julian's Lobby Presence", "start_time": "9:00 PM", "end_time": "9:30 PM" }
}
```

なぜ「誰が・どこで・いつ」を1本の直接エッジ（例: `WAS_IN`）で書かず、わざわざイベントノードを介して表現するのか。理由は3つ。

**(a) 多項関係の表現** — 「誰が」「どこで」「いつ」「何をしたか」「誰が目撃したか」は本来すべて1つの出来事に紐づく多項関係だが、グラフのエッジは二項関係(from→to)しか表現できない。イベントノードを1つ挟むことで、それぞれを別々のエッジとして自然に表現できる。

```
e111: n_julian --[PARTICIPATED_IN]--> ev_julian_lobby_presence   (time: 9:00-9:30 PM)
e112: ev_julian_lobby_presence --[OCCURRED_AT]--> n_lobby
e115: n_barton --[WITNESSED]--> ev_julian_lobby_presence
e116: n_finch  --[WITNESSED]--> ev_julian_lobby_presence
e120: n_julian --[DID_NOT_LEAVE]--> n_lobby                       (time: 9:00-9:30 PM)
```

**(b) 出来事同士の順序関係が書ける** — `AFTER` / `OCCURRED_BEFORE`のようなエッジで、出来事と出来事の前後関係を表現できる。これは単純な「誰が・どこで」の直接エッジでは書けない。

```
e82: n_elena --[PERPETRATED]--> ev_murder
e83: ev_murder --[AFTER]--> ev_elena_vent_entry
e87: ev_elena_vent_return --[AFTER]--> ev_murder
```

Elenaの犯行の物語（換気ダクトに侵入 → 殺害 → 換気ダクトに戻る → コンパクトを落とす）は、`ev_elena_vent_entry` → `ev_murder` → `ev_elena_vent_return` → `ev_elena_compact_drop`という4つのイベントノードの連鎖として、時系列込みで表現されている。

**(c) 「引用漏れ」に対する冗長性** — これがゲームメカニクス上、実務的に一番重要な理由。容疑者LLMは`used_edge_ids`で「発言の根拠にしたエッジ」を自己申告するが、これは`PARTICIPATED_IN`側と`OCCURRED_AT`側のどちらか一方だけを引用しても成立する設計になっている（`location_tracker.py`の`_testimony_location_refs()` / `_speaker_participated_in_event()`が両方向をチェック）。つまり同じ1つの事実（「Julianはロビーにいた」）に対して**2つの引用可能なエッジID（e111, e112）**が用意されていることになり、LLMがどちらか片方さえ引用すれば「証言による場所開放」が成立する。1本の`WAS_IN`エッジだけだった場合に比べ、引用漏れによる開放失敗の確率を実質的に半減させる、という意味も持つ。

### 1.5 「事実ノード」の細粒度な具象化（Object / Place / Condition / Topic / Crime / Document / Payment / Value / Inscription / InferredAction / WitnessGroup / TimePeriod）

イベント以外にも、`n_forced_entry`（Condition）、`n_screwdriver_marks`のような「痕跡」、`n_debt_contracts`（Document/MotiveObject）、`n_cash_payments`（Payment）、`n_age_old`（Value）、`n_initials_er`（Inscription）、`n_recent_crawl_action`（InferredAction）のような、一見「ノードにするまでもない」ような細かな事実までもがノードとして具象化されている。

これは推論検証LLM（`reason_edge_extractor.py`）が「プレイヤーの推理文の中のどのフレーズが、グラフのどの事実に対応するか」を判定するための設計。例えば——

```
e41: n_locked_door --[HAD_NO_SIGN_OF]--> n_forced_entry
e49: n_vent_grate  --[HAD_MARKS]-------> n_screwdriver_marks
e50: n_screwdriver_marks --[HAD_AGE]---> n_age_old
```

——のように事実を細かく分解しておくことで、プレイヤーが「ドアには外からこじ開けた形跡がなかった」「ネジ痕は古いものだった＝計画的犯行」のように、証拠の意味合いを噛み砕いて説明しても、対応するエッジが個別に存在するため引用漏れなく拾える。逆にこれを1本の巨大な`description`文字列にまとめてしまうと、推論検証LLMが「プレイヤーがどの部分に言及したか」を判定しづらくなる。**細粒度化はプレイヤーの自由記述を許容するためのコスト**であり、直接ゲームプレイに使われるわけではない（`FOUND_IN`と`REVEALS`以外のほとんどのrel типеは`location_tracker.py`からは一切参照されない）。

## 2. エッジのプロパティ設計

ほとんどのエッジ（138本中137本）が共通して持つプロパティは以下の4つ。

| プロパティ | 役割 | 参照している場所 |
|---|---|---|
| `known_by` | 誰がこの事実を知っているか（`"all"` / ノードIDのリスト / `[]`） | `scenario_loader.py`の`_edge_known_by()` — 容疑者ごとの部分グラフ抽出のゲート |
| `hidden_from_detective` | 知ってはいるが検事に話してはいけない事実か | `subgraph_to_prompt.py`が「話してよい事実」と「隠すべき事実」を分けて提示する材料 |
| `provenance` | 知識の性質（下記参照） | プロンプト上のグルーピング（`_group_visible_edges()`）と、推論抽出プロンプトの手がかり |
| `time` | 時刻・時間帯 | プロンプト表示、`_testimony_location_refs()`は現状timeそのものは見ないが、将来のアリバイ時刻突合用に保持 |

### 2.1 `known_by` — 誰の部分グラフに含まれるか

- `"all"`: 全容疑者が知っている公然の事実（例: `e1 FOUND_DEAD_IN`＝遺体発見の事実）。
- `["n_elena"]`のようなノードIDのリスト: そのノードだけの部分グラフに含まれる、個人的な知識。
- `[]`（空リスト）: **どの容疑者の部分グラフにも含まれない**。誰も自分から話さない、純粋な物的証拠・客観的事実。プレイヤーが自分で調査して見つけるか、推理文の中でのみ言及しうる（`e3 FOUND_IN`、`e41 HAD_NO_SIGN_OF`など）。

`known_by: []`のエッジ群が、実質的に「容疑者への尋問では絶対に出てこないが、現場調査と論理的推理だけで到達できる手がかり」の層を形成している。これはミステリーとして「聞けば分かる」だけでなく「調べて・考えて分かる」の両方を成立させるための意図的な切り分け。

### 2.2 `hidden_from_detective` — 真犯人の自白トレイル

15本のエッジがこのフラグを持ち、そのすべてがElena（真犯人）の`known_by`エッジ。

```
e12: n_elena --[STRUCK]--> n_marcus                         (自分が殴った)
e78-e91: 換気ダクト侵入→殺害→ダクトに戻る→コンパクト落下 の一連のイベント連鎖
```

Elenaは「これらの事実を知っている」が「検事に話してはいけない」という、システムプロンプト上の別セクション（`[Facts you know but must NOT reveal]`）に隔離される。ここが漏れる（LLMが誤ってこれらのエッジを`used_edge_ids`に含めて話してしまう）と、以前検証した「隠蔽エッジの意図しない開示」の再試行ロジックが動く対象になる（`plan/llm_io_reference.html`参照）。

### 2.3 `provenance` — 知識の出どころによる話し方の違い

| 値 | 意味 | プロンプト上の扱い |
|---|---|---|
| `self_knowledge` | 自分自身の行動・体験 | 「自分の知識として語ってよい」 |
| `direct_observation` | 自分が直接見聞きした | 同上（personalグループ） |
| `public_report` | 公になっている報告（遺体発見など） | 「言及してよいが自分の体験として話すな」 |
| `public_hearsay` | 巷の噂・伝聞 | 同上（publicグループ） |
| `discoverable_evidence` | 現場調査でのみ判明する客観的事実 | 通常`known_by: []`とセットで、そもそもどの容疑者の部分グラフにも登場しない |

この5分類は「容疑者は自分の直接体験を語るべきで、客観的な物的証拠の存在まで先回りして喋ってはいけない」という、ミステリーのフェアプレイ原則をプロンプトレベルで強制するための設計。

### 2.4 `player_discovery` — 物理探索メタデータ（41本のみ）

```json
"e3": { "from": "n_torn_letter", "rel": "FOUND_IN", "to": "n_dressing_room",
        "properties": { "known_by": [], "provenance": "discoverable_evidence",
                         "player_discovery": { "method": "examine_location", "target": "n_dressing_room" } } }
```

`known_by: []`かつ`discoverable_evidence`のエッジのうち、実際にゲーム内で「調査という行動によって明らかになる」ものには`player_discovery`メタデータが付いている。`method`は`examine_location` / `examine_item`のどちらで判明するか、`target`はそのために調査すべきノードID。

**ただし現状、`location_tracker.py`はこの`player_discovery`プロパティを一切読んでいない。** 実際のアイテム発見判定は`FOUND_IN`エッジの`from`/`to`だけを見ており（§4）、`player_discovery`はまだ「ドキュメンテーション目的の注釈」に留まっている。将来的に「どの調査行動でどの事実が判明するか」をこのメタデータから完全に自動導出する余地はあるが、現状は`FOUND_IN`/`REVEALS`という専用relのほうが実装をシンプルに保っている。

## 3. 3つの消費者と、それぞれが見るグラフの切り口

同じ138本のエッジ集合を、3つのモジュールがまったく違うフィルタで読む。

### (1) 容疑者LLM — `known_by`でフィルタされた個人視点

`ScenarioLoader.get_subgraph(node_id)`が、`known_by`にそのnode_idを含む（または`"all"`の）エッジだけを集めて`visible_edges`/`hidden_edges`に分け、`subgraph_to_prompt.py`がキャラクター性（bio/tags/interrogation_style）と組み合わせてシステムプロンプトを作る。**時間軸や因果関係を跨いだグラフ全体は見せず、その容疑者が知りうる範囲だけ**を見せる。

### (2) 起訴推論の検証LLM — `known_by`を無視した「証拠プール」全体

`indictment_evaluator.py`は`known_by`を一切見ない。代わりに`solution.proof_graph.groups`という**別途手動定義された証拠グループ**（例: `compact_link`グループ＝`e6, e13, e55`）に含まれるエッジだけを`_proof_graph_subgraph()`で切り出し、プレイヤーの推理文がそのエッジに言及しているかを`reason_edge_extractor.py`で判定する。ここでは`known_by: []`の客観的証拠エッジも、Elena個人の`hidden_from_detective`エッジも、区別なく「プレイヤーが言及できる事実」として扱われる——プレイヤーは容疑者が話さなかった物的証拠に、自分の調査と推理だけで到達してよいので当然の設計。

`minimum_score`（現在5点）以上のスコアかつ必須グループ（`required: true`）をすべて満たして初めて、指摘の理由が受理される。

### (3) ゲームメカニクス — relの種類そのものが意味を持つ層

`LocationTracker`は`known_by`も`provenance`も見ない。専ら**特定のrel名**（`FOUND_IN`, `REVEALS`, `WAS_IN`, `PARTICIPATED_IN`, `OCCURRED_AT`/`STARTED_AT`/`ENDED_AT`, `CLAIMED_PARTICIPATION_IN`）だけを見て、発見・開放判定を行う。ここだけは「事実として正しいかどうか」ではなく「ゲーム上どんな行動が発生したか」を判定する層であり、他の2つの消費者とは性質が異なる。

## 4. 今回の変更: `examine_rules`の統合

これまで`examine_rules`という、知識グラフとは無関係な別セクションに、以下の情報が重複して手書きされていた。

- `locations[id].items_present` → 既に`FOUND_IN`エッジと1対1で重複していた（未使用の死んだデータだった）
- `locations[id].initially_available` / `unlock_from_testimony` / `description` → グラフに対応物がなかった
- `items[id].unlocks_location` → グラフに対応物がなかった

今回の変更で:

1. `initially_available` / `unlock_from_testimony`をLocationノード自身の`properties`に移設。`room_description`として説明文も同様に移設（既存のLLM向け`description`とは別プロパティとして共存）。
2. アイテム調査による場所解放（唯一の対応エッジがなかったケース）に、新規エッジ`e138: n_vent_grate --[REVEALS]--> n_vent_shaft`を追加。
3. `examine_rules`セクション自体を削除。

`e138`は他の137本と違い、**`known_by`も`provenance`も持たない**（`{"properties": {}}`のみ）。これは意図的な区別で、この1本は「容疑者が語りうる事実」でも「プレイヤーが推理文で言及しうる証拠」でもなく、純粋にゲームの解放ロジック専用のエッジだから。もし将来ここに`known_by`/`provenance`を付けてしまうと、容疑者のプロンプトや推論検証の証拠プールに意図せず混入してしまう。**「事実グラフ」と「ゲームメカニクス・エッジ」を同じグラフの中に共存させつつ、プロパティの有無で層を分離する**、という設計判断がここに表れている。

## まとめ

| レイヤー | 何を見るか | 実装 |
|---|---|---|
| 容疑者の人格・話し方 | ノードの`bio`/`tags`/`interrogation_style` | `subgraph_to_prompt.py` |
| 容疑者が話してよい事実 | `known_by`でフィルタしたエッジ、`provenance`でグルーピング | `ScenarioLoader.get_subgraph()` |
| 容疑者が隠す事実 | `hidden_from_detective: true`のエッジ | 同上 |
| 出来事の多項関係・時系列 | `Event`ノード + `PARTICIPATED_IN`/`OCCURRED_AT`/`AFTER`等 | グラフ構造そのもの |
| 証言による場所解放 | `used_edge_ids`→`PARTICIPATED_IN`/`OCCURRED_AT`いずれか | `LocationTracker.unlock_from_testimony()` |
| 物理探索による発見・解放 | `FOUND_IN` / `REVEALS`エッジ + `initially_available` | `LocationTracker.examine_location()`/`examine_item()` |
| 起訴理由の妥当性判定 | `solution.proof_graph.groups`が指す任意のエッジ集合（`known_by`無視） | `indictment_evaluator.py` |

1つのグラフの中に「誰が知っているか」「隠すべきか」「出来事としての構造」「ゲーム進行としての意味」という複数の異なる軸が同居しており、それぞれの軸を見るモジュールが自分の関心のあるプロパティ/rel名だけを読み分けることで、1つの事実の集合から3つの異なる振る舞い（演技・推理・進行）を矛盾なく導出している。
