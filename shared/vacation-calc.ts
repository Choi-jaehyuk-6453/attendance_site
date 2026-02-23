import { differenceInMonths, differenceInYears, addYears, addMonths } from "date-fns";

/**
 * 근로기준법에 따른 연차 발생일수 계산
 *
 * 가. 1년 미만: 1개월 근무 다음날 1일 발생 (최대 11일), 1년 다음날 초기화
 * 나. 1년 이상: 1년 다음날 15일 발생, 매년 입사일 기준 초기화
 * 다. 3년 이상: 15일 + 매 2년마다 1일 가산 (최대 25일), 매년 초기화
 *
 * 유효기간: 입사일 기준 매 1년 다음날 초기화
 */
export function calculateAnnualLeave(hireDate: string | Date, referenceDate: string | Date = new Date()): {
    totalDays: number;
    description: string;
    yearsWorked: number;
    monthsWorked: number;
    periodStart: string; // 현재 유효기간 시작일
    periodEnd: string;   // 현재 유효기간 종료일
} {
    const hire = typeof hireDate === "string" ? new Date(hireDate) : hireDate;
    const ref = typeof referenceDate === "string" ? new Date(referenceDate) : referenceDate;

    if (hire > ref) {
        return { totalDays: 0, description: "입사 전", yearsWorked: 0, monthsWorked: 0, periodStart: "", periodEnd: "" };
    }

    const totalMonths = differenceInMonths(ref, hire);
    const totalYears = differenceInYears(ref, hire);

    // 1년 미만: 매월 1일씩 발생 (최대 11일)
    // 유효기간: 입사일 ~ 입사 1년 다음날 전까지
    if (totalYears < 1) {
        const days = Math.min(totalMonths, 11);
        const periodStart = formatDate(hire);
        const periodEnd = formatDate(addYears(hire, 1));
        return {
            totalDays: days,
            description: `1년 미만 (${totalMonths}개월 근무) → ${days}일`,
            yearsWorked: 0,
            monthsWorked: totalMonths,
            periodStart,
            periodEnd,
        };
    }

    // 1년 이상: 15일 기본, 3년 이상 가산
    // 유효기간: 매년 입사일 기준 초기화
    // 현재 기간: 가장 최근 입사일 기념일 ~ 다음 기념일
    const currentPeriodStart = addYears(hire, totalYears);
    const currentPeriodEnd = addYears(hire, totalYears + 1);

    let days = 15;
    if (totalYears >= 3) {
        const extraDays = Math.floor((totalYears - 1) / 2);
        days = Math.min(15 + extraDays, 25);
    }

    return {
        totalDays: days,
        description: `${totalYears}년차 → ${days}일`,
        yearsWorked: totalYears,
        monthsWorked: totalMonths,
        periodStart: formatDate(currentPeriodStart),
        periodEnd: formatDate(currentPeriodEnd),
    };
}

function formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
