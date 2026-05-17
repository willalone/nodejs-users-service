// В задании возраст не указан — взяла 14–150 лет как разумные границы.
export const MIN_USER_AGE_YEARS = 14;
export const MAX_USER_AGE_YEARS = 150;

const toUtcDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

export const validateBirthDateString = (value: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'Use ISO date YYYY-MM-DD';
  }

  const birth = toUtcDate(value);
  if (Number.isNaN(birth.getTime())) {
    return 'Invalid date';
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (birth > today) {
    return 'birthDate cannot be in the future';
  }

  const oldest = new Date(today);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_USER_AGE_YEARS);
  if (birth < oldest) {
    return `birthDate cannot be more than ${MAX_USER_AGE_YEARS} years ago`;
  }

  const youngest = new Date(today);
  youngest.setUTCFullYear(youngest.getUTCFullYear() - MIN_USER_AGE_YEARS);
  if (birth > youngest) {
    return `User must be at least ${MIN_USER_AGE_YEARS} years old`;
  }

  return null;
};
