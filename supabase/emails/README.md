# Supabase Email Templates

These files are copy-and-paste sources for the Supabase Auth email templates in the BathOS project. Each file is stored as the HTML fragment you can paste directly into the Supabase dashboard template field.

## Template Mapping

| Supabase template | File | Suggested subject line |
| --- | --- | --- |
| Confirm sign up | `supabase/emails/confirm-sign-up.html` | `BathOS: Confirm your email address` |
| Invite user | `supabase/emails/invite-user.html` | `BathOS: Accept your invitation` |
| Magic link | `supabase/emails/magic-link.html` | `BathOS: Your sign-in link` |
| Change email address | `supabase/emails/change-email-address.html` | `BathOS: Confirm your new email address` |
| Reset password | `supabase/emails/reset-password.html` | `BathOS: Reset your password` |
| Reauthentication | `supabase/emails/reauthentication.html` | `BathOS: Confirm it is you` |

## Notes

- Each template is an HTML fragment, not a full document, because Supabase only needs the template body content.
- Critical presentation is inline so the templates do not depend on `<style>` support.
- Token usage is intentionally minimal: the link-based templates use `{{ .ConfirmationURL }}` plus `{{ .Email }}` for context, the change-email template also uses `{{ .NewEmail }}`, and the reauthentication template uses `{{ .Token }}` plus `{{ .SiteURL }}` because Supabase does not provide `{{ .ConfirmationURL }}` for that email.
- `{{ .TokenHash }}`, `{{ .Data }}`, and `{{ .RedirectTo }}` are not surfaced in the copy because they do not improve the message for recipients and would add noise.
- The footer copy is intentionally consistent across all templates and does not include an extra site link.
