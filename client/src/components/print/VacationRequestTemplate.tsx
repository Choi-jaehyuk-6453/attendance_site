import { forwardRef } from "react";
import type { VacationRequest, User } from "@shared/schema";
import { format } from "date-fns";

interface Props {
    request: VacationRequest;
    user: User | undefined;
    siteName: string;
    companyId?: string; // "mirae_abm" | "dawon_pmc"
}

const VACATION_TYPES: Record<string, string> = {
    annual: "연차",
    half_day: "반차",
    sick: "병가",
    family_event: "경조사",
    other: "기타",
};

export const VacationRequestTemplate = forwardRef<HTMLDivElement, Props>(({ request, user, siteName, companyId = "mirae_abm" }, ref) => {
    if (!user) return null;

    const today = new Date();
    const formattedDate = format(today, "yyyy년 MM월 dd일");

    // Company-specific settings
    const companySettings = {
        mirae_abm: {
            name: "株式會社 미래에이비엠",
            logo: "/assets/images/logo_mirae_abm.png" // Assuming this path exists or we use the one from public
        },
        dawon_pmc: {
            name: "다원피엠씨",
            logo: "/assets/images/logo_dawon_pmc.png"
        }
    };

    const settings = companySettings[companyId as keyof typeof companySettings] || companySettings.mirae_abm;

    // We need to ensure the logo path is correct. Based on `client/src/lib/company.tsx`, logos might be in /assets/images/
    // Let's assume the logos are accessible via public URL or we need to import them if they are assets.
    // For print, <img src> with public path usually works if the server serves static files correctly.

    return (
        <div ref={ref} className="bg-white p-8 w-[210mm] mx-auto text-black relative" style={{ fontFamily: "serif", minHeight: "297mm" }}>

            {/* Watermark */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.25] z-0 overflow-hidden">
                {/* Using the logo as watermark */}
                <img src={settings.logo} alt="Watermark" className="w-[80%] object-contain grayscale" />
            </div>

            <div className="relative z-10">
                <h1 className="text-3xl font-bold text-center mb-8">휴가 사용신청서</h1>

                <div className="text-right mb-2">
                    승인여부 : <span className="font-bold">{request.status === "approved" ? "승인" : request.status === "rejected" ? "반려" : "대기"}</span>
                </div>

                <table className="w-full border-collapse border border-black mb-8">
                    <tbody>
                        <tr>
                            <td className="border border-black p-2 bg-gray-100 text-center font-bold w-32 align-middle">소 속</td>
                            <td className="border border-black p-2 align-middle" colSpan={3}>{siteName}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 bg-gray-100 text-center font-bold align-middle">직 책</td>
                            <td className="border border-black p-2 w-48 align-middle">{user.jobTitle || "근로자"}</td>
                            <td className="border border-black p-2 bg-gray-100 text-center font-bold w-32 align-middle">성 명</td>
                            <td className="border border-black p-2 align-middle">{user.name}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 bg-gray-100 text-center font-bold align-middle">기 간</td>
                            <td className="border border-black p-2 align-middle" colSpan={2}>
                                {request.startDate} 부터<br />
                                {request.endDate} 까지
                            </td>
                            <td className="border border-black p-2 text-center align-middle">
                                ( {request.days} ) 일
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 bg-gray-100 text-center font-bold align-middle">휴가유형</td>
                            <td className="border border-black p-2 align-middle" colSpan={3}>
                                {VACATION_TYPES[request.vacationType] || request.vacationType}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 bg-gray-100 text-center font-bold h-32 align-middle">사 유</td>
                            <td className="border border-black p-2 align-top" colSpan={3}>
                                {request.reason}
                            </td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 bg-gray-100 text-center font-bold align-middle" rowSpan={2}>연락처</td>
                            <td className="border border-black p-2 bg-gray-50 text-center w-24 align-middle">휴대전화</td>
                            <td className="border border-black p-2 align-middle" colSpan={2}>{user.phone}</td>
                        </tr>
                        <tr>
                            <td className="border border-black p-2 bg-gray-50 text-center align-middle">기타 연락처</td>
                            <td className="border border-black p-2 align-middle" colSpan={2}></td>
                        </tr>
                    </tbody>
                </table>

                <div className="text-center space-y-8 mt-16 mb-24">
                    <p className="text-lg">본인은 위와 같은 사유로 연차휴가를 사용하고자 하오니</p>
                    <p className="text-lg">재가하여 주시기 바랍니다.</p>
                </div>

                <div className="text-center mb-16">
                    <p className="text-lg mb-8">{formattedDate}</p>
                    <div className="flex justify-center items-center gap-4">
                        <span className="text-lg">신청인 :</span>
                        <span className="text-xl font-bold">{user.name}</span>
                        <span className="text-lg">(로그인으로 서명 대체)</span>
                    </div>
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold">{settings.name} 귀중</h2>
                </div>
            </div>
        </div>
    );
});
