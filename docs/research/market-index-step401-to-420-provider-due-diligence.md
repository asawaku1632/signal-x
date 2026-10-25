# STEP 401–420 | 指数データ提供元・契約確認（研究用）

調査日: 2026-10-25。公開情報の整理のみ。契約成立・許諾取得・データ提供開始を意味しない。

## 権利元と確認先

| 指数 | 一次確認先 | 公式資料 | 現在の状態 |
| --- | --- | --- | --- |
| 日経平均株価 | 日本経済新聞社（日経指数） | https://indexes.nikkei.co.jp/nkave/license/index.en.html | 契約・利用許諾未確認 |
| TOPIX | JPX総研 | https://www.jpx.co.jp/markets/indices/licence/ | 契約・利用許諾未確認 |

日経はウェブサイト・モバイルアプリでの表示、システム処理などの非表示利用についてライセンス案内を行っている。日経のデータ提供案内にCSV等の記載があっても、SIGNALXへの転載・自動収集・商用利用が許諾されたわけではない。

JPXはTOPIX等の第三者配信・提供、商用利用等にライセンスが必要と説明している。市場データを第三者の情報ベンダーから取得する場合も、再配信には別途許可が必要となり得る。

公式根拠:
- 日経ライセンス: https://indexes.nikkei.co.jp/nkave/license/index.en.html
- 日経表示利用: https://indexes.nikkei.co.jp/nkave/license/display_usage.en.html
- 日経データ提供: https://indexes.nikkei.co.jp/nkave/data/index.en.html
- JPX指数ライセンス: https://www.jpx.co.jp/markets/indices/licence/
- JPX市場情報: https://www.jpx.co.jp/english/markets/paid-info-equities/realtime/

## SIGNALXで確認すべき利用形態

1. 研究サーバー内での自動取得と機械処理（非表示利用）
2. 日経平均・TOPIXの値とチャートのウェブ・Androidアプリ表示（表示利用）
3. 無料・有料ユーザーへの配信、キャッシュ、DB保存、履歴の保持
4. AI POWERなどの独自指標への利用、加工・派生分析
5. 更新頻度、遅延表示、再配信、出典表示、契約終了時の削除義務
6. 取引所営業日・臨時休場情報の根拠と更新責任
7. 提供方式（API/ファイル等）、障害時の扱い、費用と最低契約期間

## 実装上の結論

- 提供元は未選定。価格・利用範囲・契約可否は個別照会が必要。
- Yahoo等の非公式スクレイピングは自動取得に採用しない。
- 研究用UIは未確認を表示し続ける。
- 実データ取得、DB正式保存、Cron有効化、本番AI POWER・通知・売買への接続は行わない。
- 公式窓口への問い合わせ・契約・支払いはユーザー承認を得てから行う。
