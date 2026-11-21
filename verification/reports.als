module reports

open util/ordering[Day] as calendar

sig User {}
abstract sig Month {}
one sig Older, Previous, Current extends Month {}

sig Day { month: one Month }
sig Reading { owner: one User, date: one Day }

one sig Selection {
  user: one User,
  selected: one Day
} { selected.month = Current }

fact CalendarMonths {
  all m: Month | some m.~month
  all earlier, later: Day |
    ((earlier.month = Older and later.month != Older) or
      (earlier.month = Previous and later.month = Current)) implies calendar/lt[earlier, later]
}

fun startOf[m: Month]: one Day {
  calendar/min[m.~month]
}

fun queried: set Reading {
  {r: Reading | r.owner = Selection.user and
    calendar/lte[startOf[Previous], r.date] and
    calendar/lte[r.date, Selection.selected]}
}

fun daily: set Reading {
  {r: queried | r.date = Selection.selected}
}

fun monthToDate: set Reading {
  {r: queried | calendar/lte[startOf[Current], r.date]}
}

fun monthly: set Reading {
  {r: queried | calendar/lt[r.date, startOf[Current]]}
}

assert DailyIsIncludedInMonthToDate {
  daily in monthToDate
}

assert PreviousMonthIsDisjoint {
  no monthly & (daily + monthToDate)
}

assert ReportsUseExactlyEligibleRows {
  all r: Reading | {
    (r in daily) iff (r.owner = Selection.user and r.date = Selection.selected)
    (r in monthToDate) iff (r.owner = Selection.user and
      r.date.month = Current and calendar/lte[r.date, Selection.selected])
    (r in monthly) iff (r.owner = Selection.user and r.date.month = Previous)
  }
}

pred AllReportsWithExcludedRows {
  some daily
  some monthToDate - daily
  some monthly
  some r: Reading | r.owner = Selection.user and r.date.month = Older
  some r: Reading | r.owner = Selection.user and calendar/lt[Selection.selected, r.date]
  some r: Reading | r.owner != Selection.user and r.date = Selection.selected
}

check DailyIsIncludedInMonthToDate for 6 but exactly 2 User, exactly 6 Day, exactly 6 Reading
check PreviousMonthIsDisjoint for 6 but exactly 2 User, exactly 6 Day, exactly 6 Reading
check ReportsUseExactlyEligibleRows for 6 but exactly 2 User, exactly 6 Day, exactly 6 Reading
run AllReportsWithExcludedRows for 6 but exactly 2 User, exactly 6 Day, exactly 6 Reading
