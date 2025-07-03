/**  ──────────────────────────────────────────────────────────────────────
 *  UI  +  runtime-config helpers for the Sample-Importer web-app
 *  ──────────────────────────────────────────────────────────────────── */

/* ╭──────────────────╮
   │  CUSTOM  MENU    │
   ╰──────────────────╯ */

/** Add the menu every time the spreadsheet opens. */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Sample Importer')
    .addItem('Manual import …', 'showManualImport')
    .addSeparator()
    .addItem('Configure …', 'showConfigSidebar')
    .addItem('View processed list', 'showProcessedList')
    .addItem('Reset processed list', 'resetProcessedList')
    .addSeparator()
    .addItem('Documentation', 'showDocsSidebar')
    .addToUi();
}

/** Needed once when the add-on is first installed. */
function onInstall(e) { onOpen(e); }

/* ╭──────────────────╮
   │  CONFIG  SIDEBAR │
   ╰──────────────────╯ */

function showConfigSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('ConfigUI')
    .setTitle('Importer Configuration');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Return current settings (defaults → overrides) for the sidebar. */
function getCurrentConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    sheetName: props.getProperty('TARGET_SHEET_NAME') || TARGET_SHEET_NAME,
    propKey: props.getProperty('PROP_KEY') || PROP_KEY,
    modelJson: props.getProperty('MODEL_TO_PRODUCT')
      || JSON.stringify(MODEL_TO_PRODUCT, null, 2)
  };
}

/** Persist settings sent back from the sidebar. */
function saveConfig(cfg) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('TARGET_SHEET_NAME', cfg.sheetName);
  props.setProperty('PROP_KEY', cfg.propKey);
  props.setProperty('MODEL_TO_PRODUCT', cfg.modelJson);
}

/* ╭──────────────────╮
   │  DIAGNOSTICS     │
   ╰──────────────────╯ */

function showProcessedList() {
  const json = PropertiesService.getScriptProperties()
    .getProperty(_cfg('PROP_KEY', PROP_KEY)) || '[]';
  const html = HtmlService
    .createHtmlOutput('<pre style="white-space:pre-wrap;">'
      + json.replace(/</g, '&lt;')
      + '</pre>')
    .setWidth(420).setHeight(300)
    .setTitle('Processed files');
  SpreadsheetApp.getUi().showModalDialog(html, 'Processed files');
}

function resetProcessedList() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('Reset the processed-file list? There\'s no turning back and it may lead to duplicates in the list.', ui.ButtonSet.YES_NO);
  if (resp === ui.Button.YES) {
    PropertiesService.getScriptProperties()
      .setProperty(_cfg('PROP_KEY', PROP_KEY), '[]');
    ui.alert('List cleared.');
  }
}

/* ╭──────────────────╮
   │  DOCS  SIDEBAR   │
   ╰──────────────────╯ */

function showDocsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Docs')
    .setTitle('Sample-Importer Docs');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ╭──────────────────╮
   │  MANUAL IMPORT  │
   ╰──────────────────╯ */
function showManualImport() {
  const html = HtmlService.createHtmlOutputFromFile('ManualImport')
    .setTitle('Manual file import')
    .setWidth(450)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Manual file import');
}

/**
 * Called from ManualImport.html.
 * Re-uses the same parsing / dedup logic as the watcher uploads.
 */
function handleManualUpload(obj) {
  // pretend it's a normal POST body
  const fakeEvent = { parameter: {
    filename: obj.filename,
    content : obj.content,
    token   : INBOUND_TOKEN        // trust local user
  }};
  return doPost(fakeEvent)        // returns the same text message
          .getContent();          // unwrap ContentService output
}

/* ╭──────────────────╮
   │  RUNTIME HELPERS │
   ╰──────────────────╯ */

/** Read a property or fall back to its hard-coded default. */
function _cfg(key, fallback) {
  return PropertiesService.getScriptProperties().getProperty(key) || fallback;
}

/** Get the model→product map, preferring the JSON stored by the UI. */
function _getModelMap() {
  const txt = PropertiesService.getScriptProperties()
    .getProperty('MODEL_TO_PRODUCT');
  if (txt) {
    try { return JSON.parse(txt); } catch (e) { /* fall back silently */ }
  }
  return MODEL_TO_PRODUCT;   // constant from Config.gs
}
