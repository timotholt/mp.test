// UI style templates extracted from themeManager.js
// Central repository for standardized UI element style presets

export const basicStyles = Object.freeze({
  // Text
  title: {
    __tag: 'div',
    color: 'var(--ui-modal-title-fg)',
    fontSize: 'var(--ui-modal-title-size)',
    fontWeight: 'var(--ui-modal-title-weight)',
    userSelect: 'none'
  },
  subtitle: {
    __tag: 'div',
    color: 'var(--ui-modal-subtitle-fg)',
    fontSize: 'var(--ui-modal-subtitle-size)',
    fontWeight: 'var(--ui-modal-subtitle-weight)',
    userSelect: 'none'
  },
  quipTitle: {
    __tag: 'div',
    color: 'var(--ui-modal-title-quip-fg)',
    fontSize: 'var(--ui-modal-title-quip-size)',
    fontWeight: 'var(--ui-modal-title-quip-weight)',
    userSelect: 'none'
  },
  quipSubtitle: {
    __tag: 'div',
    color: 'var(--ui-modal-subtitle-quip-fg)',
    fontSize: 'var(--ui-modal-subtitle-quip-size)',
    fontWeight: 'var(--ui-modal-subtitle-quip-weight)',
    userSelect: 'none'
  },
  body: {
    __tag: 'div',
    color: 'var(--ui-fg)',
    fontSize: 'var(--ui-fontsize-medium)',
    fontWeight: 'var(--ui-fontweight-normal)'
  },
  quip: {
    __tag: 'div',
    color: 'var(--ui-fg-quip)',
    fontSize: 'var(--ui-fontsize-small)',
    fontWeight: 'var(--ui-fontweight-normal)',
    userSelect: 'none'
  },

  // Surfaces
  card: {
    __tag: 'div',
    background: 'linear-gradient(var(--ui-surface-bg-top), var(--ui-surface-bg-bottom))',
    border: 'var(--ui-surface-border-css)',
    boxShadow: 'var(--ui-surface-glow-outer)',
    borderRadius: 'var(--ui-card-radius)',
    padding: 'var(--ui-modal-padding)'
  },

  // States
  disabled: {
    color: 'var(--ui-button-disabled-fg)',
    opacity: 'var(--ui-opacity-disabled-button)',
    pointerEvents: 'none',
    cursor: 'not-allowed'
  },

  // Controls
  button: {
    __tag: 'input',
    __type: 'button',
    background: 'transparent',
    border: 'var(--ui-surface-border-css)',
    color: 'var(--ui-fg)',
    borderRadius: 'var(--ui-card-radius)',
    py: '0.425rem',
    px: '0.625rem',
    fontSize: 'var(--ui-fontsize-small)',
    fontWeight: 'var(--ui-fontweight-normal)',
    pointer: true,
    hover: {
      boxShadow: 'var(--ui-surface-glow-outer)',
      outline: 'var(--ui-surface-border-css)',
      border: '1px solid var(--ui-bright)'
    },
    userSelect: 'none'
  },

  // Form helpers
  formRow: {
    __tag: 'div',
    display: 'flex',
    alignItems: 'center',
    gap: '1.0rem',
    mb: 8
  },
  formLabel: {
    __tag: 'label',
    color: 'var(--ui-fg)',
    fontSize: 'var(--ui-fontsize-small)',
    minWidth: '8.75rem',
    userSelect: 'none'
  },
  formValue: {
    __tag: 'span',
    color: 'var(--ui-fg-muted, #ccc)',
    width: '3.25rem',
    textAlign: 'right',
    userSelect: 'none'
  },
  inputRange: {
    __tag: 'input',
    __type: 'range',
    flex: '1'
  },

  // Section scaffolding
  section: {
    __tag: 'div',
    display: 'block',
    m: '0.5rem 0 0.75rem 0'
  },
  // Grid toolbar/header row (label | control | action)
  toolbarRow: {
    __tag: 'div',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: '0.5rem',
    my: '0.5rem'
  },
  sectionHeader: {
    __tag: 'div',
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    justifyContent: 'flex-start'
  },
  sectionRule: {
    __tag: 'div',
    borderTop: '1px solid var(--ui-surface-border, rgba(120,170,255,0.30))',
    m: '0.25rem 0 0.5rem 0'
  },

  // Misc text blocks
  note: {
    __tag: 'div',
    m: '0.25rem 0 0.5rem 0',
    fontSize: '0.75rem',
    opacity: '0.9',
    color: 'var(--ui-fg-quip)'
  },

  // Panel rows (label + control)
  panelRow: {
    __tag: 'div',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    m: '0.625rem 0'
  },
  panelLabel: {
    __tag: 'label',
    minWidth: '100px',
    color: 'var(--ui-fg)'
  },
  panelCell: {
    __tag: 'div',
    flex: '1'
  },

  // Simple text input
  textInput: {
    __tag: 'input',
    __type: 'text',
    display: 'inline-block',
    height: '2rem',
    lineHeight: '2rem',
    background: 'transparent',
    outline: 'none',
    color: 'var(--ui-fg, #eee)',
    border: '1px solid var(--ui-surface-border, rgba(120,170,255,0.60))',
    borderRadius: '0.5rem',
    px: '0.5rem',
    flex: '1',
    width: '100%',
    hover: {
      boxShadow: 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.30))',
      border: '1px solid var(--ui-bright)'
    }
  },

  // Overlay input row scaffold
  inputRow: {
    __tag: 'div',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    mb: '0.5rem'
  },

  // Behavioral style tokens (used by event handlers)
  focusGlowOn: {
    boxShadow: 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.30))',
    border: '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))'
  },
  focusGlowOff: {
    boxShadow: 'none',
    border: '1px solid var(--ui-surface-border, rgba(120,170,255,0.30))'
  },
  hoverGlowOn: {
    filter: 'drop-shadow(0 0 6px rgba(120,170,255,0.25))'
  },
  hoverGlowOff: {
    filter: 'none'
  }
});

