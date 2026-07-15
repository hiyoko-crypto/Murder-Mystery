# 起訴理由の「エッジ抽出＋判定」の詳細設計

プレイヤーが自由記述で書いた起訴理由（例:「エレナが犯人。コンパクトが換気ダクトで見つかった…」）を、どうやって「勝ち/負け」に変換しているかの内部設計。実装は`modules/reason_edge_extractor.py`（LLM呼び出し）と`modules/indictment_evaluator.py`（呼び出し元・スコアリング）の2ファイルに分かれている。

## 0. 設計の大原則: 「判定」はLLMにやらせない

`reason_edge_extractor.py`冒頭のコメントがこの設計のすべてを言い表している。

> The LLM is used only for natural-language understanding. The final win/loss decision is made later by rule-based proof-graph scoring.

LLMにやらせるのは**自然言語理解（プレイヤーの文章がどのエッジを指しているかのマッピング）だけ**。「このエッジが集まれば勝ちかどうか」は一切LLMに聞かず、Python側の集合演算とif文だけで決める。これは容疑者LLM（`used_edge_ids`の自己申告をそのままゲーム進行に使う）とは対照的な設計判断で、**プレイヤーの起訴が通るか通らないかという最重要な勝敗判定だけは、LLMの気まぐれに委ねない**という一線を引いている。

## 1. 全体の流れ

```
プレイヤーの理由文（自由記述、日本語/英語どちらでも可）
   │
   ▼
① _proof_graph_subgraph()  … proof_graphが参照するエッジ/ノードだけに絞り込む
   │
   ▼
② extract_reason_edges()   … LLM 1回呼び出し（temperature=0.0）
   │                          「理由文 → 言及されたエッジID＋確信度」に変換
   ▼
③ _clean_edge_matches()    … confidence >= 0.6 のものだけ「言及された」と確定
   │
   ▼
④ _evaluate_groups()       … proof_graphのグループごとに、必要数を満たすか判定（Python）
   │
   ▼
⑤ 勝敗判定                  … 必須グループ全合格 かつ 合計スコア >= minimum_score
```

`evaluate_indictment(accused_node_id, reason_text, loader)`（`indictment_evaluator.py`）がこの全体を束ねるエントリーポイント。`game_session.py`の`indict()`から1回だけ呼ばれる。

## 2. ①スコープ限定 — なぜ全138エッジを渡さないか

```python
def _proof_graph_subgraph(groups, nodes, edges):
    proof_edge_ids = {edge_id for group in groups for edge_id in group.get("edge_ids", [])}
    scoped_edges = {eid: edges[eid] for eid in proof_edge_ids if eid in edges}
    node_ids = {edge["from"] for edge in scoped_edges.values()} | {edge["to"] for edge in scoped_edges.values()}
    scoped_nodes = {nid: nodes[nid] for nid in node_ids if nid in nodes}
    return scoped_nodes, scoped_edges
```

`solution.proof_graph.groups[*].edge_ids`に列挙されている**証拠エッジ集合の和集合**だけを取り出す。`the_final_act.json`の場合、138本中この対象になるのは19本（5グループの`edge_ids`の和）。

理由はコメントの通り: 「抽出LLMが認識する必要があるのはこのエッジ集合だけなので、シナリオ全体にコンテキストを使う理由がない」。容疑者LLMの`known_by`フィルタとは軸が違う（誰が知っているかではなく、採点対象かどうか）が、**「関係ない情報でコンテキストを埋めない」という同じ思想**の別実装。`NUM_CTX=4096`という限られたコンテキスト長の中で、19本のエッジ＋その両端ノードだけに絞ることで、LLMが無関係な117本のエッジに気を取られて誤マッピングする確率も同時に減らしている。

## 3. ②LLM呼び出し — プロンプトの構造

`_PROMPT`テンプレートは4セクションで構成される。

1. **タスク定義**: 「理由文を原子的な事実クレームに分解し、各クレームをKGエッジにマッピングせよ。勝敗は判定するな。事件を解くな。」
2. **リレーションガイド**: `FOUND_IN`/`OWNS`/`CONNECTS_TO`/`WAS_IN`・`PARTICIPATED_IN`・`OCCURRED_AT`/`CANNOT_ACCESS`など、主要なrelの意味を自然言語で明示（LLMがrel名の字面だけでなく意味で判断できるように）
3. **確信度スケール**: 0.90-1.00（明示的or非常に近い言い換え）／0.70-0.89（明確な含意）／0.50-0.69（もっともらしいが曖昧）／0.50未満（弱い推測、デバッグ用に含めてもよい）
4. **出力スキーマ + 実データ**: `[Knowledge graph edges]`（スコープ済みエッジをトリプル表記で列挙）、`[Knowledge graph nodes and aliases]`（両端ノードの英語名・日本語表示名・description・significance）、`[Player explanation]`（生テキスト）

`_node_text()`が日本語表示名（`display_names_ja`）をノードごとに併記するため、プレイヤーが日本語で書いても、英語で構築されたグラフのエッジに正しくマッピングできる——「プレイヤーの言語」と「グラフの記述言語」が違うことを前提にした設計。

