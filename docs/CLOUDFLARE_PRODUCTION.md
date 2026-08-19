# ShareChat Cloudflare production

Production URL: `https://sharechat.everanz.com`

## Bound resources

- Worker: `sharechat`
- D1 database: `sharechat-prod`
- D1 binding: `DB`
- R2 bucket: `sharechat-media-prod`
- R2 binding: `MEDIA`
- Worker secret: `SHARECHAT_ACCESS_KEY`

The R2 bucket has no public development URL or custom public domain. Media is
read through the authenticated same-origin Worker API only.

## GitHub deployment

`.github/workflows/deploy-cloudflare.yml` verifies, migrates, builds, and deploys
every push to `main` after these repository settings exist:

- Actions variable `CLOUDFLARE_ACCOUNT_ID`
- Actions secret `CLOUDFLARE_API_TOKEN`
- Actions variable `CLOUDFLARE_DEPLOY_ENABLED=true`

Keep the deployment flag disabled until the token has been installed. This
prevents an incomplete first workflow run.

## Media transfer

The browser divides each file into 4 MiB pieces. The Worker stores pieces under
`private/<attachment-id>/chunks/` in R2 and records completion metadata in D1.
The private download endpoint streams pieces in order and requires the shared
space key on every request.
