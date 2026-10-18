# Provider credential migration

Organization settings responses contain public metadata only. Telegram and
WhatsApp credentials are write-only through both settings endpoints and platform
updates; the dedicated notification settings endpoint returns `tokenSet` flags.

New credentials require a stable `APP_ENCRYPTION_KEY` (base64-encoded 32 bytes or
a string of at least 32 characters). A missing or invalid key causes credential
writes to return HTTP 503 without saving other changes from the same request.
Reading public metadata and clearing disabled credentials with an empty string
still work without a key. Omitted or null credential fields keep existing values.
Clients must send plaintext replacement credentials, never stored ciphertext.

Earlier versions could store provider credentials as plaintext. They remain
readable by the notification worker during migration, but are never returned
from organization settings. To encrypt historical values, explicitly choose the
database and supply its existing persistent encryption key, then run:

```sh
npx ts-node scripts/encrypt-provider-secrets.ts
```

The command uses injected environment variables first, followed by the same
local environment files as the application. It processes 100 organizations at a
time, encrypts nonempty legacy credentials, preserves ciphertext, and conditionally
updates the original value so concurrent replacements are not overwritten. It
prints counts only and is safe to rerun. If `changedConcurrently` is nonzero,
rerun to process values changed during the scan.

Keep the encryption key available to both the API and notification worker.
Changing it does not re-encrypt existing ciphertext. Migrate with the original
key; if it is lost, replace affected provider credentials through the settings
API. Rotate any real provider credentials previously disclosed by the old
settings response. Do not put keys or provider tokens in version control.
