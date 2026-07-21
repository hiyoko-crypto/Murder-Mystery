# POIROT — KG-Grounded Detective Game

ローカルLLM（Ollama）と知識グラフ（KG）を使ったマーダーミステリーゲーム。
CLIまたはReactフロントエンドからプレイできる。

> 旧システム（RAG + OpenAI）のドキュメントは [README_holmes.md](README_holmes.md) を参照。

---

## アーキテクチャ概要

```
scenarios/*.json          シナリオファイル（知識グラフ定義、複数可）
    │
    ▼
game_session.py           ゲームロジックの唯一の窓口（GameSession クラス）
    ├── modules/scenario_loader.py     KGノード・エッジの読み込み
    ├── modules/subgraph_to_prompt.py  容疑者ごとのシステムプロンプト生成
    ├── suspect_agents/
    │   ├── suspect_agent_kg.py        KG制約付きLLM呼び出し
    │   ├── commitment_ledger.py       容疑者の発言履歴（矛盾検出）
    │   └── validator_kg.py            JSON形式・隠蔽エッジ漏洩・矛盾チェック
    ├── modules/location_tracker.py    場所のアンロック管理
    ├── modules/indictment_evaluator.py 告発時の証拠グラフ判定
    ├── modules/reason_edge_extractor.py 自由記述からKGエッジを抽出
    └── modules/translator.py          日本語⇔英語 翻訳レイヤー（オンデマンド・キャッシュ）

main_kg.py                CLIエントリーポイント
api.py                    React フロントエンド向け FastAPI サーバー（複数シナリオを切替可能）
frontend/                 React + Vite フロントエンド
```

### KGベースシステムの特徴

| 旧システム（Holmes） | 現システム（KG） |
|---|---|
| RAG + ChromaDB | 知識グラフのサブグラフを直接コンテキストとして渡す |
| OpenAI API | ローカルLLM（Ollama） |
| 質問に依存した不安定な検索 | 容疑者ごとの固定サブグラフ → 一貫した回答 |
| 発言の矛盾を検出できない | CommitmentLedger で矛盾を検出・防止 |
| 英語のみ | 英語KG + 翻訳レイヤーで日本語対応 |
| シナリオ1本固定 | 複数シナリオをゲーム内で選択可能 |

---

## 前提条件

