import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth";

// ... (imports)

export type Company = "mirae_abm" | "dawon_pmc";

interface CompanyData {
    id: Company;
    name: string;
    logo: ReactNode;
    theme: {
        primary: string;
    };
}

export const COMPANIES: Record<Company, CompanyData> = {
    mirae_abm: {
        id: "mirae_abm",
        name: "미래에이비엠",
        logo: (
            <img src="/assets/images/logo_mirae_abm.png" alt="MIRAE ABM" className="h-8 w-auto object-contain" />
        ),
        theme: {
            primary: "hsl(221.2 83.2% 53.3%)", // Blue
        },
    },
    dawon_pmc: {
        id: "dawon_pmc",
        name: "다원피엠씨",
        logo: (
            <img src="/assets/images/logo_dawon_pmc.png" alt="DAWON PMC" className="h-8 w-auto object-contain" />
        ),
        theme: {
            primary: "hsl(221.2 83.2% 53.3%)", // Same blue for now, can perform adjustment
        },
    },
};

interface CompanyContextType {
    company: CompanyData;
    setCompany: (id: Company) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

// ... (CompanyProvider definition)

export function CompanyProvider({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth();
    const [companyId, setCompanyId] = useState<Company>(() => {
        // Try to get from local storage
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("selected_company") as Company;
            return (stored === "mirae_abm" || stored === "dawon_pmc") ? stored : "mirae_abm";
        }
        return "mirae_abm";
    });

    useEffect(() => {
        if (!isLoading && user?.company && (user.company === "mirae_abm" || user.company === "dawon_pmc")) {
            setCompanyId(user.company);
            localStorage.setItem("selected_company", user.company);
        }
    }, [user, isLoading]);

    const company = COMPANIES[companyId];

    const value = {
        company,
        setCompany: (id: Company) => {
            setCompanyId(id);
            localStorage.setItem("selected_company", id);
        },
    };

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
}

export function useCompany() {
    const context = useContext(CompanyContext);
    if (!context) {
        throw new Error("useCompany must be used within a CompanyProvider");
    }
    return context;
}
