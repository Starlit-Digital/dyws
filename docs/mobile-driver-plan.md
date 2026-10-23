# dyws driver apps

Plan recorded October 23, 2026. These apps are planned, not built or submitted.

## First release

Build a native iOS app with SwiftUI and Core Location, and a native Android app with Kotlin, Compose and the platform location service. Both use the same authenticated order and location API. Native location modules are the critical path because background behavior, permissions and battery handling differ by platform. A browser console remains useful for API testing but is not a substitute for background tracking.

Screens: sign in, on duty, delivery offers, accepted deliveries, pickup details, active delivery map, delivery completion and delivery history. Restaurant managers assign drivers in the initial pilot. Later dispatch can introduce offers with expiration, acceptance races, capacity, distance and estimated pickup readiness.

## iOS

Use Core Location live updates, the appropriate location background capability and explicit authorization. Start sharing in response to a driver beginning an assigned delivery. Explain what is shared with the customer. Use the supported background activity session pattern where appropriate and handle suspension, permission changes, reduced accuracy, loss of network and termination. Request the least authorization sufficient for the actual workflow, not Always permission as a default shortcut. Store credentials in Keychain. Native notification delivery is a separate integration.

Apple reference: https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background

Authorization: https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services

## Android

Use a location foreground service started from an eligible visible user interaction, with a persistent notification while location is shared. Declare the location service type and the permissions required by the target Android version. Handle approximate access, permission denial, one time authorization and battery restrictions. Request background location separately only if the approved workflow actually needs it. Store device credentials using platform protected storage. Review the current Play policy during implementation and store submission.

Android reference: https://developer.android.com/develop/background-work/services/fgs/service-types#location

Location permissions: https://developer.android.com/training/location/permissions

Google Play background location policy: https://support.google.com/googleplay/android-developer/answer/9799150

## GPS protocol

Send latitude, longitude, accuracy and recordedAt to the delivery location endpoint, using the driver’s scoped access token. Initial target: every 5 to 10 seconds while moving and less often while stationary. Do not promise a fixed background interval; platform scheduling, battery and connectivity govern actual delivery. Show the customer the last update time and stale state. Stop sharing at delivery completion, cancellation or assignment loss.

Add device sequence IDs, deduplication, bounded local queues, exponential retry and server acknowledgements before field testing. Old points should never move the customer marker backwards. Upload only current useful location after reconnect; do not flood the latest position endpoint with old history. Future GPS history, if justified, needs a separate retention and access model.

## Customer tracking

Preserve checkout and tracking on the restaurant’s original page. The current build uses polling, a timeline, an expiring private tracking token and an approximate map marker. Move to server events or sockets when the hosting runtime supports reliable fanout, retaining polling as recovery. Add ETA only after integrating a real route service and measuring restaurant readiness and driver progress. Never present straight line distance as road arrival time.

## Delivery milestones and acceptance tests

1. Shared contract and device authentication: refresh, logout, lost device revocation, tenant scope and assignment tests.
2. Foreground apps: pickup and completion operations, API error recovery and offline queues.
3. Background GPS: physical iOS and Android devices, locked screen, permission revocation, battery saver, tunnel and network loss, stale location and resume.
4. Customer map and ETA: licensed map rendering, route accuracy, missing GPS recovery, accessible textual status and automatic location removal after completion.
5. Pilot: TestFlight and Android internal testing with a small restaurant and driver group, field observation and measured battery use.

Native builds require the owner’s developer signing teams, app identifiers and store accounts. No signing identity, paid service or store enrollment has been created as part of this foundation.
