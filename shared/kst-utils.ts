import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const KST_TIMEZONE = "Asia/Seoul";

export function getKSTNow(): Date {
  return toZonedTime(new Date(), KST_TIMEZONE);
}

export function getKSTToday(): string {
  return format(getKSTNow(), "yyyy-MM-dd");
}

export function getKSTCurrentMonth(): string {
  return format(getKSTNow(), "yyyy-MM");
}

export function getKSTYear(): number {
  return getKSTNow().getFullYear();
}

export function formatKSTDate(date: Date, formatStr: string): string {
  const kstDate = toZonedTime(date, KST_TIMEZONE);
  return format(kstDate, formatStr);
}
