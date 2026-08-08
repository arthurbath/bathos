## MODIFIED Requirements

### Requirement: One approved Edge Supabase client
Every BathOS Edge Function that uses Supabase JS SHALL resolve the single exact approved 2.x version shared by the current dependency-hardening phase.

#### Scenario: Bundle any Supabase-backed function
- **WHEN** an Edge Function imports or maps `@supabase/supabase-js`
- **THEN** it resolves exact version 2.112.2 without a second direct Supabase JS version
