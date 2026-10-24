# WORLD ECONOMY TIME MACHINE

世界経済を1960年から現在まで、地図・ランキング・国別チャートで探索するGitHub Pagesアプリです。

## v1でできること

- 年スライダーで1960年以降を移動
- 年を自動再生する「時間を再生」モード
- GDP / 実質GDP成長率 / 1人あたりGDP / 人口 / インフレ率の切替
- 世界地図のヒートマップ
- 各年のTOP 10ランキング
- 国をクリックして長期推移を表示
- 2か国比較
- オイルショック、プラザ合意、アジア通貨危機、世界金融危機、COVID-19などの経済史イベント
- PC / スマホ対応

## データ

主データは World Bank Indicators API を使用します。

- GDP: `NY.GDP.MKTP.CD`
- GDP growth: `NY.GDP.MKTP.KD.ZG`
- GDP per capita: `NY.GDP.PCAP.CD`
- Population: `SP.POP.TOTL`
- Inflation: `FP.CPI.TOTL.ZG`

World Bank APIはAPIキー不要です。GitHub Actionsが週1回データを取得し、静的JSONとしてPagesに含めます。

ブラウザはまずGitHub Actionsで生成したJSONを読みます。まだJSONがない初回やキャッシュ取得失敗時は、World Bank APIを直接読みにいきます。APIにも接続できない場合は、Natural Earth由来の2017年デモスナップショットへフォールバックします。

## GitHub Pagesで公開する

### 1. 新しいPublicリポジトリを作る

推奨名: `world-economy-time-machine`

### 2. ファイルをアップロード

ZIPを解凍して、まず見えるファイル・フォルダをアップロードします。

```
index.html
css/
js/
data/
scripts/
README.md
SETUP_workflow.yml
```

### 3. `.github/workflows` をGitHub上で作る

Macでは `.github` が隠しフォルダなので、GitHubのブラウザ画面から作る方が確実です。

リポジトリで **Add file → Create new file** を選び、ファイル名に次を入力します。

```
.github/workflows/update-and-deploy.yml
```

`SETUP_workflow.yml` の中身を全部コピーして貼り付け、Commitしてください。

### 4. Pagesを有効にする

**Settings → Pages → Build and deployment → Source → GitHub Actions**

ここが重要です。GitHub Actionsを選ぶ前にWorkflowをRunすると `Get Pages site failed` になることがあります。

### 5. Actionsを実行

**Actions → Update economy data and deploy → Run workflow**

緑のチェックになれば公開完了です。

公開URL例:

```
https://YOUR-NAME.github.io/world-economy-time-machine/
```

## 自動更新

Workflowは毎週日曜12:17ごろ（日本時間）に実行します。世界銀行の年次統計は株価のように毎時更新する必要がないため、週1回で十分という設計です。

手動で最新データを取り直したい場合は、Actions画面から `Run workflow` を押してください。

## 構成

```
world-economy-time-machine/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── data/
│   ├── world.geojson
│   ├── demo_snapshot.json
│   └── (Actions生成) *.json
├── scripts/
│   └── fetch_worldbank.py
└── .github/
    └── workflows/
        └── update-and-deploy.yml
```

## 注意

- 統計には欠損年があります。欠損値を勝手に補間して「実績」として表示しません。
- 名目GDPは物価と為替の影響を受けます。長期比較では成長率や1人GDPなども併用してください。
- 経済史イベントは背景理解のための注釈で、単純な因果関係を断定するものではありません。
- Natural Earthの地図は低解像度の学習・可視化用です。国境・領有権の主張を示すものではありません。

## 次に追加できる機能

- IMF WEOの将来予測（実績と予測を線種で明確に分離）
- PPP GDP
- 政府債務 / 失業率 / 貿易依存度
- GDPランキングのBar Chart Race
- 「日本から見る世界」モード
- お気に入り国
- 経済史クイズ
