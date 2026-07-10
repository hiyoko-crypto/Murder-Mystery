# 調査対象の追加：2つのトリガー

新しい場所・アイテムが「調査可能」になる仕組みは`modules/location_tracker.py`の`LocationTracker`が一元管理している。トリガーは2種類あり、それぞれ性質が全く異なる。

- **① 場所やアイテムの調査（物理的探索）** — プレイヤーの操作だけで進む、あらかじめJSONで決め打ちされた決定的な連鎖
- **② LLMとの対話（証言による発見）** — 容疑者の発言（LLM出力）に依存する動的な連鎖

## ① 場所やアイテムの調査によるトリガー

### 場所を調査 → その場にあるアイテムが見つかる（`examine_location`）

```python
def examine_location(self, location_id: str) -> dict:
    items_here = rules.get("items_present", [])
    for item_id in items_here:
        if item_id not in self.found_items:
            self.found_items.add(item_id)
            newly_found.append(item_id)
    ...
```

`examine_rules.locations[location_id].items_present`に列挙されたアイテムIDを、その場所を調査した瞬間にまとめて発見済みにする。純粋にJSON側の静的なリストを読むだけで、LLMは一切関与しない。

**このリストは知識グラフ（`knowledge_graph.nodes`/`edges`）から動的に導出されているものではない。** `examine_rules`という完全に別セクションに、あらかじめ手動で書かれた固定リストを読んでいるだけ。実際の値（`the_final_act.json`）:

```json
"examine_rules": {
  "locations": {
    "n_dressing_room": {
      "items_present": ["n_candlestick", "n_torn_letter", "n_vent_grate", "n_locked_door"]
    },
    "n_vent_shaft": {
      "items_present": ["n_silver_compact"]
    }
  }
}
```

各アイテムID（例: `n_candlestick`）自体は`knowledge_graph.nodes`にも存在するノードIDと一致しており、`examine_item()`が呼ばれた際にそのノードの`name`/`description`/`significance`プロパティを表示用に参照する（`game_session.py`の`_item_info()`）。ただし「このアイテムがこの場所にある」という対応関係そのものは、知識グラフのエッジ（例えば`e2: Brass Candlestick --[FOUND_IN]--> Marcus's Dressing Room`のような、意味的には同じことを言っているエッジが実際に存在する）を辿って導き出しているのではなく、`examine_rules`側の固定リストが唯一の情報源になっている。つまりグラフ上の`FOUND_IN`エッジと`items_present`リストは、たまたま同じ事実を重複して表現しているだけの、コード上は無関係な2つのデータであり、片方だけ更新すると食い違いが起きうる。

### アイテムを調査 → 新しい場所が開放される（`examine_item`）

```python
def examine_item(self, item_id: str) -> dict:
    unlocks = self.item_rules.get(item_id, {}).get("unlocks_location")
    if unlocks and unlocks not in self.known_locations:
        self.known_locations.add(unlocks)
        newly_unlocked = unlocks
    ...
```

`examine_rules.items[item_id].unlocks_location`に場所IDが書かれていれば、そのアイテムを調査した瞬間に新しい場所が開放される。

**例**: 「換気口の格子」を調査 → `unlocks_location: "n_vent_shaft"` → 「換気ダクト」が新規開放される。

この経路は**完全に決定的**——同じ操作をすれば毎回同じ結果になり、シナリオ作成者が事前に設計した連鎖をなぞるだけ。

## ② LLMとの対話によるトリガー（証言による場所開放）

容疑者への質問に応答するたびに（`game_session.py`の`ask()`内）、`unlock_from_testimony(used_edge_ids, speaker_id)`が呼ばれる。ここでの入力は**容疑者LLMが返したJSON出力の`used_edge_ids`**であり、応答本文の内容そのものではない。

```python
def unlock_from_testimony(self, used_edge_ids: list, speaker_id: str) -> list:
    for eid in used_edge_ids:
        edge = self.loader.edges.get(eid, {})
        node_refs = self._testimony_location_refs(edge, speaker_id)
        for node_ref in node_refs:
            r = self.loc_rules.get(node_ref, {})
            if r.get("unlock_from_testimony") and node_ref not in self.known_locations:
                self.known_locations.add(node_ref)
                newly.append(node_ref)
```

`_testimony_location_refs()`が実際に場所IDを解決する部分で、2パターンのエッジ構造に対応している。

