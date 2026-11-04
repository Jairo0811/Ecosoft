import { crc32, deflateRawSync } from 'node:zlib';

export type ReportCell = string | number | boolean | null;
export type ReportRow = Record<string, ReportCell>;

/** Context printed in PDF/XLSX so an exported file is self-describing. */
export interface ExportMeta {
  title: string;
  generatedAt: Date;
  /** Rows that matched the filters (may exceed the exported rows when truncated). */
  total: number;
  truncated: boolean;
}

const text = (value: ReportCell): string => (value == null ? '' : String(value));

/** Cells starting with = + - @ (or tab/CR) are evaluated as formulas by spreadsheet apps. */
const isFormulaLike = (value: string): boolean => /^[=+\-@\t\r]/.test(value);
const spreadsheetText = (value: ReportCell): string => {
  const normalized = text(value);
  return isFormulaLike(normalized) ? `'${normalized}` : normalized;
};

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

const csvCell = (value: ReportCell): string => `"${spreadsheetText(value).replaceAll('"', '""')}"`;

export const toCsv = (columns: string[], rows: ReportRow[]): Buffer =>
  Buffer.from(
    `\uFEFF${[columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key] ?? null)).join(','))].join('\r\n')}`,
    'utf8',
  );

// ---------------------------------------------------------------------------------------------
// XLSX (Office Open XML). A minimal, dependency-free writer: one worksheet, inline strings,
// numeric cells typed as numbers, frozen bold header. Formula-like text is stored as text with
// the `quotePrefix` style, so it is never evaluated and is displayed exactly as stored.
// ---------------------------------------------------------------------------------------------

// XML 1.0 forbids most C0 control characters even when escaped.
// eslint-disable-next-line no-control-regex
const xmlInvalid = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const xml = (value: string): string =>
  value
    .replace(xmlInvalid, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const columnName = (index: number): string => {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
};

const sheetName = (title: string): string =>
  title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Reporte';

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Writes a ZIP archive (deflate) — the container format of every OOXML document. */
const zip = (entries: ZipEntry[], date: Date): Buffer => {
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((Math.max(date.getFullYear(), 1980) - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data);
    const checksum = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
};

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const toXlsx = (meta: ExportMeta, columns: string[], rows: ReportRow[]): Buffer => {
  // Styles: 0 default, 1 bold header, 2 number, 3 text with quotePrefix (formula-like), 4 note.
  const cell = (ref: string, value: ReportCell, header = false): string => {
    if (typeof value === 'number' && Number.isFinite(value) && !header) {
      return `<c r="${ref}" s="2"><v>${value}</v></c>`;
    }
    const content = text(value);
    if (!content) return '';
    const style = header ? 1 : isFormulaLike(content) ? 3 : 0;
    return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(content)}</t></is></c>`;
  };
  const sheetRows = [
    `<row r="1">${columns.map((column, index) => cell(`${columnName(index)}1`, column, true)).join('')}</row>`,
    ...rows.map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 2}">${columns
          .map((column, index) => cell(`${columnName(index)}${rowIndex + 2}`, row[column] ?? null))
          .join('')}</row>`,
    ),
  ];
  if (meta.truncated) {
    const ref = `A${rows.length + 3}`;
    sheetRows.push(
      `<row r="${rows.length + 3}"><c r="${ref}" t="inlineStr" s="4"><is><t>${xml(truncationNote(meta, rows.length))}</t></is></c></row>`,
    );
  }
  const widths = columns.map((column) =>
    Math.min(
      60,
      Math.max(
        10,
        column.length + 2,
        ...rows.slice(0, 500).map((r) => text(r[column] ?? null).length + 2),
      ),
    ),
  );
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows.join('')}</sheetData></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF9A3412"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EEF6"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf quotePrefix="1"/><xf fontId="2" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const name = sheetName(meta.title);
  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
      ),
    },
    {
      name: 'docProps/core.xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(meta.title)}</dc:title><dc:creator>EcoSoft</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${meta.generatedAt.toISOString().replace(/\.\d{3}Z$/, 'Z')}</dcterms:created></cp:coreProperties>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', data: Buffer.from(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(worksheet) },
  ];
  return zip(files, meta.generatedAt);
};

// ---------------------------------------------------------------------------------------------
// PDF. Standard Helvetica with WinAnsiEncoding keeps Spanish (á é í ó ú ñ ü ¿ ¡) without
// embedding fonts. Landscape A4 table: repeated header per page, right-aligned numbers,
// generation date, filters summary, truncation notice and "Página X de Y" footer.
// ---------------------------------------------------------------------------------------------

