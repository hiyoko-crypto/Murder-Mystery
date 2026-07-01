# Murder Mystery — KG-Grounded Detective Game

ローカルLLM（Ollama）と知識グラフ（KG）を使ったマーダーミステリーゲーム。  
CLIまたはReactフロントエンドからプレイできる。

> 旧システム（RAG + OpenAI）のドキュメントは [README_holmes.md](README_holmes.md) を参照。

---

## アーキテクチャ概要

```
scenarios/*.json          シナリオファイル（知識グラフ定義）
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
    └── modules/translator.py          日本語⇔英語 翻訳レイヤー

main_kg.py                CLIエントリーポイント
api.py                    React フロントエンド向け FastAPI サーバー（旧システム使用中）
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

---

## 前提条件

- Python 3.11+
- [Ollama](https://ollama.com/) がローカルで起動していること
- Node.js 20+（フロントエンドをプレイする場合）

### Ollama モデルの準備

```bash
# LLM（必須）
ollama pull qwen2.5:7b

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

### B. フロントエンド（旧システム）

> **注意**: 現在のフロントエンドは旧API（`api.py`）に接続しており、旧システム（RAG + saves/）を使用する。KGベースシステムのフロントエンドAPIは未実装。

#### 事前準備

旧システムのsaveデータが必要。まだ生成していない場合：

```bash
python main.py   # ストーリー生成（数分かかる）
```

`saves/` ディレクトリにデータが生成されれば準備完了。

#### サーバー起動

ターミナルを2つ開き、それぞれで実行する：

**ターミナル 1 — バックエンド（FastAPI）**

```bash
uvicorn api:app --reload
# → http://localhost:8000 で起動
```

**ターミナル 2 — フロントエンド（React + Vite）**

```bash
cd frontend
npm run dev
# → http://localhost:5173 で起動
```

ブラウザで [http://localhost:5173](http://localhost:5173) を開くとゲームが始まる。

---

## シナリオ

現在の対応シナリオ：

| ファイル | タイトル | 概要 |
|---|---|---|
| `scenarios/the_final_act.json` | The Final Act | 劇場での毒殺事件。容疑者4名。 |

### シナリオの構造

```json
{
  "title": "...",
  "nodes": {
    "elena_vasquez": {
      "type": "suspect",
      "properties": { "name": "Elena Vasquez", "guilty": false, ... }
    },
    ...
  },
  "edges": [
    {
      "id": "edge_001",
      "source": "elena_vasquez",
      "target": "backstage",
      "relationship": "was_at",
      "properties": { "detail": "...", "hidden": false }
    }
  ],
  "solution": { "killer_node": "...", "explanation": "..." },
  "display_names_ja": { "Elena Vasquez": "エレナ・バスケス", ... }
}
```

- `hidden: true` のエッジは容疑者が自ら口にしてはならない情報
- `display_names_ja` は日本語翻訳時の固有名詞マッピング

---

## ファイル構成

```
Murder-Mystery/
├── main_kg.py               CLIエントリーポイント（KGシステム）
├── main.py                  CLIエントリーポイント（旧システム）
├── api.py                   FastAPI サーバー（旧システム用）
├── game_session.py          GameSession クラス（KGシステムの中心）
├── game_session_doc.html    GameSession API リファレンス
├── scenarios/
│   └── the_final_act.json   シナリオファイル
├── modules/
│   ├── llm_client.py        Ollama LLM 呼び出し
│   ├── scenario_loader.py   シナリオ読み込み
│   ├── subgraph_to_prompt.py KG → システムプロンプト変換
│   ├── location_tracker.py  場所アンロック管理
│   ├── i18n.py              UI文字列の多言語対応
│   └── translator.py        質問・回答の翻訳
├── suspect_agents/
│   ├── suspect_agent_kg.py  KG制約付き容疑者エージェント
│   ├── commitment_ledger.py 発言履歴・矛盾検出
│   ├── validator_kg.py      出力バリデーション
│   └── run_game_kg.py       CLI ゲームループ（GameSession のラッパー）
├── frontend/                React + Vite フロントエンド
│   └── src/
│       ├── api/chat.ts      FastAPI への通信
│       └── pages/           各画面コンポーネント
└── README_holmes.md         旧システム（Holmes）のドキュメント
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
| フロントエンド用FastAPI（KGシステム） | **未実装** |
| ask_stream() ストリーミング | **未実装** |
| 第2シナリオ | 未着手 |
