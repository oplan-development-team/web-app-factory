import * as exifr from 'exifr';
import { formatDateTime, formatCoord } from './format';

export type FieldClass = 'sensitive' | 'benign';

export interface MetaField {
  key: string;
  label: string;
  value: string;
  cls: FieldClass;
  /** true only for the single GPS row, which gets the one-time map preview */
  isGps?: boolean;
  gps?: { lat: number; lon: number };
}

export type RiskLevel = 'high' | 'medium' | 'low';

export interface ParsedMeta {
  fields: MetaField[];
  sensitiveCount: number;
  risk: RiskLevel;
  hasAnyData: boolean;
}

interface RawTags {
  Make?: string;
  Model?: string;
  LensModel?: string;
  LensMake?: string;
  SerialNumber?: string;
  BodySerialNumber?: string;
  LensSerialNumber?: string;
  Software?: string;
  Artist?: string;
  OwnerName?: string;
  Copyright?: string;
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  ImageWidth?: number;
  ImageHeight?: number;
  ExifImageWidth?: number;
  ExifImageHeight?: number;
  ColorSpace?: number | string;
  Orientation?: number | string;
  latitude?: number;
  longitude?: number;
}

function asString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function colorSpaceLabel(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (v === 1 || v === 'sRGB') return 'sRGB';
  if (v === 65535 || v === 'Uncalibrated') return '未校正 (Uncalibrated)';
  return String(v);
}

export async function analyzeFile(file: File): Promise<ParsedMeta> {
  let tags: RawTags = {};
  try {
    const options = {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: false,
      icc: false,
      jfif: true,
      translateValues: true,
      reviveValues: true,
      sanitize: true,
      mergeOutput: true,
      // exifr's shipped type definitions don't agree with its own runtime
      // option shapes across versions; this call is intentionally loosely
      // typed rather than fighting mismatched .d.ts overloads.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const parsed = await exifr.parse(file, options);
    if (parsed) tags = parsed as RawTags;
  } catch {
    // Unparseable / corrupt metadata — treat as "no metadata found".
    tags = {};
  }

  const fields: MetaField[] = [];

  const dt = tags.DateTimeOriginal ?? tags.CreateDate;
  if (dt) {
    const d = dt instanceof Date ? dt : new Date(String(dt));
    if (!Number.isNaN(d.getTime())) {
      fields.push({ key: 'datetime', label: '撮影日時', value: formatDateTime(d), cls: 'sensitive' });
    }
  }

  const camera = [asString(tags.Make), asString(tags.Model)].filter(Boolean).join(' ');
  if (camera) {
    fields.push({ key: 'camera', label: 'カメラ機種', value: camera, cls: 'sensitive' });
  }

  const lens = [asString(tags.LensMake), asString(tags.LensModel)].filter(Boolean).join(' ');
  if (lens) {
    fields.push({ key: 'lens', label: 'レンズ情報', value: lens, cls: 'sensitive' });
  }

  const serial = asString(tags.SerialNumber) ?? asString(tags.BodySerialNumber) ?? asString(tags.LensSerialNumber);
  if (serial) {
    fields.push({ key: 'serial', label: '端末シリアル番号', value: serial, cls: 'sensitive' });
  }

  const software = asString(tags.Software);
  if (software) {
    fields.push({ key: 'software', label: '使用ソフトウェア', value: software, cls: 'sensitive' });
  }

  const owner = asString(tags.Artist) ?? asString(tags.OwnerName);
  if (owner) {
    fields.push({ key: 'owner', label: '所有者名', value: owner, cls: 'sensitive' });
  }

  const copyright = asString(tags.Copyright);
  if (copyright) {
    fields.push({ key: 'copyright', label: '著作権情報', value: copyright, cls: 'sensitive' });
  }

  if (typeof tags.latitude === 'number' && typeof tags.longitude === 'number') {
    fields.push({
      key: 'gps',
      label: '撮影地点座標 (GPS)',
      value: `${formatCoord(tags.latitude, true)} / ${formatCoord(tags.longitude, false)}`,
      cls: 'sensitive',
      isGps: true,
      gps: { lat: tags.latitude, lon: tags.longitude },
    });
  }

  const width = tags.ExifImageWidth ?? tags.ImageWidth;
  const height = tags.ExifImageHeight ?? tags.ImageHeight;
  if (width && height) {
    fields.push({ key: 'size', label: '画像サイズ', value: `${width} × ${height} px`, cls: 'benign' });
  }

  const colorSpace = colorSpaceLabel(tags.ColorSpace);
  if (colorSpace) {
    fields.push({ key: 'colorspace', label: 'カラースペース', value: colorSpace, cls: 'benign' });
  }

  if (tags.Orientation !== undefined) {
    fields.push({ key: 'orientation', label: '画像の向き情報', value: String(tags.Orientation), cls: 'benign' });
  }

  const sensitiveCount = fields.filter((f) => f.cls === 'sensitive').length;
  const hasGps = fields.some((f) => f.isGps);

  let risk: RiskLevel = 'low';
  if (hasGps) risk = 'high';
  else if (sensitiveCount >= 1) risk = 'medium';

  return {
    fields,
    sensitiveCount,
    risk,
    hasAnyData: fields.length > 0,
  };
}