### パターンA: 直接エッジ

```
speaker --[WAS_IN]--> location
```

容疑者本人から場所への直接のエッジがあれば、それがそのまま場所IDになる。

### パターンB: イベント分解エッジ（現在の主な形）

```
speaker --[PARTICIPATED_IN]--> event --[OCCURRED_AT / STARTED_AT / ENDED_AT]--> location
```

「誰が・どのイベントに参加し・そのイベントがどこで起きたか」という2段階の構造。容疑者が発話で使ったエッジがイベント側（`PARTICIPATED_IN`）でも、イベントに紐づく場所側のエッジ（`OCCURRED_AT`等）でも、どちらか一方さえ`used_edge_ids`に含まれていれば逆側も自動的に辿って場所を特定できる（`_speaker_participated_in_event()`で相互に確認している）。

**例（Julianのロビー在室）**:
```
e111: Dr. Julian Wilde --[PARTICIPATED_IN]--> Julian's Lobby Presence
e112: Julian's Lobby Presence --[OCCURRED_AT]--> Theatre Lobby
```
Julianの応答が`used_edge_ids`に`e111`か`e112`のどちらかを含めば、「劇場ロビー」が新規開放される。

この経路は**非決定的**——同じ質問をしても、LLMがその発話の根拠として実際に`used_edge_ids`へそのエッジを含めるかどうかで結果が変わる。

### 信頼性の実測（2026-07-09時点）

`modules/subgraph_to_prompt.py`のプロンプトに以下2点の調整を加えたことで、直接的な質問に対する引用漏れはほぼ解消された。

- 応答の長さを「roughly 100 characters」程度に制限する指示を追加（長い応答ほど、語った事実の一部だけしか引用されない傾向があったため）
- `used_edge_ids`の指示を強化——「本文で述べた事実は全て漏らさず列挙せよ、ここに無いものは言っていないのと同じ扱いになる」と明記

この状態で、時刻を明示した直接的な質問（例:「Where were you between 9:00 PM and 9:30 PM?」）を3容疑者・各5回ずつ試したところ、**15/15で場所への言及と解放が一致**（引用漏れ0件）。

一方、「Where were you when the incident happened?」のような抽象的な質問では、**「言及したのに引用しない」という不具合は0件のまま**だが、そもそも容疑者が解放に繋がらない**別の（間違ってはいない）アリバイを選んで答えてしまう**ケースが残る（例: Julianは「観客席にいた」と「ロビーにいた」の2つの真実のアリバイを持つため、曖昧な聞き方だと前者で答えを終えることがある）。これは引用の技術的な不具合ではなく、質問の具体性に依存する内容選択の問題として切り分けられている。

### 判明した見落とし: シナリオファイルの取り違え

デバッグの過程で、`api.py`（フロントエンド用バックエンド）がシナリオファイルを`sorted(glob.glob("scenarios/*.json"))`で自動検出しており、`scenarios/the_final_act copy.json`（アルファベット順でスペースがピリオドより先に来るため、意図せず`the_final_act.json`より先にマッチする）という**別バージョンの古いコピーファイル**を読み込んでしまっていたことが判明した。CLIおよび直接のPythonテストは常に正しい`the_final_act.json`を明示的に読み込んでいたため、フロントエンド経由でのみ場所解放が失敗するように見えた本当の原因はこれだった。

## まとめ表

| | ① 物理的探索 | ② 証言による発見 |
|---|---|---|
| トリガー | `examine_location` / `examine_item` | 容疑者への質問応答（`ask()`） |
| 判定材料 | JSON側の静的な対応表（`items_present` / `unlocks_location`） | LLM出力の`used_edge_ids` |
| 性質 | 決定的（毎回同じ結果） | 非決定的（LLMの引用漏れに依存） |
| KG上の対応構造 | なし（examine_rules側だけの独立設定） | 直接エッジ `WAS_IN`、またはイベント分解 `PARTICIPATED_IN`→`OCCURRED_AT` |
| 実装 | `LocationTracker.examine_location` / `examine_item` | `LocationTracker.unlock_from_testimony` / `_testimony_location_refs` |

2つの経路が存在する理由は、ミステリーにおける「発見」が本質的に2種類あるため——モノを介した決め打ちの物理的な連鎖と、言葉から浮かび上がる動的な発見。後者はLLMの出力に依存するぶん、仕組みとしては複雑かつ脆さも持っている。
