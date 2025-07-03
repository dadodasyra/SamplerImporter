/**  Web-app entry point & helpers  ----------------------------------------*/

/**
 * HTTPS POST handler for the web-app deployment.
 * Expects JSON body:
 *   { filename: "<filename.txt>",
 *     content:  "<base64 of txt>",
 *     token:    "<same as INBOUND_TOKEN>" }
 */
function doPost(e) {
  try {
    // -- 1  Authenticate caller -------------------------------------------------
    const body = JSON.parse(e.postData.contents || '{}');
    console.log(body)
    if (body.token !== INBOUND_TOKEN) {
      return _output(403, 'Forbidden: bad token');
    }

    const filename = body.filename;
    if (!filename || !body.content) {
      return _output(400, 'Bad request: missing filename or content');
    }

    // -- 2  Deduplicate ---------------------------------------------------------
    const props = PropertiesService.getScriptProperties();
    const lock = LockService.getScriptLock();
    const propKey = _cfg('PROP_KEY', PROP_KEY);
    try {
      lock.waitLock(5000); // wait <= 5 s for exclusive access
      const list = JSON.parse(props.getProperty(propKey) || '[]');

      if (list.includes(filename))
        return _output(200, `Ignored ${filename}: already processed`);

      list.push(filename);
      props.setProperty(propKey, JSON.stringify(list));
    } catch (err) {
      console.error(err);
      return _output(500, 'Server error: ' + err.message);
    } finally {
      lock.releaseLock(); // always release the lock
    }


    // -- 3  Decode & parse ------------------------------------------------------
    const txt = Utilities.newBlob(Utilities.base64Decode(body.content)).getDataAsString('UTF-8');
    const parsed = _parseTxt(txt);

    // -- 4  Append to sheet -----------------------------------------------------
    _appendRow(parsed);

    // -- 5  Mark as done & respond ---------------------------------------------
    return _output(200, `OK: ${filename} processed`);
  } catch (err) {
    console.error(err);
    return _output(500, 'Server error: ' + err.message);
  }
}

/**
 * Parse the plain-text report and return an object with the required fields.
 * Throws if a mandatory field is missing.
 */
function _parseTxt(txt) {
  // Helper to fetch 1st capture group by RegExp -------------------------------
  const grab = (re, mandatory = true) => {
    const m = txt.match(re);
    if (!m && mandatory) throw new Error('Missing field: ' + re);
    return m ? m[1].trim() : '';
  };

  const dateRaw = grab(/^Collection time:\s+(.+)$/m);
  const dateObj = new Date(dateRaw);                // JavaScript Date
  if (isNaN(dateObj)) throw new Error('Bad date: ' + dateRaw);

  const order = grab(/^Order Number:\s+(.+)$/m);
  const material = grab(/^Material Number:\s+(.+)$/m);
  const batch = grab(/^Batch:\s+(.+)$/m);
  const model = grab(/^Product ID Model:\s+(.+)$/m);
  const verdict = grab(/^#Final ID Result:\s+(Pass|Fail)$/m).toLowerCase();
  const s1 = grab(/Distance \(Analytical result\):\s+([\d.]+)/m);
  const s2 = grab(/#Identity 2\/2[\s\S]+?Distance \(Analytical result\):\s+([\d.]+)/m, false);
  const equipment = grab(/^Instrument Serial:\s+(.+)$/m);
  const commentRaw = grab(/^Comments:\s+(.+)$/m);
  const comment = /N\/A/i.test(commentRaw) ? '' : commentRaw;

  const product = _getModelMap()[model] || 'UNKNOWN';

  return {
    dateObj, order, material, batch, model, product,
    verdict, s1, s2, equipment, comment
  };
}

/**
 * Insert a row into the “Released Samples” sheet.
 * Column order:
 *   A  Nr. (auto-increment)
 *   B  Date
 *   C  order number
 *   D  material number
 *   E  Product
 *   F  Batch
 *   G  model
 *   H  verdict
 *   I  S1
 *   J  S2
 *   K  Equipment
 *   L  Wurde Analyse im SLIMS ausgelöst?
 *   M  Comment
 */
function _appendRow(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(_cfg('TARGET_SHEET_NAME', TARGET_SHEET_NAME));
  if (!sh) throw new Error('Sheet "' + _cfg('TARGET_SHEET_NAME', TARGET_SHEET_NAME) + '" not found');

  const lastNr = sh.getRange('A:A').getValues().filter(String).pop()[0];
  const nextNr = lastNr + 1;

  const row = [
    nextNr,
    Utilities.formatDate(p.dateObj, Session.getScriptTimeZone(), 'dd.MM.yyyy'),
    p.order,
    p.material,
    p.product,
    p.batch,
    p.model,
    p.verdict,
    p.s1,
    p.s2 || '',       // may be absent
    p.equipment,
    '',               // SLIMS trigger column – left blank
    p.comment,
  ];

  sh.appendRow(row);
}

/** Helper to form HTTP responses -------------------------------------------*/
function _output(code, msg) {
  //TODO: Seems that we cannot return error code correctly ?
  console.log('Returned '+code+' with message '+msg)
  return ContentService
    .createTextOutput(msg)
    .setMimeType(ContentService.MimeType.TEXT);
}
