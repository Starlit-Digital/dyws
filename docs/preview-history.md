# Cravings & Delight preview

URL: https://sltd.ca/preview/cravings-4fe5c6f3d9a59082/

Five static pages built from the Starlit canonical tokens, system structure and locally adapted preferences center. Uses the restaurant’s existing logo and photographs. Content, hours, chef biographies and menu prices sourced from https://cravingsanddelight.ca/ and its menu.js on October 22, 2026. No invented reviews. Existing ordering platform, phone and map destinations retained.

The home page has one hero photograph and three featured dishes, with two photos per meal category. About, gatherings and visit information have separate pages. Menu has 300 displayable entries, search, category filtering and six selected category photos. Menu prices are a dated snapshot; ordering platform confirms current prices and availability.

Unlisted random path with HTML and HTTP noindex, nofollow, noarchive directives and no-store response header. Not password protected. No sitemap or public site navigation links added. This URL can be opened by anyone who has it.

Only the new preview directory was uploaded to pct-hostinger domains/sltd.ca/public_html/preview/. Existing website files were preserved. No commit or push.

Verification: local reference checks, JS syntax, browser search and empty state, category filter, mobile navigation and About portraits, reading dialog and saved appearance, 320px and 390px layout. Live HTML, CSS, JS and hero image digests matched local source; HTTP headers verified. No orders, reservations or messages were sent.


## Menu focused revision

Rebuilt at the owner’s request in the Grandma Pizza presentation: burgundy fixed header with category and subpage menu, warm paper, traditional compact menu rows, business information and primary telephone call action. Removed the promotional homepage and large food hero. The homepage is the menu. About, catering, hours and location are separate pages. Six small category photos occupy one third of desktop category width and less than half mobile width. Uber Eats, DoorDash and SkipTheDishes buttons are explicitly labelled preview placeholders, opening a local informational dialog. Existing restaurant online ordering remains live.

Consolidated four pizza size categories into a single 31 row table with four size price columns. All 300 original prices preserved across 207 consolidated menu rows, checked against the original menu data. No menu prices changed. Browser checks: category filtering, search empty state, placeholder dialog, navigation to About, 390px and 320px reflow. Old preview retained outside the public root at domains/sltd.ca/private/deploy-backups/cravings-menu-first-20261022/. Live HTML, CSS and JS digests match source. Original noindex and unlisted URL retained.


Owner clarified the desired original visual palette as three colours: near black charcoal, aged bronze gold and white. Applied #1c1d1b, #b19562 and #fffefa, with derived neutral surfaces and darker bronze links. Supersedes the orange and green theme.css palette. Menu composition and all content retained. Verified published CSS and HTML digests.


Added direct light/dark header switch synchronized with the reading preferences and persistent project preference storage. Light: white, charcoal text, bronze. Dark: charcoal and neutral dark surfaces, white text, bronze. Removed green and navy from the locally adapted preference palette and panel. Browser verified both modes, saved dark after reload, light across navigation to About, and dark on About. Published source digests verified.


## Simple display dropdown and responsive photography

Dark mode is now the initial appearance. Replaced the full preferences component and separate theme switch with one compact native popover containing only Dark/Light appearance and Font size. No line spacing, shade, preview or extra settings. A new scoped display key stores only mode and size. Early initialization prevents an initial white theme. Increased all authored text sizes by 3px; body floor is 21px, with a 21 to 42px slider and proportional authored text sizes. Mobile photos fill the category width; desktop photos are inset left at 330px maximum, below half the category width. Desktop pizza photo uses 28 percent beside the price table. Fixed header remains available and adjusts its spacer to larger text.

Browser checks: initial dark/21px, light and 22px persist after reload, 320px with 42px body text has no page overflow, simple dropdown opens, mobile category photo spans the category width, desktop photo 330px in 1040px category with item text to its right. Local references and JS syntax pass. Live HTML, CSS and JS digests match source. Remote recovery copy: domains/sltd.ca/private/deploy-backups/cravings-simple-display-20261023/.


Footer links are now clear button actions across all pages. Primary bronze telephone button, secondary online ordering, directions, all content subpages, Instagram and original website. Added Uber Eats, DoorDash and SkipTheDishes action buttons, retaining explicit preview labels and existing honest placeholder dialogs. Studio credit link also has a quieter button treatment. Shared palette and text scaling retained. Live HTML and CSS digests verified. Recovery copy: domains/sltd.ca/private/deploy-backups/cravings-footer-actions-20261023/.


