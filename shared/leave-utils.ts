import { differenceInDays, differenceInMonths, differenceInYears, addYears, addMonths, isAfter, isBefore, startOfDay } from "date-fns";

export interface LeaveAccrual {
  period: string;
  accrued: number;
  used: number;
  remaining: number;
  expiresAt: Date;
  isExpired: boolean;
}

export interface LeaveBalance {
  totalAccrued: number;
  totalUsed: number;
  totalRemaining: number;
  accruals: LeaveAccrual[];
  yearsOfService: number;
  monthsOfService: number;
}

export function calculateAnnualLeave(
  hireDate: Date,
  usedDays: number,
  referenceDate: Date = new Date()
): LeaveBalance {
  const today = startOfDay(referenceDate);
  const hire = startOfDay(hireDate);
  
  const yearsOfService = differenceInYears(today, hire);
  const monthsOfService = differenceInMonths(today, hire);
  
  const accruals: LeaveAccrual[] = [];
  let totalAccrued = 0;

  if (yearsOfService < 1) {
    const completedMonths = monthsOfService;
    for (let month = 1; month <= completedMonths && month <= 11; month++) {
      const accrualDate = addMonths(hire, month);
      const expiresAt = addYears(hire, 1);
      const isExpired = isAfter(today, expiresAt);
      
      if (!isExpired) {
        accruals.push({
          period: `입사 ${month}개월차`,
          accrued: 1,
          used: 0,
          remaining: 1,
          expiresAt,
          isExpired,
        });
        totalAccrued += 1;
      }
    }
  } else {
    const baseAnnualDays = 15;
    let bonusDays = 0;
    
    if (yearsOfService >= 3) {
      bonusDays = Math.floor((yearsOfService - 1) / 2);
      if (bonusDays > 10) bonusDays = 10;
    }
    
    const totalAnnualDays = baseAnnualDays + bonusDays;
    
    const currentYearStart = addYears(hire, yearsOfService);
    const currentYearEnd = addYears(hire, yearsOfService + 1);
    const expiresAt = addYears(currentYearStart, 1);
    const isExpired = isAfter(today, expiresAt);
    
    if (!isExpired && isAfter(today, currentYearStart)) {
      accruals.push({
        period: `${yearsOfService}년차 연차`,
        accrued: totalAnnualDays,
        used: 0,
        remaining: totalAnnualDays,
        expiresAt,
        isExpired,
      });
      totalAccrued = totalAnnualDays;
    }
  }

  let remainingUsed = usedDays;
  for (const accrual of accruals) {
    if (remainingUsed <= 0) break;
    const useFromThis = Math.min(remainingUsed, accrual.accrued);
    accrual.used = useFromThis;
    accrual.remaining = accrual.accrued - useFromThis;
    remainingUsed -= useFromThis;
  }

  const totalRemaining = Math.max(0, totalAccrued - usedDays);

  return {
    totalAccrued,
    totalUsed: usedDays,
    totalRemaining,
    accruals,
    yearsOfService,
    monthsOfService,
  };
}

export function getVacationTypeName(type: string): string {
  switch (type) {
    case "annual": return "연차";
    case "half_day": return "반차";
    case "sick": return "병가";
    case "other": return "기타";
    default: return type;
  }
}

export function getVacationStatusName(status: string): string {
  switch (status) {
    case "pending": return "대기중";
    case "approved": return "승인";
    case "rejected": return "반려";
    default: return status;
  }
}

export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  return differenceInDays(endDate, startDate) + 1;
}
