module readings

sig User, Day, Reading {}
abstract sig Slot {}
one sig Morning, Breakfast, Lunch, Dinner extends Slot {}

abstract sig Outcome {}
one sig Idle, Saved, Deleted, Listed, RejectedMove, Rejected extends Outcome {}

one sig Book {
  var entries: User -> Day -> Slot -> Reading,
  var actor: lone User,
  var result: set Reading,
  var outcome: one Outcome
}

fun owned[u: set User]: set Reading {
  Slot.(Day.(u.(Book.entries)))
}

fun rows[u: User, d: Day]: set Reading {
  Slot.(d.(u.(Book.entries)))
}

fun slotRows[u: User, d: Day, s: Slot]: set Reading {
  s.(d.(u.(Book.entries)))
}

pred finish[u: lone User, reply: set Reading, status: Outcome] {
  Book.actor' = u
  Book.result' = reply
  Book.outcome' = status
}

pred create[u: User, r: Reading, d: Day, s: Slot] {
  r not in owned[User]
  no slotRows[u, d, s] implies {
    Book.entries' = Book.entries + u->d->s->r
    finish[u, r, Saved]
  } else {
    Book.entries' = Book.entries
    finish[u, none, Rejected]
  }
}

pred move[u: User, r: Reading, d: Day, s: Slot] {
  r in owned[User]
  (r in owned[u] and no (slotRows[u, d, s] - r)) implies {
    Book.entries' = (Book.entries - User->Day->Slot->r) + u->d->s->r
    finish[u, r, Saved]
  } else {
    Book.entries' = Book.entries
    finish[u, none, RejectedMove]
  }
}

pred remove[u: User, r: Reading] {
  r in owned[User]
  r in owned[u] implies {
    Book.entries' = Book.entries - User->Day->Slot->r
    finish[u, none, Deleted]
  } else {
    Book.entries' = Book.entries
    finish[u, none, Rejected]
  }
}

pred list[u: User, d: Day] {
  Book.entries' = Book.entries
  finish[u, rows[u, d], Listed]
}

pred idle {
  Book.entries' = Book.entries
  finish[Book.actor, Book.result, Book.outcome]
}

pred initiallyEmpty {
  no Book.entries
  no Book.actor
  no Book.result
  Book.outcome = Idle
}

fact Traces {
  always (idle
    or (some u: User, r: Reading, d: Day, s: Slot | create[u, r, d, s] or move[u, r, d, s])
    or (some u: User, r: Reading | remove[u, r])
    or (some u: User, d: Day | list[u, d]))
}

pred uniqueSlots {
  all u: User, d: Day, s: Slot | lone slotRows[u, d, s]
}

pred onePositionPerReading {
  all r: Reading | lone Book.entries.r
}

assert EmptyBookSatisfiesInvariants {
  initiallyEmpty implies (uniqueSlots and onePositionPerReading)
}

assert UniqueSlotsPreserved {
  uniqueSlots implies after uniqueSlots
}

assert ReadingIdentityPreserved {
  onePositionPerReading implies after onePositionPerReading
}

assert DailyCap {
  uniqueSlots implies (all u: User, d: Day | #rows[u, d] <= 4)
}

assert ReturnedRowsBelongToActor {
  Book.result in owned[Book.actor] implies after (Book.result in owned[Book.actor])
}

assert OtherUsersRowsAreUnchanged {
  onePositionPerReading implies
    (User - Book.actor') <: Book.entries = (User - Book.actor') <: Book.entries'
}

assert RejectedMovePreservesOriginal {
  Book.outcome' = RejectedMove implies Book.entries' = Book.entries
}

pred FullDay {
  initiallyEmpty
  eventually (some u: User, d: Day | #rows[u, d] = 4)
}

pred RejectedOccupiedMove {
  initiallyEmpty
  eventually (some u: User, r: Reading, d: Day, s: Slot |
    r in owned[u] and some (slotRows[u, d, s] - r) and
    move[u, r, d, s] and Book.outcome' = RejectedMove)
}

check EmptyBookSatisfiesInvariants for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 2 steps
check UniqueSlotsPreserved for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 2 steps
check ReadingIdentityPreserved for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 2 steps
check DailyCap for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 2 steps
check ReturnedRowsBelongToActor for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 2 steps
check OtherUsersRowsAreUnchanged for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 2 steps
check RejectedMovePreservesOriginal for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 2 steps
run FullDay for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 8 steps
run RejectedOccupiedMove for 4 but exactly 2 User, exactly 2 Day, exactly 5 Reading, 8 steps
