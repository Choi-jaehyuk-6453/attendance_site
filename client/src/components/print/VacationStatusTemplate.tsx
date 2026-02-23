import { forwardRef } from "react";
import { format } from "date-fns";
import { logoBase64, logoDawonBase64, logoMiraeBase64 } from "@/lib/logos";

interface VacationBalance {
    userId: string;
    name: string;
    siteName: string;
    jobTitle: string;
    hireDate: string | null;
    totalEntitlement: number;
    usedDays: number;
    remainingDays: number;
    vacationHistory: {
        startDate: string;
        endDate: string;
        type: string;
        days: number;
    }[];
}

interface Props {
    data: VacationBalance[];
    siteName?: string;
    year: string;
    companyId?: string;
}

const VACATION_TYPES: Record<string, string> = {
    annual: "연차",
    half_day: "반차",
    sick: "병가",
    family_event: "경조사",
    other: "기타",
};

export const VacationStatusTemplate = forwardRef<HTMLDivElement, Props>(({ data, siteName, year, companyId }, ref) => {
    const today = new Date();
    const formattedDate = format(today, "yyyy년 MM월 dd일");

    const getLogoBase64 = (id?: string) => {
        if (id === "mirae_abm" || id === "미래에이비엠") return logoMiraeBase64;
        if (id === "dawon_pmc" || id === "다원피엠씨") return logoDawonBase64;
        return logoBase64;
    };

    return (
        <div ref={ref} className="bg-white p-8 w-[297mm] h-[210mm] mx-auto text-black relative" style={{ fontFamily: "serif" }}>
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <img
                    src={getLogoBase64(companyId)}
                    alt="Company Logo"
                    className="w-[120mm] h-auto object-contain"
                    style={{ opacity: 0.1, filter: "grayscale(100%)" }}
                />
            </div>

            <div className="relative z-10">
                <h1 className="text-3xl font-bold text-center mb-4">{year}년 휴가 현황</h1>
                <div className="flex justify-between items-end mb-4 border-b pb-2">
                    <div className="text-lg font-bold">
                        {siteName ? `현장: ${siteName}` : "전체 현장"}
                    </div>
                    <div className="text-sm">
                        출력일: {formattedDate}
                    </div>
                </div>

                <table className="w-full border-collapse border border-black text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-black p-2 w-[15%]">이름</th>
                            <th className="border border-black p-2 w-[15%]">현장</th>
                            <th className="border border-black p-2 w-[15%]">입사일</th>
                            <th className="border border-black p-2 w-12">총연차</th>
                            <th className="border border-black p-2 w-12">사용</th>
                            <th className="border border-black p-2 w-12">잔여</th>
                            <th className="border border-black p-2 w-auto">휴가 사용 내역</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row) => (
                            <tr key={row.userId}>
                                <td className="border border-black p-2 text-center font-bold">{row.name}</td>
                                <td className="border border-black p-2 text-center">{row.siteName}</td>
                                <td className="border border-black p-2 text-center">{row.hireDate}</td>
                                <td className="border border-black p-2 text-center">{row.totalEntitlement}</td>
                                <td className="border border-black p-2 text-center">{row.usedDays}</td>
                                <td className="border border-black p-2 text-center font-bold">{row.remainingDays}</td>
                                <td className="border border-black p-2">
                                    <div className="flex flex-wrap gap-1">
                                        {row.vacationHistory.map((h, i) => (
                                            <span key={i} className="inline-block border rounded px-1 text-xs whitespace-nowrap">
                                                {format(new Date(h.startDate), "MM/dd")}
                                                {h.startDate !== h.endDate && `~${format(new Date(h.endDate), "MM/dd")}`}
                                                ({VACATION_TYPES[h.type] || h.type})
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});