Reduced footer to five actions: telephone, real online ordering, hours/location, About and catering. Removed repeated delivery partner buttons and secondary external actions from footer. Studio credit returned to quiet text. Delivery previews remain at the top. Removed all borders from menu categories, headings, items and pizza cells. Surface tones and whitespace provide separation in both appearances. Browser border check and desktop visual check passed. Published HTML/CSS hashes match source. Recovery copy: domains/sltd.ca/private/deploy-backups/cravings-quiet-surfaces-20261023/.


Removed the secondary category selector beside search from both menu pages. Search works independently and header category links reset search before jumping. Header now hides on downward movement and returns upward, while keeping open menus, the display popover and keyboard navigation available. Renamed the delivery partner to Skip and centred all three partner button labels. Browser verified selector absence, pancake search (6 results), centred labels, hidden header after downward movement and visible header on return to menu. Live HTML/CSS/JS digests match source. Recovery copy: domains/sltd.ca/private/deploy-backups/cravings-header-search-20261023/.


Removed the repeated restaurant title, logo, tagline and breakfast/brand phrasing beneath the header on both menu pages. Replaced them with ordinary Location and Hours columns at all screen widths, plus the existing ordering actions. The sole main page h1 is now Our menu. Original header logo/name retained. No new footer promotional text added. Published HTML and CSS digests verified. Recovery: domains/sltd.ca/private/deploy-backups/cravings-plain-info-20261023/.


Aligned menu headings, item text, prices and photos to the same side gutters as the first restaurant information section. Removed the extra 22px desktop and 16px mobile inset within menu rows, retaining shared 1040px maximum width and responsive outer gutters. Pizza first and last columns align to the same edges. Published HTML/CSS digests verified. Recovery: domains/sltd.ca/private/deploy-backups/cravings-menu-alignment-20261023/.


Added exactly two category photos, using original restaurant assets: All Day Breakfast (banner/cravings-and-delight-breakfast-plate-edmonton.webp) and Sandwiches & Wraps (gallery/bbq-grilled-chicken-sandwich.webp). Both follow existing full width mobile and inset left desktop rules. Removed the visible programmatic category focus outline and Entrées surface shadow/borders, preserving focus indicators on interactive links and controls. Both menu pages now contain eight category photos. WEBP signatures and published asset/HTML/CSS digests verified. Recovery: domains/sltd.ca/private/deploy-backups/cravings-two-photos-20261023/.


Corrected the All Day Breakfast photo after visual inspection. The original banner named cravings-and-delight-breakfast-plate-edmonton.webp actually contains cakes, and the other breakfast banner shows a dinner plate. Selected the original gallery/skillet-hash.webp instead, visibly showing fried eggs, potatoes and diced meat in a skillet. Copied to assets/breakfast-skillet.webp with an accurate alt description on both menu pages. Image pixels inspected before deployment; published image and HTML digests verified. Recovery: domains/sltd.ca/private/deploy-backups/cravings-breakfast-correction-20261023/.


Replaced binary appearance selector with the EvansWiki 32 step brightness slider, positions 0 through 31, Dark to Light. Reused the original public EvansWiki palette interpolation and contrast handling with charcoal/bronze/white endpoints. Font slider remains the only other setting. Default is dark step 0; saved shades and font size persist, with migration from previous explicit light/dark choices. Palette tests cover all text, muted and link colours against page/panel/raised surfaces at all 32 steps, minimum 5.07:1. Initialization and persistence migration checks and JS syntax passed. All published HTML/CSS/JS hashes verified. Recovery: domains/sltd.ca/private/deploy-backups/cravings-brightness-20261023/.


Font size control narrowed to exactly 21 through 28px, in 1px steps. Both initial saved preference loading and runtime changes clamp to that range. JS syntax and all published HTML/JS digests verified.


Enlarged both slider controls: 64px tall pointer lanes, 14px visible tracks and 44px bronze handles. Custom Pointer Events handling maps taps anywhere within each lane and captured drags to the existing discrete range steps; native range input semantics and keyboard support remain. Touch action is confined to each lane so dragging does not scroll the page. Browser verified 64px targets, centre clicks changing brightness and text size, keyboard Home/End with the 21 to 28px font limits, and visual handle sizing. JS syntax and published HTML/CSS/JS digests verified. Recovery: domains/sltd.ca/private/deploy-backups/cravings-touch-sliders-20261023/.
