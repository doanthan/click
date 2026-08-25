// Shared by the server-rendered event page and the client-side editor. Keeping
// this value outside a "use client" module means the server can interpolate it
// into an href instead of receiving a React client-reference proxy function.
export const MERCHANT_EVENT_EDIT_SECTION_ID = "edit-event";
