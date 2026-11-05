# Booking confirmation email

Set `booking_confirmation_from` in the installation's private configuration to a valid sender address accepted by its PHP mail transport. The booking form then offers an optional email field. A new reservation sends the service, start and end times in the business timezone, and booking reference after the reservation commits. A retry with the same request key does not resend. PHP mail acceptance indicates submission to the transport. Delivery depends on the installation's mail configuration.

Public demo lockdown disables transport and ignores customer supplied email addresses. The receipt shows a preview of the confirmation details. Calendar exports and emails are copies of the booking details at the time of confirmation.