/** Helvetica advance widths (1/1000 em) for ASCII 32–126 from the standard AFM metrics. */
const helveticaWidths = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** WinAnsi code points outside Latin-1 that commonly appear in Spanish text. */
const winAnsiExtras: Record<string, number> = {
  '€': 0x80,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
};

const toWinAnsi = (value: string): number[] =>
  [...value.normalize('NFC')].map((char) => {
    const code = char.codePointAt(0) ?? 63;
    if (code >= 0x20 && code <= 0x7e) return code;
    if (code >= 0xa0 && code <= 0xff) return code;
    return winAnsiExtras[char] ?? 63; // '?'
  });

const charWidth = (code: number, bold: boolean): number => {
  let width: number;
  if (code >= 32 && code <= 126) width = helveticaWidths[code - 32] ?? 556;
  else {
    const base = String.fromCharCode(code).normalize('NFD').charCodeAt(0);
    width = base >= 32 && base <= 126 ? (helveticaWidths[base - 32] ?? 556) : 556;
  }
  return bold ? width * 1.07 : width;
};

const textWidth = (codes: number[], size: number, bold = false): number =>
  (codes.reduce((sum, code) => sum + charWidth(code, bold), 0) * size) / 1000;

const fitText = (value: string, maxWidth: number, size: number, bold = false): number[] => {
  const codes = toWinAnsi(value);
  if (textWidth(codes, size, bold) <= maxWidth) return codes;
  const ellipsis = 0x85;
  const budget = maxWidth - textWidth([ellipsis], size, bold);
  const fitted: number[] = [];
  let width = 0;
  for (const code of codes) {
    const next = (charWidth(code, bold) * size) / 1000;
    if (width + next > budget) break;
    fitted.push(code);
    width += next;
  }
  return [...fitted, ellipsis];
};

/** PDF literal string from WinAnsi bytes, escaping delimiters and non-ASCII as octal. */
const pdfString = (codes: number[]): string =>
  `(${codes
    .map((code) => {
      if (code === 0x28 || code === 0x29 || code === 0x5c) return `\\${String.fromCharCode(code)}`;
      if (code < 0x20 || code > 0x7e) return `\\${code.toString(8).padStart(3, '0')}`;
      return String.fromCharCode(code);
    })
    .join('')})`;

const numberFormat = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 });
const isoDate = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?Z$/;

