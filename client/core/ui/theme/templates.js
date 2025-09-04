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

  // Overlay/backdrop surface helpers
  // Backdrop uses themed surface gradient stops to preserve depth while respecting hue/intensity tokens.
  overlayBackdrop: {
    background: 'radial-gradient(1200px 600px at 50% 10%, var(--ui-surface-bg-top, rgba(12,24,48,0.65)) 0%, var(--ui-surface-bg-bottom, rgba(4,8,18,0.75)) 60%, var(--ui-surface-bg-bottom, rgba(2,4,10,0.85)) 100%)'
  },
  // Clear content container used inside overlay so modals supply their own surface (e.g., cards)
  overlayContentClear: {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    padding: '0',
    maxWidth: 'unset',
    margin: '0'
  },
  // Centered viewport container for modals (card is centered within)
  centerViewport: {
    __tag: 'div',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--ui-page-padding)'
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
      border: '1px solid var(--ui-bright-border, var(--ui-surface-border))'
    },
    userSelect: 'none'
  },

  // Form helpers
  formRow: {
    __tag: 'div',
    display: 'flex',
    alignItems: 'center',
    gap: '1.0rem',
    mb: '1.0rem',
    mt: '1.0rem'
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
    color: 'var(--ui-fg)',
    fontSize:'var(--ui-fontsize-small)',
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

  // Layout utilities
  // Generic two-column grid used by auth/login screens and other modals
  twoColumn14: {
    __tag: 'div',
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr',
    alignItems: 'stretch',
    gap: '1rem'
  },
  // Auto-fit grid for provider-style button groups
  autoFitGridButtons: {
    __tag: 'div',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '10px',
    m: '12px 0 10px 0'
  },

  // Inline link-styled button and a centered link row container
  linkInline: {
    __tag: 'button',
    background: 'none',
    border: '0',
    padding: '0',
    color: 'var(--ui-fg)',
    textDecoration: 'underline',
    font: 'inherit',
    cursor: 'pointer',
    opacity: '0.9',
    hover: {
      color: 'var(--ui-bright)',
      opacity: '1'
    }
  },
  linkRowCentered: {
    __tag: 'div',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px'
  },

  // Artwork viewport panel: dashed border, rounded corners, rem sizing.
  // Background is transparent because artwork is expected to fill this area.
  artDashedPanel: {
    __tag: 'div',
    border: 'var(--ui-surface-border-css)',
    borderStyle: 'dashed',
    borderRadius: 'var(--ui-card-radius)',
    minHeight: '15rem', // ~240px at 16px root; scales with --ui-font-scale
    background: 'transparent',
    overflow: 'hidden'
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
      border: '1px solid var(--ui-bright-border, var(--ui-surface-border))'
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
    border: '1px solid var(--ui-bright-border, var(--ui-surface-border))'
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
export const basicOverlayBackdrop = basicStyles.overlayBackdrop;
export const basicOverlayContentClear = basicStyles.overlayContentClear;
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

// Layout/link aliases for external import
export const twoColumn14 = basicStyles.twoColumn14;
export const autoFitGridButtons = basicStyles.autoFitGridButtons;
export const linkInline = basicStyles.linkInline;
export const linkRowCentered = basicStyles.linkRowCentered;
export const artDashedPanel = basicStyles.artDashedPanel;
export const centerViewport = basicStyles.centerViewport;
