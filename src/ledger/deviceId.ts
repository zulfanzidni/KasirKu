import { newEventId } from './dbLedger';

/** A stable, device-generated name for the phone that produced an event. */
export function newDeviceId(): string {
  return newEventId();
}
