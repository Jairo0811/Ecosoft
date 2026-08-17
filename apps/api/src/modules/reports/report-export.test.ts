import { toCsv, toExcelXml, toPdf } from './report-export';

describe('report exports', () => {
  const columns = ['Empresa', 'MW'];
  const rows = [{ Empresa: '=HYPERLINK("malicioso")', MW: 42.5 }];

  it('genera CSV UTF-8 y neutraliza fórmulas', () => {
    const csv = toCsv(columns, rows).toString('utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
  });

  it('genera un libro XML que Excel puede abrir', () => {
    const excel = toExcelXml('Capacidad', columns, rows).toString('utf8');
    expect(excel).toContain('Excel.Sheet');
    expect(excel).toContain('<Worksheet');
    expect(excel).toContain('&apos;=HYPERLINK');
  });

  it('genera un PDF autocontenido', () => {
    const pdf = toPdf('Reporte EcoSoft', columns, rows).toString('ascii');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('xref');
    expect(pdf.endsWith('%%EOF')).toBe(true);
  });
});
