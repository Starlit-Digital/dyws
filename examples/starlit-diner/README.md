# Starlit Diner reference integration

The fictional diner is the working example of dyws. Its deployed assets live in `../../public_html/`, which is kept as the web root for the existing https://sltd.ca/diner/ hosting path.

Customer: `/diner/`
Restaurant manager: `/diner/reports/`
Driver test console: `/diner/driver/`
Private customer tracking: generated after a test checkout, on the original menu page or `tracking/` with an order specific fragment token.

Use fictional names, phone numbers and addresses. All payment actions are test records. The driver simulator sends invented Manning area coordinates and does not dispatch a person. The Share my GPS button asks for browser permission and sends actual device coordinates only after an explicit user action for an assigned active delivery.
