# Customer email sign in deployment, October 27, 2026

The dedicated `account/sign-in/` page is linked from customer account navigation.
[Open the diner sign in page](https://dyws.ca/demos/diner/account/sign-in/).

Signed out customers can enter their account email and request a magic link.
The shared form uses the existing guarded email API. Verification returns an
existing customer to the same account, and a first verified sign in creates an
account. Merchant installations retain the full flow with their configured sender.

Installation Lockdown supplies `customerSignInLocked` through `page.presentation`
for this page. Public demos show a fictional email input and disabled send button.
They mount no email or token handlers. Direct customer mutations remain blocked
by the plugin request allowlist and the independent account availability check.
The restriction is absent from normal installations without the demo plugin.

The full framework suite passed. Browser verification covered an existing
customer requesting a link from the new page and returning to the same account,
normal checkout, order history, driver reports and blocks, demo controls altered
in the browser, pasted login links and eleven direct server denials. Mobile and
desktop live checks passed across all ten stores without browser errors.

The release is
`/home/u394197407/domains/dyws.ca/private/releases/customer-signin-20261028T003630Z`.
All existing database records, catalogs and runtime configuration were preserved.
The final maintenance window lasted 8.59 seconds. The first attempt stopped
before database work because the host missed rapid maintenance configuration
updates. Deployment now assigns distinct configuration modification times and
verifies maintenance with uncached requests and retries.

The hosting repository records the machine receipt at
`docs/customer-signin-deployment-20261027.json`.
