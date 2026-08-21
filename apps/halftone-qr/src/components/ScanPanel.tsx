import type { ScanState } from '../hooks/useScanReport';
import {
  GRADE_LABELS,
  GRADE_SUMMARIES,
  SCAN_BLURS,
  SCAN_SCALES,
  adviceFor,
  type ScanReport,
} from '../lib/scan';
import type { ProtectLevel } from '../lib/types';

interface ScanPanelProps {
  state: ScanState;
  qrness: number;
  protect: ProtectLevel;
  contrast: number;
}

const BLUR_LABELS = ['くっきり', 'ややぼけ', 'ぼけ'];
const SCALE_LABELS = ['遠い', '標準', '近い'];

function ConditionMatrix({ report }: { report: ScanReport }) {
  const lookup = new Map(report.trials.map((trial) => [`${trial.scale}:${trial.blur}`, trial.ok]));

  return (
    <table className="matrix">
      <caption className="visually-hidden">
        解像度とぼかしの組み合わせごとのデコード結果
      </caption>
      <thead>
        <tr>
          <td />
          {SCAN_BLURS.map((blur, index) => (
            <th key={blur} scope="col">
              {BLUR_LABELS[index]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SCAN_SCALES.map((scale, index) => (
          <tr key={scale}>
            <th scope="row">{SCALE_LABELS[index]}</th>
            {SCAN_BLURS.map((blur) => {
              const ok = lookup.get(`${scale}:${blur}`) ?? false;
              return (
                <td key={blur}>
                  <span className={`matrix-cell${ok ? ' is-ok' : ' is-ng'}`}>
                    <span className="visually-hidden">{ok ? '読めた' : '読めない'}</span>
                    <span aria-hidden="true">{ok ? '●' : '×'}</span>
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScanPanel({ state, qrness, protect, contrast }: ScanPanelProps) {
  const report = state.status === 'done' ? state.report : null;
  const advice = report ? adviceFor({ grade: report.grade, qrness, protect, contrast }) : [];

  return (
    <section className="panel scan-panel">
      <h2 className="panel-heading">
        <span className="numeral panel-step" aria-hidden="true">
          06
        </span>
        <span className="panel-title">読み取り判定</span>
      </h2>

      <div className="panel-body">
        <div className="scan-status" aria-live="polite">
          {state.status === 'idle' && (
            <p className="scan-idle">画像とテキストを設定すると判定します。</p>
          )}

          {state.status === 'running' && (
            <p className="scan-idle">
              <span className="scan-spinner" aria-hidden="true" />
              判定中…
            </p>
          )}

          {state.status === 'unavailable' && (
            <p className="scan-idle">{state.message}</p>
          )}

          {report && (
            <>
              <div className={`scan-verdict is-${report.grade}`}>
                <span className="scan-grade">{GRADE_LABELS[report.grade]}</span>
                <span className="numeral scan-score">
                  {report.passed} / {report.total}
                </span>
              </div>
              <p className="scan-summary">{GRADE_SUMMARIES[report.grade]}</p>
            </>
          )}
        </div>

        {report && (
          <>
            <ConditionMatrix report={report} />
            <p className="field-hint">
              9 通りの見え方（カメラとの距離 × ピントのぼけ）で実際にデコードした結果です。
            </p>

            {advice.length > 0 && (
              <ul className="scan-advice">
                {advice.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {/*
          判定はあくまで目安。結果によらず必ず出す（SPEC FR-008.8）
        */}
        <p className="scan-warning">
          <strong>実機での読み取りテストを必ず行ってください。</strong>
          この判定はソフトウェアデコーダによる目安で、実際の読み取り機・印刷品質・照明の
          条件までは再現できません。
        </p>
      </div>
    </section>
  );
}
