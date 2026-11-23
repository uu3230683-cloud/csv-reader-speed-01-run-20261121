// solve.js — a fast drop-in for csv-reader 1.0.0.
//
// Reads one case {text, header} and returns {columns, rows, errors} exactly
// as csv-reader does: BOM dropped, records end at LF or CRLF, blank lines are
// no record, a lone CR outside quotes is dropped (stray_cr), a field opening
// with a quote runs to the next non-doubled quote ("" is one quote, CRLF or a
// lone CR inside reads as LF), junk after a closing quote is appended
// (quote_junk when non-empty), a quote that never closes is literal and the
// text after it is re-read as unquoted (unterminated_quote), a quote inside an
// unquoted field is literal, fields stay strings, records are padded (short_row)
// or cut (long_row) to the first record's width, and every error carries the
// line its record starts on and the record's index in rows (null for the header).
// A record of nothing but dropped CRs is no record at all.
//
// Speed: one index-based pass. Unquoted fields are scanned with a tight
// charCodeAt loop and sliced out (no per-character allocation); a quoted field
// finds its closing quote with indexOf, and a long one holding no "" escape
// and no CR is taken as one slice, with only its line feeds counted.

const COMMA = 44; // ,
const LF = 10; // \n
const CR = 13; // \r
const QUOTE = 34; // "
const BOM = 0xfeff;

export function run(input) {
  const s = input.text;
  const header = input.header;
  const n = s.length;
  let i = 0;
  if (n > 0 && s.charCodeAt(0) === BOM) i = 1;

  let columns = header ? [] : null;
  const rows = [];
  const errors = [];
  let line = 1;
  let width = -1;
  let first = true;
  let recLine = 1;
  let recRow = null;
  let real = false;

  // Out-parameters of scanPlain, kept in locals so the hot path allocates nothing.
  let plainValue = '';
  let plainTerm = -1; // 44 ',' | 10 LF | 13 CRLF | -1 end of text
  let plainEnd = 0; // index of the terminator (n at end of text)

  // Scan an unquoted stretch from p to the next comma, LF, CRLF or end of text.
  // A lone CR is dropped and reported as stray_cr; the stretch continues past it.
  // Sets plainValue / plainTerm / plainEnd. Also marks the record real when the
  // stretch holds any character or ends at a comma (a record of nothing but
  // dropped CRs is no record at all).
  const scanPlain = (p) => {
    let parts = null;
    let seg = p;
    let j = p;
    let term = -1;
    for (;;) {
      while (j < n) {
        const c = s.charCodeAt(j);
        if (c === COMMA || c === LF || c === CR) break;
        j++;
      }
      if (j >= n) break;
      const c = s.charCodeAt(j);
      if (c === COMMA) { term = COMMA; break; }
      if (c === LF) { term = LF; break; }
      if (s.charCodeAt(j + 1) === LF) { term = CR; break; } // CRLF ends the stretch
      errors.push({ code: 'stray_cr', line: recLine, row: recRow });
      if (parts === null) parts = [s.slice(seg, j)];
      else parts.push(s.slice(seg, j));
      j++;
      seg = j;
    }
    if (parts === null) plainValue = s.slice(seg, j);
    else { parts.push(s.slice(seg, j)); plainValue = parts.join(''); }
    if (plainValue.length > 0 || term === COMMA) real = true;
    plainTerm = term;
    plainEnd = j;
  };

  while (i < n) {
    // A line left with no characters is no record.
    const c0 = s.charCodeAt(i);
    if (c0 === LF) { i++; line++; continue; }
    if (c0 === CR && s.charCodeAt(i + 1) === LF) { i += 2; line++; continue; }

    recLine = line;
    recRow = first && header ? null : rows.length;
    real = false;
    const fields = [];

    // One record: fields until a line break or the end of the text.
    for (;;) {
      let field;
      if (s.charCodeAt(i) === QUOTE) {
        // A field that opens with a quote: find the next quote that is not doubled.
        const q = i;
        let j = q + 1;
        let close = -1;
        let hasEsc = false;
        for (;;) {
          const k = s.indexOf('"', j);
          if (k === -1) break;
          if (s.charCodeAt(k + 1) === QUOTE) { hasEsc = true; j = k + 2; continue; }
          close = k;
          break;
        }
        if (close === -1) {
          // No closing quote anywhere later: the quote is literal, the text
          // after it is read again as unquoted.
          errors.push({ code: 'unterminated_quote', line: recLine, row: recRow });
          real = true;
          scanPlain(q);
          field = plainValue;
        } else {
          // A long segment with no "" escape and no CR is taken as one slice,
          // with only its line feeds counted; shorter ones are cheaper to walk
          // character by character.
          let done = false;
          if (!hasEsc && close - q - 1 > 64) {
            const seg = s.slice(q + 1, close);
            if (seg.indexOf('\r') === -1) {
              field = seg;
              let p = q + 1;
              for (;;) {
                const k = s.indexOf('\n', p);
                if (k === -1 || k >= close) break;
                line++;
                p = k + 1;
              }
              done = true;
            }
          }
          if (!done) {
            // Build the value from [q + 1, close): "" is one quote, CRLF and a
            // lone CR read as LF, and every line break inside counts a line.
            let parts = null;
            let segStart = q + 1;
            let k = q + 1;
            while (k < close) {
              const c = s.charCodeAt(k);
              if (c === QUOTE) {
                if (parts === null) parts = [s.slice(segStart, k)];
                else parts.push(s.slice(segStart, k));
                parts.push('"');
                k += 2;
                segStart = k;
              } else if (c === CR) {
                if (parts === null) parts = [s.slice(segStart, k)];
                else parts.push(s.slice(segStart, k));
                parts.push('\n');
                line++;
                k += s.charCodeAt(k + 1) === LF ? 2 : 1;
                segStart = k;
              } else {
                if (c === LF) line++;
                k++;
              }
            }
            if (parts === null) field = s.slice(q + 1, close);
            else { parts.push(s.slice(segStart, close)); field = parts.join(''); }
          }
          real = true;
          // What follows the closing quote, up to the next comma or line break,
          // is appended as it stands (a lone CR in it is dropped as stray_cr).
          scanPlain(close + 1);
          if (plainValue.length > 0) {
            field += plainValue;
            errors.push({ code: 'quote_junk', line: recLine, row: recRow });
          }
        }
      } else {
        scanPlain(i);
        field = plainValue;
      }
      fields.push(field);
      if (plainTerm === COMMA) { i = plainEnd + 1; continue; }
      if (plainTerm === LF) { i = plainEnd + 1; line++; break; }
      if (plainTerm === CR) { i = plainEnd + 2; line++; break; }
      i = n;
      break;
    }

    // A record of nothing but dropped CRs is no record.
    if (!real) continue;

    if (first) {
      first = false;
      width = fields.length;
      if (header) columns = fields;
      else rows.push(fields);
    } else if (fields.length === width) {
      rows.push(fields);
    } else if (fields.length < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: fields.length });
      while (fields.length < width) fields.push('');
      rows.push(fields);
    } else {
      const extra = fields.slice(width);
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra });
      fields.length = width;
      rows.push(fields);
    }
  }

  return { columns, rows, errors };
}
