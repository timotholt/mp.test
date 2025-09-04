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
  basicOverlayBackdrop,
  basicOverlayContentClear,
  basicFormRow,
  basicFormLabel,
  basicFormValue,
  basicInputRange,
  basicSection,
  basicToolbarRow,
  basicSectionHeader,
  basicSectionRule,
  basicNote,
  basicPanelRow,
  basicPanelLabel,
  basicPanelCell,
  basicTextInput,
  basicInputRow,
  basicFocusGlowOn,
  basicFocusGlowOff,
  basicHoverGlowOn,
  basicHoverGlowOff,
  basicQuarterGap,
  basicGap,
  basicGapBetweenSections,
  // New layout/link templates
  twoColumn14,
  autoFitGridButtons,
  linkInline,
  linkRowCentered,
  artDashedPanel,
  centerViewport,
} from './templates.js';
