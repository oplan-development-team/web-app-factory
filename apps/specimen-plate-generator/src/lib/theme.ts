/**
 * 図版そのものに使う色は、19世紀博物誌図版の実物に倣い
 * 「経年紙のクリーム〜セピア」「インク黒」「錆/赤茶のアクセント」の3色系統に絞る。
 * アプリのUIクロム（操作パネル側）はこれとは別の暗い木調トーンを使い、
 * プレビュー（図版）と操作パネルを視覚的に区別する。
 */
export const PLATE_COLORS = {
  paperBase: "#ecdfc0",
  paperShadowTop: "#f2e8cf",
  paperShadowBottom: "#e2d2a8",
  ink: "#241a10",
  inkSoft: "#4a3822",
  rust: "#8a4a26",
  oxideRed: "#7a2e1d",
  foxing: "#9c6a34",
} as const;