### なぜ`claims`という中間表現を出力させるのか

出力JSONは`mentioned_edges`だけでなく`claims`（原子的クレーム＋該当する引用フレーズ）も含む。これは最終判定には使われない（`indictment_evaluator.py`は`mentioned_edge_ids`しか見ない）が、2つの目的がある。

- **監査可能性**: なぜこのエッジがマッチしたと判断されたのかを、`claims`→`matched_claim`→`edge_id`の対応でトレースできる（デバッグ・シナリオ調整時に有用）。
- **抽出精度の向上**: 分解してから照合させる（Chain-of-Thought的な中間ステップ）ことで、いきなり「このエッジを使ったか？」とYes/Noで聞くより誤マッピングが減ることが期待される、一般的なプロンプト設計上の工夫。

## 4. ③確信度フィルタ — なぜ2段階（全件保持 → 閾値でフィルタ）にするか

```python
def _clean_edge_matches(matches, known_edge_ids, threshold):
    ...
    cleaned_matches.append(cleaned)          # 全件（confidence問わず）を監査用に保持
    if confidence >= threshold and edge_id not in edge_ids:
        edge_ids.append(edge_id)             # 閾値以上だけを判定用に確定
    return edge_ids, cleaned_matches
```

`CONFIDENCE_THRESHOLD = 0.6`。返り値の`mentioned_edges`（全件、confidenceも含む）と`mentioned_edge_ids`（閾値通過分だけのIDリスト）を両方保持しておくことで、UIやログには「弱い推測も含めた全体像」を出しつつ、勝敗スコアリングには「一定以上確からしいものだけ」を使う、という分離ができている。

また`_clean_edge_matches`は`edge_id`が`known_edge_ids`（スコープ済みエッジのIDセット）に存在するかも検証しており、LLMが存在しないエッジIDを幻視した場合はそのエントリごと無視される（グラフに存在しないIDでスコアが不正に加算されることはない）。

### 後方互換の吸収層（`_legacy_matches`）

```python
mentioned_matches = parsed.get("mentioned_edges")
if mentioned_matches is None:
    mentioned_matches = _legacy_matches(parsed.get("mentioned_edge_ids", []), known_edge_ids)
```

もしLLMが（プロンプトを無視して）`confidence`なしの旧形式`{"mentioned_edge_ids": ["e6", "e13"]}`だけを返してきても、`_legacy_matches()`が全件`confidence: 1.0`として救済し、閾値フィルタを素通りさせる。フォーマット逸脱に対する寛容さを、閾値ロジックを迂回させずに確保している。

## 5. JSON不正時のリトライループ

```python
for attempt in range(MAX_RETRIES):          # MAX_RETRIES = 3
    raw = llm(prompt, temperature=0.0)
    parsed, error = _parse_response(raw)
    if error is None:
        return {...}
    prompt = f"{base_prompt}\n\n[Previous output was invalid: {error}. Return valid JSON only, matching the exact shape above.]"
```

`_parse_response()`は`{`〜`}`の最初と最後を抜き出してから`json.loads`する寛容なパーサ（前後に説明文が付いても救済できる）。それでも失敗したら、**直前のエラー内容をプロンプトに追記して再送**する自己修復ループ。3回すべて失敗した場合のみ、`mentioned_edge_ids: []`（空）で返す——つまり**パース失敗は「勝てない」方向にフェイルセーフする**（誤ってエッジが言及されたことにして勝たせる、という誤判定側には倒れない）。

`temperature=0.0`は容疑者LLM（`temperature=0.7`、キャラクター性のゆらぎが欲しい）とは対照的。ここでは「同じ入力なら同じ抽出結果になってほしい」という決定性が優先される。

## 6. ④`proof_graph`によるグループ採点 — 完全ルールベース

`solution.proof_graph`は次の構造を持つ（`the_final_act.json`の実データ）。

```
minimum_score: 5
groups:
  compact_link          weight 4  required=True   min_required 2   edges [e6, e13, e55]
  vent_route            weight 2  required=False  min_required 2   edges [e7, e8, e42]
  locked_room           weight 1  required=False  min_required 1   edges [e5, e37, e41]
  julian_presence_clears weight 1 required=False  min_required 1   edges [e112, e111, e115, e116, e120]
  leo_cleared           weight 1  required=False  min_required 1   edges [e124, e134, e123, e126, e130]
```

各グループは「3本中2本など、`min_required`本以上言及すれば、そのグループは合格」という**OR的な冗長性**を持つ。例えば`compact_link`は「コンパクトが換気ダクトで見つかった（e6）」「コンパクトはエレナの所有物（e13）」「コンパクトにE.R.の刻印がある（e55）」のうち2本さえ言及すれば、3本目に触れなくても合格になる——プレイヤーの説明の言い回し次第でエッジの引用漏れが起きても、まるごと不合格にはしない冗長設計（容疑者LLM側の「イベントノードを2エッジで表現する」冗長性と同じ思想）。

```python
for group in groups:
    matched = edge_ids & mentioned_edge_ids
    passed_group = len(matched) >= min_required
    if passed_group:
        score += weight
```

