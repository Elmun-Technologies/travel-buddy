// Pure join-eligibility rules (server-side source of truth; UI only mirrors them).
import { ageOn, todayISO } from "@/lib/catalog";

export type JoinTrip = {
  ownerUserId: string | null;
  status: string;
  startDate: string;
  groupSizeMax: number | null;
  approvedCount: number; // includes organizer
  ageMin: number | null;
  ageMax: number | null;
  womenOnly: boolean;
};

export type Joiner = {
  id: string;
  birthDate: string;
  gender: string | null;
  phoneVerified: boolean;
  memberStatus: string | null; // existing trip_members.status, if any
  blocked: boolean; // either side blocked the other
};

export type JoinDenied =
  | "own_trip"
  | "not_open"
  | "started"
  | "full"
  | "already"
  | "blocked"
  | "age"
  | "women_only"
  | "phone_required";

export function joinDenied(trip: JoinTrip, u: Joiner, today = todayISO()): JoinDenied | null {
  if (trip.ownerUserId === u.id) return "own_trip";
  if (u.blocked) return "blocked";
  if (u.memberStatus === "requested" || u.memberStatus === "approved") return "already";
  if (trip.status !== "open") return trip.status === "full" ? "full" : "not_open";
  if (trip.startDate <= today) return "started";
  if (trip.groupSizeMax != null && trip.approvedCount >= trip.groupSizeMax) return "full";
  if (trip.womenOnly) {
    if (u.gender !== "female") return "women_only";
    if (!u.phoneVerified) return "phone_required";
  }
  const age = ageOn(u.birthDate, today);
  if ((trip.ageMin != null && age < trip.ageMin) || (trip.ageMax != null && age > trip.ageMax)) return "age";
  return null;
}
