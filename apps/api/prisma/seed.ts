import { getReportingTimeZone } from "../src/config";
import { connectDatabase } from "../src/database";
import { ReadingSlot } from "../src/generated/prisma/client";

const email = "demo@sweety.example.invalid";
const password = "sweety-demo-2026";
const prisma = connectDatabase();

const slots = [
  { slot: ReadingSlot.MORNING_FASTING, time: "07:15", value: 104 },
  { slot: ReadingSlot.AFTER_BREAKFAST, time: "09:05", value: 146 },
  { slot: ReadingSlot.AFTER_LUNCH, time: "13:10", value: 131 },
  { slot: ReadingSlot.AFTER_DINNER, time: "19:20", value: 119 },
] as const;

async function seed() {
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      name: "Demo Patient",
      email,
      passwordHash,
      timeZone: getReportingTimeZone(),
    },
    update: {},
    select: { id: true, timeZone: true },
  });

  const today = Temporal.Now.plainDateISO(user.timeZone);
  const monthStart = today.with({ day: 1 });
  const previousStart = monthStart.subtract({ months: 1 });
  const previousEnd = monthStart.subtract({ days: 1 });
  const days = [
    today,
    previousStart,
    previousStart.add({ days: 13 }),
    previousEnd,
  ];
  if (today.day > 1) days.push(monthStart);
  if (today.day > 4) days.push(today.subtract({ days: 3 }));

  const readings = days.flatMap((day, index) =>
    slots.slice(0, index === 0 ? 4 : 2).flatMap(({ slot, time, value }) => {
      const zoned = day.toZonedDateTime({
        timeZone: user.timeZone,
        plainTime: time,
      });
      if (!zoned.toPlainDate().equals(day)) return [];
      return [
        {
          userId: user.id,
          slot,
          value: value + (index === 0 ? 0 : index * 4 - 12),
          date: new Date(`${day}T00:00:00Z`),
          recordedAt: new Date(zoned.epochMilliseconds),
        },
      ];
    }),
  );

  const result = await prisma.reading.createMany({
    data: readings,
    skipDuplicates: true,
  });
  console.log(
    `Demo account ${email} is ready. Added ${result.count} sample readings.`,
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
