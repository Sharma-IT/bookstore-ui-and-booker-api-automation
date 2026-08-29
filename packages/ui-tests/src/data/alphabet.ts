/** Draws an integer in `[0, exclusiveMax)`. Injected so generation is testable. */
export type RandomInt = (exclusiveMax: number) => number;

export const characterAt = (alphabet: string, index: number): string => {
  const character = alphabet[index];

  if (character === undefined) {
    throw new Error(
      `Random index ${index} is out of range for an alphabet of length ${alphabet.length}`,
    );
  }

  return character;
};

export const characterFrom = (alphabet: string, randomInt: RandomInt): string =>
  characterAt(alphabet, randomInt(alphabet.length));
