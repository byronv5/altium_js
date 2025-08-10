/*

ASCII SchDoc -> FileHeader binary stream converter

This module detects Protel/Altium ASCII schematic files and converts them
into the binary record stream expected by AltiumDocument (the contents of the
OLE FileHeader stream). Each ASCII line becomes one record payload string
terminated with a NUL byte, preceded by a 2-byte payload length (LE), a 1-byte
padding (0), and a 1-byte record type (0).

*/

(function(global) {
  const utf8Encoder = new TextEncoder();
  const utf8Decoder = new TextDecoder('utf-8');

  function isProtelAsciiHeader(textHead) {
    if (textHead == null) return false;
    // Common marker present at the start of ASCII SchDoc files
    return textHead.includes('Protel for Windows - Schematic Capture Ascii File');
  }

  function isProtelAsciiSchDoc(u8) {
    try {
      const headLen = Math.min(256, u8.length);
      const head = utf8Decoder.decode(u8.slice(0, headLen));
      return isProtelAsciiHeader(head);
    } catch (_) {
      return false;
    }
  }

  function toLE16(value) {
    const arr = new Uint8Array(2);
    arr[0] = value & 0xFF;
    arr[1] = (value >>> 8) & 0xFF;
    return arr;
  }

  function convertProtelAsciiToFileHeaderStream(arrayBuffer) {
    const fullText = utf8Decoder.decode(new Uint8Array(arrayBuffer));
    const rawLines = fullText.split(/\r?\n/);

    const chunks = [];
    for (let line of rawLines) {
      if (!line) continue;
      // Strip optional inline line-number prefixes like "L123: " if present
      line = line.replace(/^L\d+:\s*/, '');
      // Accept only attribute lines that start with '|'
      if (line[0] !== '|') continue;

      const payload = utf8Encoder.encode(line + '\0');
      if (payload.length > 0xFFFF) {
        throw new Error('ASCII line too long to encode into a single record.');
      }

      chunks.push(toLE16(payload.length)); // payload_length (u16 LE)
      chunks.push(new Uint8Array([0x00])); // padding
      chunks.push(new Uint8Array([0x00])); // record_type (0)
      chunks.push(payload);                // data
    }

    // Concatenate chunks
    let total = 0;
    for (const c of chunks) total += c.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  // Expose APIs
  global.SchDocASCII = {
    isProtelAsciiSchDoc,
    convertProtelAsciiToFileHeaderStream,
  };
})(window);


