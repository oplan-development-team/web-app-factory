import { runTrials } from '../lib/decodeTrials';
import type { ScanRequest, ScanResponse } from '../lib/scan';

/**
 * 読み取り判定を UI から切り離して走らせるための薄い殻（SPEC FR-008.5）。
 * 実際の判定ロジックは lib/decodeTrials.ts 側にある。
 */
self.addEventListener('message', (event: MessageEvent<ScanRequest>) => {
  const request = event.data;
  runTrials(request)
    .then((trials) => {
      const response: ScanResponse = { id: request.id, ok: true, trials };
      self.postMessage(response);
    })
    .catch((error: unknown) => {
      const response: ScanResponse = {
        id: request.id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(response);
    });
});
