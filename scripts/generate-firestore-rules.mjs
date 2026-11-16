#!/usr/bin/env node
/**
 * Generates firestore.rules and firestore.indexes.json from the schema.
 *
 *     node scripts/generate-firestore-rules.mjs
 *
 * Generated rather than hand-written so the database's idea of a valid day cannot
 * drift from the application's. Change packages/domain/schema.js and re-run.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { morningProgramSchema, devoteesData } from '../packages/domain/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TIME_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';
const DATE_PATTERN = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

const typeClause = (field) => {
	const ref = `d.${field.key}`;
	if (field.type === 'number') {
		return `(${ref} == null || (${ref} is int && ${ref} >= 0 && ${ref} <= ${field.max}))`;
	}
	if (field.type === 'boolean') {
		return `(${ref} == null || ${ref} is bool)`;
	}
	return `(${ref} == null || (${ref} is string && ${ref}.matches('${TIME_PATTERN}')))`;
};

const knownKeys = [
	"'devoteeId'",
	"'date'",
	"'createdAt'",
	"'updatedAt'",
	...morningProgramSchema.map((f) => `'${f.key}'`),
];

const rules = `rules_version = '2';

/*
 * Rules for the sadhana collection. GENERATED - see
 * scripts/generate-firestore-rules.mjs. Change the schema and regenerate.
 *
 * There is no auth yet, so these cannot answer "who are you". What they can do -
 * and what this project previously had none of - is enforce the SHAPE of a write.
 *
 * Without that, Firestore accepts any field name from any client, so a typo
 * becomes a permanent extra field and nobody finds out. It also accepted a number
 * where a boolean belonged, which is precisely how minutes once got written into
 * a yes/no field and silently scored as "no" on every screen.
 */
service cloud.firestore {
  match /databases/{database}/documents {

    function isKnownDevotee(id) {
      return id in [${devoteesData.map((d) => `'${d.id}'`).join(', ')}];
    }

    function isDateKey(value) {
      return value is string && value.matches('${DATE_PATTERN}');
    }

    // Exactly the schema's fields, plus identity and audit. Nothing else.
    function hasOnlyKnownFields(d) {
      return d.keys().hasOnly([
        ${knownKeys.join(',\n        ')}
      ]);
    }

    function typesAreValid(d) {
      return ${morningProgramSchema.map(typeClause).join('\n        && ')};
    }

    match /days/{dayId} {
      allow read: if true;

      allow create, update: if
        // the id must name the day it holds, so a client cannot write a record
        // that claims to belong to a different devotee or date
        dayId == request.resource.data.devoteeId + '_' + request.resource.data.date
        && isKnownDevotee(request.resource.data.devoteeId)
        && isDateKey(request.resource.data.date)
        && hasOnlyKnownFields(request.resource.data)
        && typesAreValid(request.resource.data);

      // Days get corrected, not removed.
      allow delete: if false;
    }
  }
}
`;

/*
 * Range queries on `date` alone use the automatic single-field index. Narrowing
 * to one devotee AND a date range needs this composite one - see
 * listDevoteeMonth in packages/data/repository.js.
 */
const indexes = {
	indexes: [
		{
			collectionGroup: 'days',
			queryScope: 'COLLECTION',
			fields: [
				{ fieldPath: 'devoteeId', order: 'ASCENDING' },
				{ fieldPath: 'date', order: 'ASCENDING' },
			],
		},
	],
	fieldOverrides: [],
};

writeFileSync(join(ROOT, 'firestore.rules'), rules);
writeFileSync(join(ROOT, 'firestore.indexes.json'), `${JSON.stringify(indexes, null, 2)}\n`);

console.log(`firestore.rules        ${rules.split('\n').length} lines`);
console.log(`firestore.indexes.json ${indexes.indexes.length} composite index`);
console.log(`covering ${morningProgramSchema.length} fields and ${devoteesData.length} devotees`);
