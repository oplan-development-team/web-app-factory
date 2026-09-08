export type ZoneType = 'kana' | 'digit' | 'hai' | 'iie' | 'sayonara' | 'torii';

export interface Zone {
  id: string;
  type: ZoneType;
  label: string;
  /** 仮想座標系（VIRTUAL_W x VIRTUAL_H）における中心座標 */
  x: number;
  y: number;
  /** 仮想座標系における吸着判定・描画半径 */
  radius: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type Phase =
  | 'setup' // 質問入力フェーズ（マルチタッチ無効）
  | 'ready' // 盤面待機中（指が置かれるのを待つ）
  | 'engaged' // 指の重心に追従中
  | 'drifting' // 自律ドリフト中
  | 'landed' // ある答えゾーンに着地し、続ける/終了を待っている
  | 'ended'; // 鳥居 or さようならに着地、またはユーザーが終了操作

export interface Settings {
  /** 動きが閾値以下とみなす秒数（ドリフト移行までのアイドル判定時間） */
  idleSeconds: number;
  /** ドリフトの徘徊速度（ノイズ周波数の係数） */
  driftSpeed: number;
  /** ドリフトの徘徊振れ幅（速度への倍率） */
  driftStrength: number;
  /** 答えゾーンへの吸引が働き始める半径（仮想座標系） */
  attractionRadius: number;
  /** 吸引力の強さ */
  attractionStrength: number;
}

export interface LogEntry {
  question: string;
  sequence: string;
  startedAt: number;
  endedAt: number;
  attempts: number;
}
