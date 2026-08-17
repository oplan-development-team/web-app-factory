import { useCallback, useMemo, useState } from 'react';
import { generateMatrix, type QrResult } from '../lib/qr';
import { computeLogoMask, type LogoMask } from '../lib/paths';
import { analyzeSafety, type SafetyReport } from '../lib/safety';
import { DEFAULT_DESIGN, type DesignAppearance, type EccLevel, type QrDesign } from '../lib/types';
import { useDebouncedValue } from './useDebouncedValue';

const TEXT_DEBOUNCE_MS = 150;

/**
 * FR-002.3 — in auto mode the error-correction level is a function of whether a
 * logo is present, so it is re-derived after every update rather than stored
 * independently and kept in sync by hand.
 */
function withAutoEcc(design: QrDesign): QrDesign {
  if (!design.eccAuto) return design;
  const target: EccLevel = design.logo ? 'H' : 'M';
  return design.ecc === target ? design : { ...design, ecc: target };
}

export interface QrRender {
  result: QrResult;
  mask: LogoMask | null;
  safety: SafetyReport | null;
}

export function useQrDesign() {
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);

  const update = useCallback((patch: Partial<QrDesign>) => {
    setDesign((current) => withAutoEcc({ ...current, ...patch }));
  }, []);

  /** Presets swap appearance only; text, logo and ECC settings survive. */
  const applyAppearance = useCallback((appearance: DesignAppearance) => {
    setDesign((current) => withAutoEcc({ ...current, ...appearance }));
  }, []);

  const reset = useCallback(() => setDesign(DEFAULT_DESIGN), []);

  const debouncedText = useDebouncedValue(design.text, TEXT_DEBOUNCE_MS);

  const result = useMemo(
    () => generateMatrix(debouncedText, design.ecc),
    [debouncedText, design.ecc],
  );

  const mask = useMemo(
    () => (result.ok ? computeLogoMask(result.matrix.size, design.logo) : null),
    [result, design.logo],
  );

  const safety = useMemo(
    () => (result.ok ? analyzeSafety(design, result.matrix.size, mask) : null),
    [result, design, mask],
  );

  const render: QrRender = { result, mask, safety };

  return { design, update, applyAppearance, reset, render };
}
