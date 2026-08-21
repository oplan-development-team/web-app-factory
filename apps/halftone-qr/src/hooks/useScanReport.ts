import { useEffect, useRef, useState } from 'react';
import { buildReport, type ScanReport, type ScanRequest, type ScanResponse } from '../lib/scan';

export type ScanState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; report: ScanReport }
  | { status: 'unavailable'; message: string };

export interface ScanInput {
  grid: Uint8Array;
  moduleCount: number;
  text: string;
}

/** 判定を投げるまでの待ち時間。スライダーを動かしている最中に走らせない */
const DEBOUNCE_MS = 300;

/**
 * 生成物の読み取り判定を Worker へ委ね、結果を返す（SPEC FR-008.5, FR-008.6, FR-008.9）。
 *
 * 判定は失敗してもアプリの他機能を止めない。Worker を作れない環境では
 * 「判定不可」を返すだけで、プレビューも書き出しも動き続ける。
 */
export function useScanReport(input: ScanInput | null): ScanState {
  const [state, setState] = useState<ScanState>({ status: 'idle' });
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  // 応答が最新の要求のものかを判定するための番号。古い応答は捨てる
  const latestIdRef = useRef(0);

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/decode.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      setState({
        status: 'unavailable',
        message: 'この環境では読み取り判定を実行できません。',
      });
      return;
    }

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<ScanResponse>) => {
      const response = event.data;
      if (response.id !== latestIdRef.current) return;
      if (response.ok) setState({ status: 'done', report: buildReport(response.trials) });
      else setState({ status: 'unavailable', message: '読み取り判定に失敗しました。' });
    };

    worker.onerror = () => {
      setState({
        status: 'unavailable',
        message: '読み取り判定を実行できませんでした。',
      });
    };

    return () => {
      workerRef.current = null;
      worker.terminate();
    };
  }, []);

  const grid = input?.grid ?? null;
  const moduleCount = input?.moduleCount ?? 0;
  const text = input?.text ?? '';

  useEffect(() => {
    if (grid === null || moduleCount === 0 || text.trim() === '') {
      latestIdRef.current += 1; // 進行中の応答を無効化する
      setState({ status: 'idle' });
      return;
    }

    // Worker を作れなかったときは「判定不可」の表示を保つ。
    // 先に running を立ててしまうと、その状態を上書きして永久に判定中に見える
    const worker = workerRef.current;
    if (!worker) return;

    setState({ status: 'running' });
    const timer = setTimeout(() => {
      requestIdRef.current += 1;
      latestIdRef.current = requestIdRef.current;
      const request: ScanRequest = {
        id: requestIdRef.current,
        grid,
        moduleCount,
        text,
      };
      worker.postMessage(request);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [grid, moduleCount, text]);

  return state;
}
