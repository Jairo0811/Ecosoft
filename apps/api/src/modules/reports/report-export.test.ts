import { inflateRawSync } from 'node:zlib';
import { toCsv, toPdf, toXlsx, type ExportMeta } from './report-export';

/** Reads the entries of a ZIP archive (enough to inspect the generated OOXML parts). */
const unzip = (archive: Buffer): Map<string, string> => {
  const entries = new Map<string, string>();
  let offset = 0;
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const name = archive.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extraLength;
    entries.set(
      name,
      inflateRawSync(archive.subarray(start, start + compressedSize)).toString('utf8'),
    );
    offset = start + compressedSize;
  }
  return entries;
};

const meta = (overrides: Partial<ExportMeta> = {}): ExportMeta => ({
  title: 'Reporte de adjudicaciones',
  generatedAt: new Date('2026-11-04T15:30:00Z'),
  total: 1,
  truncated: false,
  ...overrides,
});

describe('report exports', () => {
  const columns = ['Empresa', 'MW', 'Aprobación UTC'];
  const rows = [
    {
      Empresa: '=HYPERLINK("malicioso")',
      MW: 42.5,
      'Aprobación UTC': '2026-10-01T14:00:00.000Z',
    },
  ];

  it('genera CSV UTF-8 y neutraliza fórmulas', () => {
    const csv = toCsv(columns, rows).toString('utf8');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
  });

  describe('XLSX', () => {
    const archive = toXlsx(meta(), columns, rows);
    const parts = unzip(archive);
    const sheet = parts.get('xl/worksheets/sheet1.xml') ?? '';

    it('es un paquete OOXML real (ZIP) con las partes obligatorias', () => {
      expect(archive.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
      expect([...parts.keys()]).toEqual(
        expect.arrayContaining([
          '[Content_Types].xml',
          '_rels/.rels',
          'xl/workbook.xml',
          'xl/_rels/workbook.xml.rels',
          'xl/styles.xml',
          'xl/worksheets/sheet1.xml',
        ]),
      );
      expect(parts.get('xl/workbook.xml')).toContain('name="Reporte de adjudicaciones"');
    });

    it('escribe números como números y conserva acentos', () => {
      expect(sheet).toContain('<c r="B2" s="2"><v>42.5</v></c>');
      expect(sheet).toContain('Aprobación UTC');
    });

    it('nunca convierte texto en fórmula (quotePrefix, sin <f>)', () => {
      expect(sheet).not.toContain('<f>');
      expect(sheet).toMatch(/<c r="A2" t="inlineStr" s="3"><is><t[^>]*>=HYPERLINK/);
      expect(parts.get('xl/styles.xml')).toContain('quotePrefix="1"');
    });

    it('declara el truncamiento dentro del libro', () => {
      const truncated = unzip(toXlsx(meta({ total: 25_000, truncated: true }), columns, rows));
      expect(truncated.get('xl/worksheets/sheet1.xml')).toContain('Exportación limitada');
    });
  });

  describe('PDF', () => {
    const latin1 = (buffer: Buffer) => buffer.toString('latin1');

    it('genera un PDF válido con fuentes WinAnsi para conservar el español', () => {
      const pdf = latin1(toPdf(meta(), columns, rows, ['Estado APROBADA']));
      expect(pdf.startsWith('%PDF-1.4')).toBe(true);
      expect(pdf.endsWith('%%EOF')).toBe(true);
      expect(pdf).toContain('/Encoding /WinAnsiEncoding');
      // "Aprobación" -> ó is 0xF3 (octal 363) in WinAnsi, not '?'.
      expect(pdf).toContain('Aprobaci\\363n UTC');
      expect(pdf).toContain('Filtros: Estado APROBADA');
      expect(pdf).toContain('/MediaBox [0 0 842 595]'); // landscape A4
    });

    it('formatea cantidades y fechas para lectura', () => {
      const pdf = latin1(
        toPdf(meta(), columns, [...rows, { Empresa: 'B', MW: 12345.678, 'Aprobación UTC': '' }]),
      );
      // es-DO (CLDR): comma thousands separator, period decimal separator.
      expect(pdf).toContain('(42.5)');
      expect(pdf).toContain('(12,345.68)');
      expect(pdf).toContain('(2026-10-01 14:00)');
    });

    it('pagina con encabezado repetido y pie "Página X de Y"', () => {
      const many = Array.from({ length: 120 }, (_, index) => ({
        Empresa: `Empresa ${index}`,
        MW: index,
        'Aprobación UTC': '',
      }));
      const pdf = latin1(toPdf(meta({ total: 120 }), columns, many));
      const pages = Number(/\/Count (\d+)/.exec(pdf)?.[1]);
      expect(pages).toBeGreaterThan(2);
      expect(pdf).toContain(`P\\341gina 1 de ${pages}`);
      expect(pdf).toContain(`P\\341gina ${pages} de ${pages}`);
      expect(pdf.split('(Empresa)').length - 1).toBe(pages);
    });

    it('avisa del truncamiento y del conjunto vacío', () => {
      expect(latin1(toPdf(meta({ total: 20_000, truncated: true }), columns, rows))).toContain(
        'Exportaci\\363n limitada',
      );
      expect(latin1(toPdf(meta({ total: 0 }), columns, []))).toContain('Sin registros');
    });

    it('escapa delimitadores PDF en los datos', () => {
      const pdf = latin1(toPdf(meta(), ['Empresa'], [{ Empresa: 'A) (B \\ C' }]));
      expect(pdf).toContain('(A\\) \\(B \\\\ C)');
    });
  });
});