`compact_link`は`required: true`——これが不合格だと、他のグループがどれだけ揃っていても`reason_accepted`は`False`になる（下記）。つまり**「コンパクトとエレナを結びつける証拠に触れていない起訴理由は、原理的に勝てない」**というシナリオ作成者の意図が、このフラグ1つに埋め込まれている。他の4グループはすべて`required: false`で、スコアには寄与するが必須ではない「加点要素」。

## 7. ⑤最終判定ロジック

```python
accused_correct     = accused_node_id == solution["killer_node"]
failed_required     = [g for g in failed_groups if g["required"]]
reason_accepted     = not failed_required and score >= minimum_score
won                 = accused_correct and reason_accepted
```

- `accused_correct`: 起訴した容疑者IDが`solution.killer_node`（`n_elena`）と一致するか。これは推論抽出LLMの結果と無関係——容疑者選択そのものはUIの選択操作であり、テキスト解析の対象ではない。
- `reason_accepted`: 必須グループを**すべて**満たし、かつ加重スコアが`minimum_score`（5点）以上。
- `won`: 両方満たして初めて真になる。**「正しい犯人を当てたが理由が不十分」**（`accused_correct=True, reason_accepted=False`）と、**「理由は完璧だが容疑者を間違えた」**（`accused_correct=False`）を明確に区別できるようになっており、`game_session.py`の`indict()`はこの2つを別々のメッセージで表示する。

### 実例（実際に検証したケース）

理由文:
> "Elena is the murderer. Her silver compact mirror was found inside the ventilation shaft that connects Marcus's dressing room to her own dressing room, proving she used it to reach him. Marcus's dressing room door was locked from the inside with no sign of forced entry, so the vent was the only way in or out."

抽出結果（confidence >= 0.6のもの）: `e13, e6, e8, e7, e42, e37, e41`

| グループ | 一致 | 合否 | 加点 |
|---|---|---|---|
| compact_link（必須, min 2） | e6, e13（2/3） | ○ | 4 |
| vent_route（min 2） | e7, e8, e42（3/3） | ○ | 2 |
| locked_room（min 1） | e37, e41（2/3） | ○ | 1 |
| julian_presence_clears（min 1） | なし | ✗ | 0 |
| leo_cleared（min 1） | なし | ✗ | 0 |

合計スコア7 ≥ minimum_score 5、必須グループ`compact_link`も合格 → `reason_accepted = True`。`accused_correct = True`（elenaを起訴）なので`won = True`。Julian・Leoの潔白を示すグループには触れていないが、そこは`required: false`なので勝敗には影響しない——**「犯人を指し示す決定的証拠さえ押さえていれば、他の容疑者の無実を逐一証明しなくても勝てる」**という、この採点設計のもう1つの意図。

## 8. 使われていない周辺データ: `key_evidence_edges` / `red_herring_edges`

`solution`直下には`proof_graph`と並んで以下のフィールドがあるが、**`indictment_evaluator.py`はどちらも一切読んでいない**（コード内grep済み）。

```json
"key_evidence_edges": ["e12", "e13", "e82", "e85", "e89"],
"red_herring_edges": ["e15", "e11"]
```

- `key_evidence_edges`はElena自身の`hidden_from_detective`エッジ（本人の自白トレイル）を指しており、プレイヤーが到達できる情報ではないため、そもそも採点対象にはなりえない。シナリオ作成者向けの「本当の真相」の備忘録。
- `red_herring_edges`（`e15`: 破られた手紙はJulianが書いた、`e11`: Leoに動機がある）は、プレイヤーが誤誘導されうる証拠へのポインタ。これらのエッジを起訴理由に含めても**加点も減点もされない**——`proof_graph.groups`のどこにも登場しないため、`_evaluate_groups()`の集合演算上ただ無視されるだけ。**ミスリードに言及しても罰せられない**という、この採点方式が暗黙に持つ性質（false positiveへの言及にペナルティを課す仕組みは現状存在しない）。

## まとめ: なぜこの2段構成（LLM抽出 → ルールベース採点）なのか

| もし全部LLMに判定させたら | 現在の設計 |
|---|---|
| 「勝ち/負け」自体がLLMの気まぐれ・プロンプトの解釈揺れに左右される | 勝敗はPythonのif文と集合演算のみ。同じ`mentioned_edge_ids`なら常に同じ結果 |
| シナリオ作成者が難易度調整するには、プロンプト文言を調整するしかない | `minimum_score`・`weight`・`min_required`・`required`という数値パラメータをJSONで調整するだけで難易度を再設計できる |
| なぜ負けたのかを説明するのが難しい（LLMの自然言語出力頼み） | `passed_groups`/`failed_groups`/`score`/`minimum_score`という構造化データがそのまま説明に使える |

LLMは「プレイヤーの言葉の揺れを吸収してエッジIDに正規化する」という、LLMが得意な自然言語理解だけに責任範囲を限定し、ゲームとして最も公平性が求められる勝敗の確定はグラフ理論的な集合演算に完全に委譲する——これが今の実装が持つ一貫した設計方針。
