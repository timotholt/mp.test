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
    py: '0.25rem',
    px: '0.625rem',
    fontSize: 'var(--ui-fontsize-small)',
    fontWeight: 'var(--ui-fontweight-normal)',
    pointer: true,
    hover: {
      boxShadow: 'var(--ui-surface-glow-outer)',
      outline: 'var(--ui-surface-border-css)'
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
    textAlign: 'right'
  },
  inputRange: {
    __tag: 'input',
    __type: 'range',
    flex: '1'
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

// Simple gap/spacer element template (used between headers and sections)
export const basicGap = Object.freeze({ height: '0.5rem' });
