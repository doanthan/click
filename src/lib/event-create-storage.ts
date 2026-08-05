// Single source of truth for the create-event wizard's sessionStorage slot.
// Kept in its own tiny module so the "Duplicate event" button can seed a
// prefilled draft into the exact key the wizard rehydrates from, without
// pulling the whole 83KB wizard bundle onto the merchant event page.
//
// The key is handed to useFormDraft unscoped - that hook namespaces it per
// account itself (see lib/account-scope). The duplicate button, which writes
// the slot without the hook, has to apply scopedKey by hand.
export const EVENT_CREATE_STORAGE_KEY = "click:event-create-wizard";

// Envelope version for that slot. BOTH writers - useFormDraft inside the wizard
// and the hand-rolled setItem in merchant-event-duplicate-button.tsx - must
// stamp this, because useFormDraft drops any payload whose `v` does not match.
// That is deliberately how the previously-deployed duplicate button's BARE
// values object gets handled: it has no `v` at all, so the hook removes it and
// the wizard opens empty rather than half-applying a shape it cannot verify.
// Bump only when WizardValues changes shape - older drafts are then discarded.
export const EVENT_CREATE_DRAFT_VERSION = 1;