const displayValue = (value: ReportCell): string => {
  if (typeof value === 'number') return numberFormat.format(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  const raw = text(value);
  const match = isoDate.exec(raw);
  return match ? `${match[1]} ${match[2]}` : raw;
};

const generatedLabel = (date: Date): string =>
  `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

const truncationNote = (meta: ExportMeta, exported: number): string =>
  `Exportación limitada: se incluyen ${numberFormat.format(exported)} de ${numberFormat.format(meta.total)} registros. Aplique filtros para obtener el conjunto completo.`;

const PAGE = { width: 842, height: 595, margin: 36 } as const;
const ROW_HEIGHT = 15;
const BODY_SIZE = 7.5;
const HEADER_SIZE = 7.5;

export const toPdf = (
  meta: ExportMeta,
  columns: string[],
  rows: ReportRow[],
  filters: string[] = [],
): Buffer => {
  const usable = PAGE.width - PAGE.margin * 2;
  const cells = rows.map((row) => columns.map((column) => displayValue(row[column] ?? null)));
  const numeric = columns.map((column) => rows.some((row) => typeof row[column] === 'number'));
  // Natural width per column from header and a sample of rows, then scaled to the page.
  const natural = columns.map((column, index) =>
    Math.min(
      220,
      Math.max(
        textWidth(toWinAnsi(column), HEADER_SIZE, true),
        ...cells.slice(0, 300).map((row) => textWidth(toWinAnsi(row[index] ?? ''), BODY_SIZE)),
      ) + 10,
    ),
  );
  const naturalTotal = natural.reduce((sum, width) => sum + width, 0) || 1;
  const widths = natural.map((width) => (width / naturalTotal) * usable);

  const top = PAGE.height - PAGE.margin;
  const tableTop = top - 52 - (meta.truncated ? 12 : 0);
  const bottom = PAGE.margin + 18;
  const rowsPerPage = Math.max(1, Math.floor((tableTop - bottom) / ROW_HEIGHT) - 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  const line = (codes: number[], x: number, y: number, size: number, bold = false) =>
    `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfString(codes)} Tj ET`;

  const pages: string[] = [];
  for (let page = 0; page < pageCount; page += 1) {
    const ops: string[] = [];
    // Heading block.
    ops.push('0.059 0.165 0.290 rg'); // navy
    ops.push(line(fitText(meta.title, usable, 14, true), PAGE.margin, top - 12, 14, true));
    ops.push('0.278 0.333 0.412 rg');
    const subtitle = `EcoSoft · Generado: ${generatedLabel(meta.generatedAt)} · ${numberFormat.format(meta.total)} registro(s)`;
    ops.push(line(fitText(subtitle, usable, 8), PAGE.margin, top - 27, 8));
    if (filters.length) {
      ops.push(
        line(fitText(`Filtros: ${filters.join(' · ')}`, usable, 8), PAGE.margin, top - 39, 8),
      );
    }
    if (meta.truncated) {
      ops.push('0.604 0.204 0.071 rg');
      ops.push(
        line(
          fitText(truncationNote(meta, rows.length), usable, 8, true),
          PAGE.margin,
          top - 51,
          8,
          true,
        ),
      );
    }
    // Header row.
    let y = tableTop;
    ops.push('0.902 0.933 0.965 rg');
    ops.push(`${PAGE.margin} ${y - 4} ${usable} ${ROW_HEIGHT} re f`);
    ops.push('0.059 0.165 0.290 rg');
    let x = PAGE.margin;
    columns.forEach((column, index) => {
      const width = widths[index] ?? 0;
      const codes = fitText(column, width - 8, HEADER_SIZE, true);
      const offset = numeric[index] ? width - 4 - textWidth(codes, HEADER_SIZE, true) : 4;
      ops.push(line(codes, x + offset, y, HEADER_SIZE, true));
      x += width;
    });
    // Body rows.
    const slice = cells.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    slice.forEach((row, rowIndex) => {
      y -= ROW_HEIGHT;
      if (rowIndex % 2 === 1) {
        ops.push('0.969 0.976 0.984 rg');
        ops.push(`${PAGE.margin} ${y - 4} ${usable} ${ROW_HEIGHT} re f`);
      }
      ops.push('0.118 0.161 0.231 rg');
      x = PAGE.margin;
      row.forEach((value, index) => {
        const width = widths[index] ?? 0;
        const codes = fitText(value, width - 8, BODY_SIZE);
        const offset = numeric[index] ? width - 4 - textWidth(codes, BODY_SIZE) : 4;
        ops.push(line(codes, x + offset, y, BODY_SIZE));
        x += width;
      });
    });
    if (!rows.length) {
      ops.push('0.278 0.333 0.412 rg');
      ops.push(
        line(
          toWinAnsi('Sin registros para los filtros seleccionados.'),
          PAGE.margin + 4,
          y - ROW_HEIGHT,
          8,
        ),
      );
    }
    // Footer.
    ops.push('0.796 0.835 0.882 RG 0.5 w');
    ops.push(
      `${PAGE.margin} ${PAGE.margin + 8} m ${PAGE.width - PAGE.margin} ${PAGE.margin + 8} l S`,
    );
    ops.push('0.392 0.455 0.545 rg');
    ops.push(
      line(fitText(`EcoSoft — ${meta.title}`, usable / 2, 7), PAGE.margin, PAGE.margin - 2, 7),
    );
    const pageLabel = toWinAnsi(`Página ${page + 1} de ${pageCount}`);
    ops.push(
      line(pageLabel, PAGE.width - PAGE.margin - textWidth(pageLabel, 7), PAGE.margin - 2, 7),
    );
    pages.push(ops.join('\n'));
  }

  // Object layout: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then (page, content) pairs.
  const objects: string[] = [];
  const firstPage = 6;
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${firstPage + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const pdfDate = meta.generatedAt.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  objects[5] = `<< /Title ${pdfString(toWinAnsi(meta.title))} /Producer (EcoSoft) /CreationDate (D:${pdfDate}Z) >>`;
  pages.forEach((stream, index) => {
    const pageObject = firstPage + index * 2;
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageObject + 1} 0 R >>`;
    objects[pageObject + 1] =
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });

  const last = objects.length - 1;
  let document = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [0];
  for (let index = 1; index <= last; index += 1) {
    offsets[index] = Buffer.byteLength(document, 'latin1');
    document += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(document, 'latin1');
  document += `xref\n0 ${last + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= last; index += 1) {
    document += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${last + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document, 'latin1');
};
