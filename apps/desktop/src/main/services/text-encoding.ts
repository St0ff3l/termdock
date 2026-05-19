import iconv from 'iconv-lite'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])
const UTF16LE_BOM = Buffer.from([0xff, 0xfe])
const UTF16BE_BOM = Buffer.from([0xfe, 0xff])

const ENCODING_ALIASES: Record<string, string> = {
  utf8: 'utf-8',
  'utf-8': 'utf-8',
  'utf-8-bom': 'utf-8-bom',
  utf16: 'utf-16le',
  'utf-16': 'utf-16le',
  utf16le: 'utf-16le',
  'utf-16le': 'utf-16le',
  utf16be: 'utf-16be',
  'utf-16be': 'utf-16be',
  gb18030: 'gb18030',
  gbk: 'gbk',
  big5: 'big5',
  cp950: 'cp950',
  'euc-jp': 'euc-jp',
  eucjp: 'euc-jp',
  'shift-jis': 'shift_jis',
  shiftjis: 'shift_jis',
  shift_jis: 'shift_jis',
  sjis: 'shift_jis',
  'iso-2022-jp': 'iso-2022-jp',
  'euc-kr': 'euc-kr',
  euckr: 'euc-kr',
  cp949: 'cp949',
  'windows-1252': 'windows-1252',
  cp1252: 'windows-1252',
  latin1: 'iso-8859-1',
  'iso-8859-1': 'iso-8859-1',
  'windows-1251': 'windows-1251',
  cp1251: 'windows-1251'
}

export function normalizeEncoding(encoding?: string) {
  const normalized = encoding?.trim().toLowerCase() ?? ''
  return ENCODING_ALIASES[normalized] ?? (normalized || 'utf-8')
}

export function decodeBuffer(buffer: Buffer, encoding?: string) {
  const normalized = normalizeEncoding(encoding)
  const decoded = iconv.decode(buffer, normalized === 'utf-8-bom' ? 'utf-8' : normalized)
  return stripBom(decoded)
}

export function encodeText(content: string, encoding?: string) {
  const normalized = normalizeEncoding(encoding)

  if (normalized === 'utf-8-bom') {
    return Buffer.concat([UTF8_BOM, iconv.encode(content, 'utf-8')])
  }

  if (normalized === 'utf-16le') {
    return Buffer.concat([UTF16LE_BOM, iconv.encode(content, 'utf-16le')])
  }

  if (normalized === 'utf-16be') {
    return Buffer.concat([UTF16BE_BOM, iconv.encode(content, 'utf-16be')])
  }

  return iconv.encode(content, normalized)
}

function stripBom(content: string) {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}
