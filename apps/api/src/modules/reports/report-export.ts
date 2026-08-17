export type ReportCell = string | number | boolean | null;
export type ReportRow = Record<string, ReportCell>;

const text = (value: ReportCell): string => (value == null ? '' : String(value));
const spreadsheetText = (value: ReportCell): string => {
  const normalized = text(value);
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
};
const csvCell = (value: ReportCell): string => `"${spreadsheetText(value).replaceAll('"', '""')}"`;

export const toCsv = (columns: string[], rows: ReportRow[]): Buffer =>
  Buffer.from(
    `\uFEFF${[columns.map(csvCell).join(','), ...rows.map((row) => columns.map((key) => csvCell(row[key] ?? null)).join(','))].join('\r\n')}`,
    'utf8',
  );

const xml = (value: ReportCell): string =>
  spreadsheetText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const toExcelXml = (title: string, columns: string[], rows: ReportRow[]): Buffer => {
  const excelRows = [
    columns.map((column) => `<Cell><Data ss:Type="String">${xml(column)}</Data></Cell>`),
    ...rows.map((row) =>
      columns.map((column) => {
        const value = row[column] ?? null;
        const type = typeof value === 'number' ? 'Number' : 'String';
        return `<Cell><Data ss:Type="${type}">${xml(value)}</Data></Cell>`;
      }),
    ),
  ];
  const document = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${xml(title).slice(0, 31)}"><Table>${excelRows.map((cells) => `<Row>${cells.join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;
  return Buffer.from(document, 'utf8');
};

const ascii = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');

export const toPdf = (title: string, columns: string[], rows: ReportRow[]): Buffer => {
  const lineRows = rows.map((row) =>
    columns.map((column) => text(row[column] ?? null)).join(' | '),
  );
  const lines = [title, columns.join(' | '), ...lineRows].map((line) => ascii(line).slice(0, 120));
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / 48)) }, (_, index) =>
    lines.slice(index * 48, index * 48 + 48),
  );
  const fontObject = 3 + pages.length * 2;
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  pages.forEach((pageLines, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const stream = `BT /F1 8 Tf 36 806 Td 12 TL ${pageLines.map((line, lineIndex) => `${lineIndex ? 'T* ' : ''}(${line}) Tj`).join(' ')} ET`;
    objects[pageObject] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`;
    objects[contentObject] =
      `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
  });
  objects[fontObject] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 1; index <= fontObject; index += 1) {
    offsets[index] = Buffer.byteLength(document, 'ascii');
    document += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(document, 'ascii');
  document += `xref\n0 ${fontObject + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= fontObject; index += 1) {
    document += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${fontObject + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document, 'ascii');
};
