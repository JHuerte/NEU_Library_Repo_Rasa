export function makePdf(lines) {
  const ascii = (s) => String(s).normalize('NFKD').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '');
  const esc = (s) => ascii(s).replace(/[\\()]/g, (m) => `\\${m}`);
  const wrap = (s, n) => {
    const out = [];
    let line = '';
    for (const w of ascii(s).split(' ')) {
      if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ` ${w}`;
    }
    if (line.trim()) out.push(line.trim());
    return out;
  };
  const rows = [];
  lines.forEach((l, i) => wrap(l, i === 0 ? 60 : 88).forEach((t) => rows.push({ t, big: i === 0 })));
  let y = 740;
  const text = rows.map(({ t, big }) => {
    const s = `BT /F1 ${big ? 15 : 10} Tf 60 ${y} Td (${esc(t)}) Tj ET`;
    y -= big ? 22 : 15;
    return s;
  }).join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
