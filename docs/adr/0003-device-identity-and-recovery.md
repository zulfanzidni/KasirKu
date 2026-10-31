# ADR 0003: Device identity can be adopted, but backup/restore is the real recovery

## Status
Accepted.

## Context
Events carry a `device_id` and a monotonically increasing `seq` per device
(ADR 0001). This makes sync resumable and gap-detectable: a phone pushes
`seq > last_ack`, and a missing sequence number signals loss.

That design has a failure mode the shop will eventually hit: if a phone dies with
unsynced sales, those events are stranded, and a brand-new phone with a new
`device_id` cannot continue the dead phone's stream. The owner chose both "a new
phone can adopt the old identity" and "copy the database across".

Those two are not equally safe, and presenting them as equivalents would hide a
real risk.

## Decision
- **Primary recovery: export the database file and import it on the new phone.**
  This carries history, device identity, and any unsent events. It is the path to
  document and test.
- **Secondary: adopt an existing device identity and continue its `seq`.** This
  is offered as a setting, and it is only safe when the old phone will **never
  sync again**.

## Considered Options
- **Always mint a new `device_id`**: simplest, but strands unsynced events with
  no path to recover them.
- **Never allow adoption**: safe, but a dead phone then means losing whatever it
  had not sent, which in this shop could be a day of sales.

## Consequences
- The app must **refuse to adopt an identity whose events are still arriving**;
  otherwise two phones push the same `device_id`/`seq` pair and events are lost or
  overwritten - the exact failure the event log exists to prevent.
- A backup/restore action is required, which is also the only answer to "what if
  both phones are lost". It is built as its own late stage, but it must land
  **before** the shop depends on the app.
- The setting must state the trade-off in the owner's language, not as a
  technical toggle, or it will be used casually.
