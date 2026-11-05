# Demo kiosk

Publish the files in `public_html/kiosk/` under an installation's public `kiosk/` directory. Provide a public `menu.json` containing a fictional catalog's `businessName`, `taxBasisPoints`, `itemOrderCap` and `categories`. Use the standard DYWS variant and option group fields. Set `serviceDemo` to true for a service selection preview. Appointment availability and reservations belong to the booking storefront.

The storefront launcher requires immersive VR support and a published JSON menu. Visitors can also open the kiosk URL directly for regular HTML or the native canvas view where available. The kiosk shares its local cart across all three views and uses the DYWS cart module. Demo completion clears the cart in memory.
