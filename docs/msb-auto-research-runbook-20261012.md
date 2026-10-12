# MSB/OB 自動研究 運用メモ（2026-10-12）

- 本人専用: `/admin/shadow-msb-ob-swing/archive`
- 本番AI/LINE/疑似購入の判定には一切反映しない。研究のみ。
- 独立スイッチ `msb_volume_auto_control` をONにした時だけ運転。
- 既存の `/api/cron/horizontal-retest-research` (08:50 JST営業日) を共有し、新規Cronなし。
- 水平線がON: 同じ最大5銘柄の確定済み日足をMSB研究でも使用（追加のYahoo取得なし）。
- 水平線がOFFまたは全銘柄終了: 同じCron枠でMSB単独最大5銘柄を選択。
- 1営業日1回 `msb_volume_auto_daily_runs` に先にclaim。失敗日も同日再試行せず、失敗理由を残す。
- 研究結果は `msb_volume_research_runs`, `msb_volume_research_observations` にappend-only、同一シグナルは重複保存しない。
- 市場休場日、知らない営業日カレンダー、データ不足、残銘柄なしでは何もしない。
- UIの自動履歴が空なら稼働実績はまだ未確認。スイッチONやGitHub CI成功だけでは実行成功と判断しない。
- 公開前確認: TypeScript、単体テスト、Vercel Production READY を確認してから有効化する。
