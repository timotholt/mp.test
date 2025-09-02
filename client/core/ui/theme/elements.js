// UI Elements facade: exports creation helpers and common templates
// Keeps templates in themeManager, while providing a clean entry-point for UI element creation.

export {
  // Factories
  createUiElement,
  createRangeElement,
  // Common templates
  basicTitle,
  basicSubtitle,
  basicQuipTitle,
  basicQuipSubtitle,
  basicBody,
  basicQuip,
  basicCard,
  basicDisabled,
  basicButton,
  basicFormRow,
  basicFormLabel,
  basicFormValue,
  basicInputRange,
  basicGap
} from './themeManager.js';
