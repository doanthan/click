begin;

alter table merchant_profiles
  add column if not exists host_agreement_accepted_at timestamptz,
  add column if not exists host_terms_version text,
  add column if not exists refund_policy_version text;

comment on column merchant_profiles.host_agreement_accepted_at is
  'When the host submitted an application under the recorded legal versions.';
comment on column merchant_profiles.host_terms_version is
  'Version of the Click Host Terms accepted with the application.';
comment on column merchant_profiles.refund_policy_version is
  'Version of the Refund and Cancellation Policy accepted with the application.';

commit;
