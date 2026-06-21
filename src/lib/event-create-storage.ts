// Single source of truth for the create-event wizard's sessionStorage slot.
// Kept in its own tiny module so the "Duplicate event" button can seed a
// prefilled draft into the exact key the wizard rehydrates from, without
// pulling the whole 83KB wizard bundle onto the merchant event page.
export const EVENT_CREATE_STORAGE_KEY = "click:event-create-wizard";
