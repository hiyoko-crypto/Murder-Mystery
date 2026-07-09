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

この経路は**非決定的**——同じ質問をしても、LLMがその発話の根拠として実際に`used_edge_ids`へそのエッジを含めるかどうかで結果が変わる。実際のテストでは、応答本文が場所について語っていても`used_edge_ids`への引用が漏れて場所が開放されないケースが確認されている（`plan/open_issues.md`参照）。

## まとめ表

| | ① 物理的探索 | ② 証言による発見 |
|---|---|---|
| トリガー | `examine_location` / `examine_item` | 容疑者への質問応答（`ask()`） |
| 判定材料 | JSON側の静的な対応表（`items_present` / `unlocks_location`） | LLM出力の`used_edge_ids` |
| 性質 | 決定的（毎回同じ結果） | 非決定的（LLMの引用漏れに依存） |
| KG上の対応構造 | なし（examine_rules側だけの独立設定） | 直接エッジ `WAS_IN`、またはイベント分解 `PARTICIPATED_IN`→`OCCURRED_AT` |
| 実装 | `LocationTracker.examine_location` / `examine_item` | `LocationTracker.unlock_from_testimony` / `_testimony_location_refs` |

2つの経路が存在する理由は、ミステリーにおける「発見」が本質的に2種類あるため——モノを介した決め打ちの物理的な連鎖と、言葉から浮かび上がる動的な発見。後者はLLMの出力に依存するぶん、仕組みとしては複雑かつ脆さも持っている。
