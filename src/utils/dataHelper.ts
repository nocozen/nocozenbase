import { BulkMeta } from "../types/apiMeta";
import { FormElType } from "../types/enum";
import { hasher } from "node-object-hash";
import dayjs from "dayjs";

export function objListToArray(docs: any[], fillMissing = null) {
  if (!docs.length) return [];

  const fieldMap = new Map<string, boolean>();
  const len = docs.length;

  for (let i = 0; i < len; i++) {
    const keys = Object.keys(docs[i]);
    for (let j = 0; j < keys.length; j++) {
      fieldMap.set(keys[j], true);
    }
  }

  const allFields = Array.from(fieldMap.keys());
  const result = new Array(len + 1);
  result[0] = allFields; 

  for (let i = 0; i < len; i++) {
    const doc = docs[i];
    const row = new Array(allFields.length);
    for (let j = 0; j < allFields.length; j++) {
      row[j] = doc[allFields[j]] ?? fillMissing;
    }
    result[i + 1] = row;
  }

  return result;
}

function createHash(doc: any) {
  const sortHash = hasher({ sort: true });
  return sortHash.hash(doc);
}

export function formatDocs(
  docs: any[],
  meta: Array<BulkMeta>,
  docBase: any
): any[] {
  if (!docs || docs.length === 0) return [];
  if (!meta || meta.length === 0) return docs;

  return docs.map(doc => {
    const convertedDoc = {};

    for (const fieldMeta of meta) {
      const { field, fieldName, title, type } = fieldMeta;
      let value = null;
      field in doc && (value = doc[field]);
      if (value === null || value === undefined) {
        continue;
      }

      switch (type) {
        case FormElType.FeText:
        case FormElType.FeTextArea:
          convertedDoc[fieldName] = convertToString(value);
          break;
        case FormElType.FeNumber:
          convertedDoc[fieldName] = convertToNumber(value);
          break;
        case FormElType.FeDatetime:
          convertedDoc[fieldName] = convertToDate(value);
          break;
        case FormElType.FeSelect:
        case FormElType.FeRadioGroup:
          convertedDoc[fieldName] = convertToUidObject(value);
          break;
        case FormElType.FeMulSelect:
        case FormElType.FeCheckboxGroup:
          convertedDoc[fieldName] = convertToUidArray(value);
          break;
        default:
          break;
      }

    }

    return { ...convertedDoc, ...docBase, hash: createHash(convertedDoc) };
  });
}


function convertToString(value: any): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function convertToNumber(value: any): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'string') {
    const str = value.trim();
    if (str === '') return 0;

    const num = parseFloat(str);
    if (isNaN(num)) {
      throw new Error(`Unable to convert to number: "${value}"`);
    }

    return num;
  }

  return null;
}

function convertToDate(value: any): Date | null {
  if (value instanceof Date) {
    const date = dayjs(value);
    if (!date.isValid()) {
      throw new Error(`Invalid date object: ${value}`);
    }
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    if (value < 0 || value > 4102444800000) {
      return null;
    }
    
    const timestamp = value.toString().length === 10 ? value * 1000 : value;
    const date = dayjs(timestamp);
    
    if (!date.isValid()) {
      throw new Error(`Invalid timestamp: ${value}`);
    }
    return date.toDate();
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      return null;
    }

    let date: dayjs.Dayjs | null = null;

    const commonFormats = [
      'YYYY-MM-DD',
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DDTHH:mm:ssZ',
      'YYYY/MM/DD',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY.MM.DD',
      'YYYY年MM月DD日',
      'YYYY年MM月DD日 HH时mm分ss秒',
      'MM/DD/YYYY',
      'DD/MM/YYYY',
      'YYYYMMDD',
      'YYYYMMDDHHmmss'
    ];

    for (const format of commonFormats) {
      date = dayjs(trimmedValue, format, true); 
      if (date.isValid()) {
        break;
      }
    }

    if (!date || !date.isValid()) {
      date = dayjs(trimmedValue);
    }

    if ((!date || !date.isValid()) && /^\d+$/.test(trimmedValue)) {
      const numericValue = parseInt(trimmedValue, 10);
      return convertToDate(numericValue); 
    }

    if (!date || !date.isValid()) {
      throw new Error(`Unable to parse date string: ${trimmedValue}`);
    }

    return date.toDate();
  }

  throw new Error(`Unsupported type conversion to date: ${typeof value} - ${value}`);
}

function convertToUidArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(',').filter(item => item !== '').map(item => ({
        uid: item.trim(),
        name: item.trim()
      }));
    }
  }
  return [value];
}

function convertToUidObject(value: any): object | null {
  if (typeof value === 'string') {
    return { uid: value, name: value }
  }
  if (value === null || value === undefined) return null;

  const newValue = String(value).trim();
  return { uid: newValue, name: newValue };
}

