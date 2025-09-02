// UI Elements facade: exports creation helpers and common templates
// Decoupled: factories from themeManager, templates from templates.js

export {
  // Factories
  createUiElement,
  createRangeElement,
} from './themeManager.js';

export {
  // Common templates
  basicStyles,
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
  basicGap,
} from './templates.js';