- Python 3.11+
- [Ollama](https://ollama.com/) がローカルで起動していること
- Node.js 20+（フロントエンドをプレイする場合）

### Ollama モデルの準備

現在の使用モデルは `modules/llm_client.py` の `MODEL` 定数で管理されている（現状 `qwen3.5:9b`）。

```bash
ollama pull qwen3.5:9b

# 起動確認
ollama list
```

---

## インストール

```bash
git clone <このリポジトリ>
cd Murder-Mystery

# Python 依存関係
pip install -r requirements.txt

# フロントエンド依存関係（フロントエンドをプレイする場合）
cd frontend && npm install && cd ..
```

---

## プレイ方法

### A. CLI（KGベース・推奨）

```bash
python main_kg.py
```

起動すると言語選択が表示される：

```
Select language / 言語を選択してください:
  1. English
  2. 日本語
Enter 1 or 2:
```

**ゲーム中のコマンド：**

| 入力 | 動作 |
|---|---|
| 質問文を入力してEnter | 現在の容疑者に質問する |
| `switch` | 尋問する容疑者を切り替える |
| `examine` | 場所やアイテムを調査する |
| `quit` | ゲームを終了する |

容疑者切り替えメニューで番号選択の代わりに「起訴する」を選ぶと犯人を指名できる。

---

### B. フロントエンド（KGシステム）

#### サーバー起動

**前提**: Ollama が起動していること（`ollama serve`）

```powershell
.\start.ps1
```

バックエンド（FastAPI）とフロントエンド（Vite）用のターミナルが2つ自動で立ち上がる（Windows/PowerShell）。起動後、ブラウザで [http://localhost:5173](http://localhost:5173) を開くとゲームが始まる。

<details>
<summary>手動で起動する場合（Mac/Linux、または片方だけ再起動したい場合）</summary>

**ターミナル 1 — バックエンド（FastAPI）**

```bash
# venv を有効化した上で
uvicorn api:app --reload
# → http://localhost:8000 で起動
# 起動時に GameSession(en) / GameSession(ja) を初期化（Ollama 接続を確認）
```

**ターミナル 2 — フロントエンド（React + Vite）**

```bash
cd frontend
npm run dev
# → http://localhost:5173 で起動
```

</details>

#### 画面遷移

```
タイトル（POIROT） → シナリオ選択 → 言語選択 → オープニング（事件概要）
    → マップ ⇄ 場所調査 / アイテム詳細 / 容疑者尋問（→ 告発） → エンディング
```

#### フロントエンドの機能

| 機能 | 概要 |
|---|---|
| タイトル | POIROT ロゴを表示、ゲーム開始 |
| シナリオ選択 | `GET /scenarios` で一覧取得、`POST /select_scenario` で切替（切替時はセッション・翻訳キャッシュを再構築） |
| オープニング | 被害者・事件概要を表示（`/briefing` エンドポイントから取得） |
| マップ | アンロック済みの場所のみ表示。背景画像はキーワードベースで場所の名前・説明に自動マッチング |
| 場所調査 | `POST /examine/location/{id}` でアイテムを発見 |
| アイテム詳細 | `GET /examine/item/{id}` で説明・重要性を表示 |
| 尋問 | `POST /chat` で容疑者と会話。返答に応じて新しい場所が解放される |
| 場所アンロック通知 | 会話ログ内にシステムメッセージとして表示 |
| 告発 | `POST /indict` で犯人を起訴。追及中に述べた内容全体を毎回まとめて証拠グラフと照合し、正解/不正解でエンディング分岐 |
| 捜査ノート | ブラウザの localStorage に保存される記録帳。行動履歴（記録）・容疑者の関係図（ドラッグ＆ドロップ、`@xyflow/react`）・タイムライン・自由メモの4タブ。マップ画面・尋問画面の両方から開ける |
| 日本語対応 | シナリオ・LLM出力ともに日本語表示（`lang=ja`）。翻訳はオンデマンドLLM呼び出し＋セッション内キャッシュ |

---

## シナリオ

現在の対応シナリオ（`scenarios/*.json` に置くと自動で認識され、ゲーム内のシナリオ選択画面に表示される）：

| ファイル | タイトル | 概要 |
|---|---|---|
| `scenarios/the_final_act.json` | The Final Act | 劇場の開演中に発生した毒殺事件。容疑者3名。 |
| `scenarios/z_The_Four_Pillars_of_Murder.json` | Hercule Poirot: Ghost in the Machine | サーバールームで起きたAI絡みの密室的事件。容疑者4名。 |

`scenarios/old/` や `scenarios/archive/` 配下、`scenarios/templates/` 配下、ファイル名に `template` を含むものはシナリオ一覧から除外される。

### 新しいシナリオを追加したら

事件概要（`/briefing`）の日本語訳は初回だけLLM翻訳が走り、バックエンド再起動直後は数十秒かかることがある。この待ち時間をプレイヤー側で発生させないため、`frontend/src/api/examine.ts` の `fetchBriefing()` は `frontend/src/data/briefingCache.json` に焼き込み済みの翻訳を優先して返す（無ければ従来通りAPIを叩き、localStorageにも積む）。

新しいシナリオを追加したら、開発側で1回だけ以下を実行してその結果を `briefingCache.json` に追記し、コミットする：

```bash
curl "http://127.0.0.1:8000/briefing?lang=en"
curl "http://127.0.0.1:8000/briefing?lang=ja"   # 初回は翻訳のため遅い
```

### シナリオの構造

```json
{
  "scenario_id": "...",
  "title": "...",
  "setting": "...",
  "murder_details": { ... },
  "knowledge_graph": {
    "nodes": { "elena_vasquez": { "labels": ["Suspect"], "properties": { "name": "...", "guilty": false } } },
    "edges": [
      { "id": "edge_001", "source": "elena_vasquez", "target": "backstage", "rel": "WAS_AT", "properties": { "detail": "...", "hidden": false } }
    ]
  },
  "suspects": [ ... ],
  "solution": {
    "killer_node": "...",
    "key_evidence_edges": [ ... ],
    "red_herring_edges": [ ... ],
    "proof_graph": { "groups": [ { "edge_ids": [ ... ], "min_required": 1, "weight": 3, "required": false } ], "minimum_score": 5 },
    "explanation": "..."
  },
  "display_names_ja": { "Elena Vasquez": "エレナ・バスケス" }
}
```

- `hidden: true` のエッジは容疑者が自ら口にしてはならない情報
- 場所ノードは `properties.initially_available: true` があれば開始時から開放済み。それ以外は `REVEALS` エッジ（アイテム→場所）か `unlock_from_testimony` + 証言トレースで解放される
- `display_names_ja` は日本語翻訳時の固有名詞マッピング（任意）
- `proof_graph` は告発時の証拠採点ルール。累積した告発理由テキスト全体から言及エッジを抽出し、グループごとの `min_required` と全体の `minimum_score` を満たすかで正誤判定する

---

## ファイル構成

```
Murder-Mystery/
├── main_kg.py               CLIエントリーポイント（KGシステム）
├── main.py                  CLIエントリーポイント（旧システム）
├── api.py                   FastAPI サーバー（複数シナリオ管理、GameSession に接続）
├── game_session.py          GameSession クラス（KGシステムの中心）
├── game_session_doc.html    GameSession API リファレンス
├── start.ps1                バックエンド・フロントエンドを同時起動するスクリプト
├── show_scenario_kg.py      シナリオファイルのKGをコンソールに可視化
├── show_kg.py                 同上（旧システム向け）
├── scenarios/
│   ├── the_final_act.json
│   ├── z_The_Four_Pillars_of_Murder.json
│   ├── templates/            シナリオ新規作成用テンプレート
│   ├── old/ / archive/        プレイ対象から除外される旧シナリオ
├── modules/
│   ├── llm_client.py         Ollama LLM 呼び出し（使用モデル定義）
│   ├── scenario_loader.py    シナリオ読み込み
│   ├── subgraph_to_prompt.py KG → システムプロンプト変換
│   ├── location_tracker.py   場所アンロック管理
│   ├── indictment_evaluator.py 告発の証拠グラフ判定
│   ├── reason_edge_extractor.py 告発理由文からKGエッジ抽出
│   ├── i18n.py                UI文字列の多言語対応
│   └── translator.py          表示テキストの翻訳（キャッシュ付き）
├── suspect_agents/
│   ├── suspect_agent_kg.py   KG制約付き容疑者エージェント
│   ├── commitment_ledger.py  発言履歴・矛盾検出
│   ├── validator_kg.py       出力バリデーション
│   └── run_game_kg.py        CLI ゲームループ（GameSession のラッパー）
├── frontend/                 React + Vite フロントエンド
│   └── src/
│       ├── api/
│       │   ├── chat.ts           POST /chat（容疑者との会話）
│       │   ├── examine.ts        POST /examine/*, GET /briefing, POST /indict
│       │   ├── scenario.ts       GET /scenario, /scenarios, POST /select_scenario
│       │   ├── session.ts        セッション/状態関連
│       │   └── unsplashFallback.ts  背景画像のUnsplashダウンロード計測（任意）
│       ├── contexts/
│       │   ├── ScenarioContext.tsx  シナリオデータの共有・日本語変換・再取得
│       │   ├── GameContext.tsx      アンロック済み場所・発見アイテムの状態管理
│       │   ├── LanguageContext.tsx  言語設定
│       │   └── CaseNotesContext.tsx 捜査ノート（履歴・関係図・タイムライン・メモ）の永続化
│       ├── components/
│       │   └── notebook/            捜査ノートUI（CaseNotebookModal, RelationshipBoard, TimelineBoard, HistoryList）
│       ├── utils/
│       │   └── backgroundMatch.ts   場所・キャラクターの背景画像キーワードマッチング
│       └── pages/                   各画面コンポーネント（Title/ScenarioSelect/Language/Opening/Map/Location/ItemDetail/Interrogation/Evidence）
└── README_holmes.md          旧システム（Holmes）のドキュメント
```

---

## 開発状況

| 機能 | 状態 |
|---|---|
| KGベース容疑者エージェント | 完成 |
| CommitmentLedger（矛盾検出） | 完成 |
| バリデーション（JSON・隠蔽エッジ） | 完成 |
| 日本語対応（翻訳レイヤー） | 完成 |
| CLIゲームループ | 完成 |
| GameSession（フロント向けAPI） | 完成 |
| フロントエンド用FastAPI（KGシステム） | 完成 |
| React フロントエンド（KG連携） | 完成 |
| 場所アンロック進行（会話で解放） | 完成 |
| シナリオ選択（複数シナリオ切替） | 完成 |
| 捜査ノート（履歴・関係図・タイムライン・メモ） | 完成 |
| 告発の累積証拠判定（複数ターンにまたがる証拠を合算） | 完成 |
| ask_stream() ストリーミング | **未実装** |
| 第2シナリオ以降のロケーション解放の完全整備 | 一部未着手（シナリオごとにKG側の追加作業が必要） |
