import { useCallback, useMemo, useState } from 'react';
import { halftone, subGridSize, upscalePlain } from '../lib/halftone';
import { loadImageFile, sampleToGrid, type LoadedImage } from '../lib/image';
import { buildProtectMask, generateMatrix, type QrMatrix } from '../lib/qr';
import { resolvePreset } from '../lib/export';
import {
  DEFAULT_IMAGE_ADJUST,
  DEFAULT_SETTINGS,
  type ExportPreset,
  type HalftoneSettings,
  type ImageAdjust,
  type Settings,
} from '../lib/types';
import { useDebouncedValue } from './useDebouncedValue';

export interface HalftoneQrModel {
  settings: Settings;
  image: LoadedImage | null;
  imageError: string | null;
  isLoadingImage: boolean;

  matrix: QrMatrix | null;
  /** QR を生成できなかった理由（容量超過など） */
  qrError: string | null;
  /** 入力が空でプレースホルダを出すべき状態 */
  isEmpty: boolean;

  plainGrid: Uint8Array | null;
  halftoneGrid: Uint8Array | null;
  /** 実際に適用されている ECC。自動調整が効いていると設定値と異なる */
  effectiveEcc: Settings['ecc'];
  /** 上限に収まるよう解決済みの書き出しプリセット */
  effectivePreset: ExportPreset;

  setText: (text: string) => void;
  setEcc: (ecc: Settings['ecc']) => void;
  setAutoEcc: (value: boolean) => void;
  patchImageAdjust: (partial: Partial<ImageAdjust>) => void;
  resetImageAdjust: () => void;
  patchHalftone: (partial: Partial<HalftoneSettings>) => void;
  setExportPreset: (preset: ExportPreset) => void;
  selectImage: (file: File) => Promise<void>;
  clearImage: () => void;
}

export function useHalftoneQr(): HalftoneQrModel {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isLoadingImage, setLoadingImage] = useState(false);

  const debouncedText = useDebouncedValue(settings.text, 200);

  // 画像を載せているあいだは訂正能力を最大に張っておく（SPEC FR-002.4）
  const effectiveEcc = settings.autoEcc && image !== null ? 'H' : settings.ecc;

  const qrResult = useMemo(
    () => generateMatrix(debouncedText, effectiveEcc),
    [debouncedText, effectiveEcc],
  );

  const matrix = qrResult.ok ? qrResult.matrix : null;
  const isEmpty = !qrResult.ok && qrResult.reason === 'empty';
  const qrError = !qrResult.ok && qrResult.reason !== 'empty' ? qrResult.message : null;

  const plainGrid = useMemo(() => (matrix ? upscalePlain(matrix) : null), [matrix]);

  const { image: adjust, halftone: halftoneSettings } = settings;

  // 画像の再サンプリングは画像・アライメント・階調が変わったときだけ（SPEC NFR-003.4）
  const luma = useMemo(() => {
    if (!image || !matrix) return null;
    return sampleToGrid(image, subGridSize(matrix.size), adjust);
  }, [image, matrix, adjust]);

  const protectMask = useMemo(
    () => (matrix ? buildProtectMask(matrix, halftoneSettings.protect) : null),
    [matrix, halftoneSettings.protect],
  );

  const halftoneGrid = useMemo(() => {
    if (!matrix || !protectMask || !luma) return null;
    return halftone({ matrix, protectMask, luma, qrness: halftoneSettings.qrness });
  }, [matrix, protectMask, luma, halftoneSettings.qrness]);

  const effectivePreset = matrix
    ? resolvePreset(matrix.size, settings.exportPreset)
    : settings.exportPreset;

  const setText = useCallback((text: string) => {
    setSettings((previous) => ({ ...previous, text }));
  }, []);

  const setEcc = useCallback((ecc: Settings['ecc']) => {
    setSettings((previous) => ({ ...previous, ecc }));
  }, []);

  const setAutoEcc = useCallback((autoEcc: boolean) => {
    setSettings((previous) => ({ ...previous, autoEcc }));
  }, []);

  const patchImageAdjust = useCallback((partial: Partial<ImageAdjust>) => {
    setSettings((previous) => ({ ...previous, image: { ...previous.image, ...partial } }));
  }, []);

  const resetImageAdjust = useCallback(() => {
    setSettings((previous) => ({ ...previous, image: DEFAULT_IMAGE_ADJUST }));
  }, []);

  const patchHalftone = useCallback((partial: Partial<HalftoneSettings>) => {
    setSettings((previous) => ({
      ...previous,
      halftone: { ...previous.halftone, ...partial },
    }));
  }, []);

  const setExportPreset = useCallback((exportPreset: ExportPreset) => {
    setSettings((previous) => ({ ...previous, exportPreset }));
  }, []);

  const selectImage = useCallback(async (file: File) => {
    setLoadingImage(true);
    const result = await loadImageFile(file);
    setLoadingImage(false);
    if (result.ok) {
      setImage(result.image);
      setImageError(null);
    } else {
      // 読み込みに失敗しても既存の画像は保持する（SPEC E-05）
      setImageError(result.message);
    }
  }, []);

  const clearImage = useCallback(() => {
    setImage(null);
    setImageError(null);
  }, []);

  return {
    settings,
    image,
    imageError,
    isLoadingImage,
    matrix,
    qrError,
    isEmpty,
    plainGrid,
    halftoneGrid,
    effectiveEcc,
    effectivePreset,
    setText,
    setEcc,
    setAutoEcc,
    patchImageAdjust,
    resetImageAdjust,
    patchHalftone,
    setExportPreset,
    selectImage,
    clearImage,
  };
}
