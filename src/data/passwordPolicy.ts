import { type RandomInt, characterFrom } from './alphabet.js';

/**
 * The Book Store login field carries the pattern
 * `^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})$`, and the
 * account API rejects registrations that breach it. Encoding the rule here
 * keeps seeded accounts valid and gives failures a name rather than a
 * pass or fail bit.
 */

type CharacterRequirement = {
  readonly id: string;
  readonly alphabet: string;
};

const CHARACTER_REQUIREMENTS: readonly CharacterRequirement[] = [
  { id: 'lowercase', alphabet: 'abcdefghijklmnopqrstuvwxyz' },
  { id: 'uppercase', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { id: 'digit', alphabet: '0123456789' },
  { id: 'symbol', alphabet: '!@#$%^&*' },
];

const MINIMUM_LENGTH = 8;
const MINIMUM_LENGTH_REQUIREMENT_ID = 'minimumLength';
const DEFAULT_LENGTH = 16;

const COMBINED_ALPHABET = CHARACTER_REQUIREMENTS.map((requirement) => requirement.alphabet).join(
  '',
);

export const PASSWORD_REQUIREMENT_IDS: readonly string[] = [
  ...CHARACTER_REQUIREMENTS.map((requirement) => requirement.id),
  MINIMUM_LENGTH_REQUIREMENT_ID,
];

/**
 * The alphabets are ASCII constants, so decomposing the password into UTF-16
 * code units is exactly the comparison wanted: a character outside every
 * alphabet correctly matches none of them.
 */
const containsAnyOf = (password: string, alphabet: string): boolean =>
  // eslint-disable-next-line @typescript-eslint/no-misused-spread
  [...password].some((character) => alphabet.includes(character));

export const unmetPasswordRequirements = (password: string): readonly string[] => {
  const unmetCharacterRequirements = CHARACTER_REQUIREMENTS.filter(
    (requirement) => !containsAnyOf(password, requirement.alphabet),
  ).map((requirement) => requirement.id);

  return password.length < MINIMUM_LENGTH
    ? [...unmetCharacterRequirements, MINIMUM_LENGTH_REQUIREMENT_ID]
    : unmetCharacterRequirements;
};

export const satisfiesPasswordPolicy = (password: string): boolean =>
  unmetPasswordRequirements(password).length === 0;

export type GeneratePasswordOptions = {
  readonly randomInt: RandomInt;
  readonly length?: number;
};

export type { RandomInt };

export const generatePassword = ({
  randomInt,
  length = DEFAULT_LENGTH,
}: GeneratePasswordOptions): string => {
  if (length < MINIMUM_LENGTH) {
    throw new Error(`Password length must be at least ${MINIMUM_LENGTH}, received ${length}`);
  }

  const mandated = CHARACTER_REQUIREMENTS.map((requirement) =>
    characterFrom(requirement.alphabet, randomInt),
  );
  const filler = Array.from({ length: length - CHARACTER_REQUIREMENTS.length }, () =>
    characterFrom(COMBINED_ALPHABET, randomInt),
  );

  return [...mandated, ...filler].join('');
};
