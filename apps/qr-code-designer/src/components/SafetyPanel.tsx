import { SAFETY_LABEL, type FindingLevel, type SafetyReport } from '../lib/safety';

const GLYPHS: Record<FindingLevel, string> = {
  safe: 'M3.5 8.5l3 3 6-7',
  info: 'M8 7.2v5M8 4.3v.1',
  caution: 'M8 4v5M8 11.6v.1',
  risk: 'M4.5 4.5l7 7M11.5 4.5l-7 7',
};

function FindingIcon({ level }: { level: FindingLevel }) {
  return (
    <svg className="finding__icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d={GLYPHS[level]} fill="none" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

interface SafetyPanelProps {
  safety: SafetyReport | null;
}

export function SafetyPanel({ safety }: SafetyPanelProps) {
  if (!safety) return null;

  return (
    <div className="safety" data-level={safety.level} aria-live="polite">
      <div className="safety__head">
        <span className="safety__dot" aria-hidden="true" />
        <span className="safety__verdict">{SAFETY_LABEL[safety.level]}</span>
        <span className="safety__caption">スキャン耐性の推定</span>
      </div>

      <ul className="findings">
        {safety.findings.map((finding) => (
          <li key={finding.id} className="finding" data-level={finding.level}>
            <FindingIcon level={finding.level} />
            <div>
              <p className="finding__title">{finding.title}</p>
              <p className="finding__detail">{finding.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="safety__note">
        これは静的な推定です。実際に印刷・掲出する前に、スマートフォンでの読み取りテストを行ってください。
      </p>
    </div>
  );
}
