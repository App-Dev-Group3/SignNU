require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
const DRY_RUN = process.argv.includes('--dry-run');

const looksLikeMi = (value) => {
  if (!value) return false;
  const cleaned = value.replace('.', '').trim();
  return cleaned.length === 1;
};

const cleanMi = (value) => {
  if (!value) return '';
  return value.replace('.', '').trim().charAt(0).toUpperCase();
};

const tokenizeName = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const splitLegacyName = (username, fallbackMi) => {
  const parts = tokenizeName(username);
  if (parts.length < 2) {
    return null;
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: parts[1],
      middleInitial: cleanMi(fallbackMi),
    };
  }

  const second = parts[1];
  const last = parts[parts.length - 1];

  // Legacy bug pattern: First MI Last ...
  if (looksLikeMi(second)) {
    return {
      firstName: parts[0],
      lastName: parts.slice(2).join(' '),
      middleInitial: cleanMi(second),
    };
  }

  // Current target pattern: First Last ... MI
  if (looksLikeMi(last)) {
    return {
      firstName: parts[0],
      lastName: parts.slice(1, -1).join(' '),
      middleInitial: cleanMi(last),
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    middleInitial: cleanMi(fallbackMi),
  };
};

const buildUsername = (firstName, lastName, middleInitial) => {
  return [firstName, lastName, middleInitial]
    .filter((part) => part && part.toString().trim().length > 0)
    .join(' ');
};

const main = async () => {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set in environment.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const usersCollection = mongoose.connection.collection('users');

  const cursor = usersCollection.find({
    $or: [
      { firstName: { $exists: false } },
      { lastName: { $exists: false } },
      { firstName: '' },
      { lastName: '' },
      { mi: { $exists: true } },
    ],
  });

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  while (await cursor.hasNext()) {
    const user = await cursor.next();
    scanned += 1;

    const rawMi = user.middleInitial || user.mi || '';
    const normalizedFirst = (user.firstName || '').trim();
    const normalizedLast = (user.lastName || '').trim();
    const normalizedMi = cleanMi(rawMi);

    let nextFirst = normalizedFirst;
    let nextLast = normalizedLast;
    let nextMi = normalizedMi;

    if (!nextFirst || !nextLast) {
      const parsed = splitLegacyName(user.username, rawMi);
      if (!parsed || !parsed.firstName || !parsed.lastName) {
        skipped += 1;
        console.warn(`Skipping user ${user._id}: unable to parse username "${user.username || ''}"`);
        continue;
      }

      nextFirst = parsed.firstName;
      nextLast = parsed.lastName;
      nextMi = parsed.middleInitial || nextMi;
    }

    const nextUsername = buildUsername(nextFirst, nextLast, nextMi);
    const changed =
      nextFirst !== (user.firstName || '') ||
      nextLast !== (user.lastName || '') ||
      nextMi !== (user.middleInitial || '') ||
      nextUsername !== (user.username || '') ||
      user.mi !== undefined;

    if (!changed) {
      skipped += 1;
      continue;
    }

    const update = {
      $set: {
        firstName: nextFirst,
        lastName: nextLast,
        middleInitial: nextMi,
        username: nextUsername,
      },
      $unset: {
        mi: '',
      },
    };

    if (!DRY_RUN) {
      await usersCollection.updateOne({ _id: user._id }, update);
    }

    updated += 1;
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}Updated ${user._id}: ${user.username || ''} -> ${nextUsername}`);
  }

  console.log('--- Migration Summary ---');
  console.log(`Scanned: ${scanned}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Mode: ${DRY_RUN ? 'dry-run (no writes)' : 'apply'}`);

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Migration failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
