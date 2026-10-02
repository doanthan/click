export type AccountSwitchResult = {
  error?: string;
  destination?: string;
  /** Return itself failed, so the form offers a full sign-out instead of leaving
   *  the admin with no way out of the account they are viewing. */
  offerSignOut?: boolean;
};
