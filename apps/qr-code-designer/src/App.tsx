import { useRef } from 'react';
import { ControlRail } from './components/ControlRail';
import { PreviewStage } from './components/PreviewStage';
import { useQrDesign } from './hooks/useQrDesign';

export function App() {
  const { design, update, applyAppearance, render } = useQrDesign();
  const svgRef = useRef<SVGSVGElement | null>(null);

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead__brand">
          <h1 className="masthead__title">
            QR <em>Designer</em>
          </h1>
          <p className="masthead__tagline">
            名刺にもPOPにも置ける QR を、ブラウザの中だけでつくる。
          </p>
        </div>

        <p className="privacy" role="note">
          <span className="privacy__mark" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path
                d="M8 1.8l5 2v4.1c0 3-2 5.4-5 6.3-3-.9-5-3.3-5-6.3V3.8l5-2z"
                fill="none"
                strokeWidth={1.4}
              />
              <path d="M5.6 8.1l1.7 1.7 3.3-3.6" fill="none" strokeWidth={1.4} strokeLinecap="round" />
            </svg>
          </span>
          入力もロゴも端末の外へ出ません。サーバー送信も外部リクエストもゼロです。
        </p>
      </header>

      <main className="layout">
        <PreviewStage design={design} render={render} svgRef={svgRef} />
        <ControlRail
          design={design}
          update={update}
          applyAppearance={applyAppearance}
          svgRef={svgRef}
          exportDisabled={!render.result.ok}
        />
      </main>

      <footer className="colophon">
        <p>
          生成はすべてブラウザ内で完結します。印刷前に必ず実機で読み取りテストを行ってください。
        </p>
      </footer>
    </div>
  );
}
