/**  Config & utility constants  -------------------------------------------
 * Default settings that may be modified from the UI inside the sheets itself
*/

/**
 * Shared-secret your local watcher must include in each POST body.
 * Change it to something long & random.
 */
const INBOUND_TOKEN = 'PRIVATE_TOKEN';

/**
 * Map Product-ID-Model ➜ Product name.
 * Extend or edit as required.
 */
const MODEL_TO_PRODUCT = {
  'KAU_ACA0001': 'Actemra',
  'KAU_ACA0002': 'Actemra',
  'KAU_ENS0001': 'Enspryng',
  'KAU_GAZ0001': 'Gazyva',
  'KAU_HEM0001': 'Hemlibra',
  'KAU_HEM0002': 'Hemlibra',
  'KAU_HER0002': 'Herceptin',
  'KAU_MAB0002': 'Mabthera',
  'KAU_OCV0001': 'Ocrevus',
  'KAU_OCV0002': 'Ocrevus',
  'KAU_PEG000A': 'Pegasyys 180',
  'KAU_PGO0001': 'Phesgo',
  'KAU_PGO0002': 'Phesgo',
  'KAU_VAB0001': 'Vabysmo',
  'KAU_TCN0002': 'Tecentriq',
};


/**
 * Name of the bound sheet that receives parsed rows.
 */
const TARGET_SHEET_NAME = 'Released Samples';

/**
 * Script Properties key for deduplication markers.
 */
const PROP_KEY = 'PROCESSED_FILES';
