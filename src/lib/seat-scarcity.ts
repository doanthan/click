/**
 * The one urgency rung an event's badge may show for its seats, shared by the
 * event card, the tile card, the Discover quick view and the event page.
 *
 * "Almost full" follows the design system: under 15% of the seats left, the
 * same point the capacity bar turns Coral. It used to be "8 or fewer left"
 * whatever the size, so a 5-seat event with nobody going read "Almost full"
 * (bug board #340). For the same reason nothing here fires on an event nobody
 * has booked: "3 spots left" on a 3-seat event is true, but it isn't scarcity.
 * A full event is its own state (Waitlist / Sold out), so it gets null here.
 */
export type SeatScarcity = "spots" | "almostfull" | null;

export function seatScarcity(seatsLeft: number, capacity: number): SeatScarcity {
  if (capacity <= 0 || seatsLeft <= 0 || seatsLeft >= capacity) return null;
  if (seatsLeft <= 3) return "spots";
  if (seatsLeft < capacity * 0.15) return "almostfull";
  return null;
}