// Convenience aliases (template-first usage)
export const basicTitle = basicStyles.title;
export const basicSubtitle = basicStyles.subtitle;
export const basicQuipTitle = basicStyles.quipTitle;
export const basicQuipSubtitle = basicStyles.quipSubtitle;
export const basicBody = basicStyles.body;
export const basicQuip = basicStyles.quip;
export const basicCard = basicStyles.card;
export const basicDisabled = basicStyles.disabled;
export const basicButton = basicStyles.button;
export const basicFormRow = basicStyles.formRow;
export const basicFormLabel = basicStyles.formLabel;
export const basicFormValue = basicStyles.formValue;
export const basicInputRange = basicStyles.inputRange;
export const basicSection = basicStyles.section;
export const basicSectionHeader = basicStyles.sectionHeader;
export const basicSectionRule = basicStyles.sectionRule;
export const basicNote = basicStyles.note;
export const basicPanelRow = basicStyles.panelRow;
export const basicPanelLabel = basicStyles.panelLabel;
export const basicPanelCell = basicStyles.panelCell;
export const basicTextInput = basicStyles.textInput;
export const basicInputRow = basicStyles.inputRow;
export const basicToolbarRow = basicStyles.toolbarRow;
export const basicFocusGlowOn = basicStyles.focusGlowOn;
export const basicFocusGlowOff = basicStyles.focusGlowOff;
export const basicHoverGlowOn = basicStyles.hoverGlowOn;
export const basicHoverGlowOff = basicStyles.hoverGlowOff;

// Simple gap/spacer element template (used between headers and sections)
export const basicQuarterGap = Object.freeze({ height: '0.25rem' });
export const basicGap = Object.freeze({ height: '0.5rem' });
// Larger gap specifically for separating major sections
export const basicGapBetweenSections = Object.freeze({ height: '1rem' });
