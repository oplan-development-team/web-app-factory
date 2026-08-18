import { useMemo } from 'react';
import { ComparePreview } from './components/ComparePreview';
import { ControlRail } from './components/ControlRail';
import { ExportPanel } from './components/ExportPanel';
import { ScanPanel } from './components/ScanPanel';
import { useHalftoneQr } from './hooks/useHalftoneQr';
import { useScanReport, type ScanInput } from './hooks/useScanReport';

export function App() {
  const model = useHalftoneQr();
  const { matrix, halftoneGrid, settings } = model;

  const scanInput = useMemo<ScanInput | null>(() => {
    if (!matrix || !halftoneGrid) return null;
    return { grid: halftoneGrid, moduleCount: matrix.size, text: settings.text };
  }, [matrix, halftoneGrid, settings.text]);

  const scanState = useScanReport(scanInput);

  return (
    <div className="shell">
      <header className="masthead">
        <div className="masthead-main">
          <h1 className="wordmark">
            Halftone<span className="wordmark-break"> </span>QR
          </h1>
          <p className="lede">
            画像を網点に分解して、QR コードの模様そのものに溶け込ませます。
            各モジュールの中心だけは元のビットを保つので、絵に見えたままスキャンできます。
          </p>
        </div>

        <dl className="jobticket">
          <div className="jobticket-item">
            <dt>方式</dt>
            <dd>3×3 サブモジュール / 中心固定</dd>
          </div>
          <div className="jobticket-item">
            <dt>網点</dt>
            <dd>Floyd–Steinberg 誤差拡散</dd>
          </div>
          <div className="jobticket-item">
            <dt>判定</dt>
            <dd>ZXing で実デコード</dd>
          </div>
          <div className="jobticket-item">
            <dt>送信</dt>
            <dd className="jobticket-accent">なし（端末内で完結）</dd>
          </div>
        </dl>
      </header>

      <main className="workbench">
        <div className="workbench-rail">
          <ControlRail {...model} />
        </div>

        <div className="workbench-main">
          <ComparePreview {...model} />
          <div className="result-row">
            <ScanPanel
              state={scanState}
              qrness={settings.halftone.qrness}
              protect={settings.halftone.protect}
              contrast={settings.image.contrast}
            />
            <ExportPanel {...model} />
          </div>
        </div>
      </main>

      <footer className="colophon">
        <p>
          手法は Chu et al. <cite>Halftone QR Codes</cite>（SIGGRAPH Asia 2013）を参考にしています。
          QR コードは株式会社デンソーウェーブの登録商標です。
        </p>
      </footer>
    </div>
  );
}
