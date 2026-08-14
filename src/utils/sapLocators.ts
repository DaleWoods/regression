/**
 * SAP GUI for HTML (Webgui) locator helpers (spec §9.3).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Unified Rendering emits positional, generated IDs such as `M0:46:1:2:1::0:0`.
 * They encode screen position, so they change whenever field order, screen
 * layout, or even a user setting changes. Using them as locators produces a
 * suite that breaks on unrelated changes and looks like a product bug.
 *
 * Preference order enforced here:
 *   1. `title` attribute — SAP populates these from field labels and tooltips,
 *      and it is the most stable anchor Webgui offers.
 *   2. `ct` control-type attribute + a nearby label.
 *   3. Label text, then relative traversal to the adjacent input.
 *   4. Generated IDs — only with a comment explaining why, flagged for review.
 *
 * Every ERP page object uses these helpers rather than raw locators.
 *
 * CONTROL TYPES (`ct`) seen in Unified Rendering:
 *   I    input field          B    button
 *   CB   checkbox             RB   radio button
 *   DDLB dropdown list box    LBL  label
 *   STC  table control        TV   tree view
 */
import type { Frame, Locator } from '@playwright/test';

/** Webgui control-type attribute values. */
export const CT = {
  input: 'I',
  button: 'B',
  checkbox: 'CB',
  radioButton: 'RB',
  dropdown: 'DDLB',
  label: 'LBL',
  tableControl: 'STC',
} as const;

/**
 * Escapes a string for safe use inside a CSS attribute selector.
 * SAP labels routinely contain quotes, brackets and slashes.
 */
function cssAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * An input field located by its `title` attribute.
 *
 * PREFERRED for inputs. SAP sets `title` from the data element's field label,
 * so it survives layout changes that destroy generated IDs.
 *
 * @param frame the Webgui content frame (never the top-level page — see §9.4)
 * @param title exact title text, e.g. 'Delivery' or 'Sales Document'
 */
export function sapInputByTitle(frame: Frame, title: string): Locator {
  return frame.locator(`input[ct="${CT.input}"][title="${cssAttrValue(title)}"]`);
}

/**
 * An input field located by its visible label, then traversed to the adjacent
 * input. Use when `title` is absent or non-unique.
 *
 * Strategy: find the label cell, then take the first `ct="I"` input that
 * follows it in document order within the same row. This mirrors how a user
 * reads the screen and is resilient to column re-ordering.
 *
 * @param frame the Webgui content frame
 * @param label label text as displayed, e.g. 'Material'
 */
export function sapInputByLabel(frame: Frame, label: string): Locator {
  // Webgui renders labels as <span ct="LBL"> (or a <label>) inside a table cell,
  // with the input in a following cell of the same row.
  return frame
    .locator(
      `xpath=//*[(@ct="${CT.label}" or self::label) and normalize-space(text())="${label}"]` +
        `/ancestor::tr[1]//input[@ct="${CT.input}"]`
    )
    .first();
}

/**
 * A button located by its `title` attribute.
 *
 * Toolbar buttons in Webgui carry their tooltip text in `title` (e.g. 'Save (Ctrl+S)'),
 * which is why this is a substring match rather than exact — the keyboard hint
 * is appended by SAP and varies by version.
 *
 * @param frame the Webgui content frame
 * @param title button tooltip text or a distinctive fragment of it
 */
export function sapButtonByTitle(frame: Frame, title: string): Locator {
  return frame.locator(
    `[ct="${CT.button}"][title*="${cssAttrValue(title)}"], ` +
      `input[type="button"][title*="${cssAttrValue(title)}"], ` +
      `div[role="button"][title*="${cssAttrValue(title)}"]`
  );
}

/**
 * A checkbox located by its associated label text.
 *
 * @param frame the Webgui content frame
 * @param label label text next to the checkbox
 */
export function sapCheckboxByLabel(frame: Frame, label: string): Locator {
  return frame
    .locator(
      `xpath=//*[(@ct="${CT.label}" or self::label) and contains(normalize-space(text()),"${label}")]` +
        `/ancestor::tr[1]//input[@ct="${CT.checkbox}" or @type="checkbox"]`
    )
    .first();
}

/**
 * Any field located by its `title` attribute, regardless of control type.
 * The general-purpose escape hatch when the control type is unknown.
 *
 * @param frame the Webgui content frame
 * @param title exact title text
 */
export function sapFieldByTitle(frame: Frame, title: string): Locator {
  return frame.locator(`[title="${cssAttrValue(title)}"]`);
}

/**
 * A dropdown (list box) located by its `title` attribute.
 *
 * @param frame the Webgui content frame
 * @param title exact title text
 */
export function sapDropdownByTitle(frame: Frame, title: string): Locator {
  return frame.locator(`[ct="${CT.dropdown}"][title="${cssAttrValue(title)}"]`);
}

/**
 * The transaction command box (OK code field) — the navigation mechanism this
 * framework uses instead of the SAP Easy Access menu tree (spec §9.2).
 *
 * Both the modern toolbar id and the classic form field name are matched,
 * because which one is present depends on the theme and SP level.
 */
export function sapOkCodeField(frame: Frame): Locator {
  return frame.locator('#ToolbarOkCode, input[name="okcode"]').first();
}

/**
 * The status bar, where SAP reports success and failure (spec §9.7).
 *
 * SAP does not navigate on success — it writes a message here — so most ERP
 * assertions read this rather than checking for a page change.
 */
export function sapStatusBar(frame: Frame): Locator {
  // TODO: confirm the exact status bar container on the WOSG QA system. These
  // are the standard Unified Rendering ids; the message type is exposed either
  // as an id suffix or an icon class depending on SP level (see §9.7).
  return frame.locator('#sapMsgTxt, #sbar, .urMsgBarText, [id$="_MessageArea"]').first();
}

/**
 * A row within an ALV grid or table control, matched by the text of one of its
 * cells (spec §8.8 helper `findRowByCellText`).
 *
 * IMPORTANT: ALV grids are virtualised — only visible rows exist in the DOM.
 * Never assert across "all rows"; filter down to one row first using SAP's own
 * selection fields, then use this to grab it.
 *
 * @param frame    the Webgui content frame
 * @param cellText exact text expected in one cell of the target row
 */
export function sapRowByCellText(frame: Frame, cellText: string): Locator {
  return frame.locator(`xpath=//tr[.//*[normalize-space(text())="${cellText}"]]`).first();
}
