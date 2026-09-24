export type ParsedDate = { year: number; month: number; day: number };

export function formatDateInput(date: ParsedDate) {
  return `${date.year}年${String(date.month).padStart(2, '0')}月${String(date.day).padStart(2, '0')}日`;
}

export function expandYear(year: number, currentYear = new Date().getFullYear()) {
  return year > currentYear % 100 ? 1900 + year : 2000 + year;
}

function makeDate(year: number, month: number, day: number): ParsedDate | null {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null;
}

export function parseDateInput(
  value: string,
  currentYear = new Date().getFullYear()
): ParsedDate | null {
  const input = value.trim();
  if (/^\d{6}(?:\d{2})?$/.test(input)) {
    const yearLength = input.length - 4;
    const rawYear = Number(input.slice(0, yearLength));
    const year = yearLength === 2 ? expandYear(rawYear, currentYear) : rawYear;
    return makeDate(year, Number(input.slice(yearLength, yearLength + 2)), Number(input.slice(-2)));
  }

  if (/^\d{2}(?:\d{2})?[-/.,，\s]+\d{1,2}[-/.,，\s]+\d{1,2}$/.test(input)) {
    const [rawYear, month, day] = input.split(/[-/.,，\s]+/).map(Number);
    return makeDate(rawYear < 100 ? expandYear(rawYear, currentYear) : rawYear, month, day);
  }

  const chinese = /^(\d{2}|\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(input);
  if (chinese) {
    const [, rawYear, month, day] = chinese.map(Number);
    return makeDate(rawYear < 100 ? expandYear(rawYear, currentYear) : rawYear, month, day);
  }

  const date = new Date(input);
  return Number.isNaN(date.getTime())
    ? null
    : { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}
