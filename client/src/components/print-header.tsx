import { useCompany } from "@/lib/company";

export function PrintHeader() {
    const { company } = useCompany();

    return (
        <div className="hidden print:flex flex-col items-center justify-center mb-8 border-b pb-4">
            <div className="w-48 h-16 mb-2 flex items-center justify-center">
                {company.logo}
            </div>
            <h1 className="text-2xl font-bold mt-2">{company.name}</h1>
            <p className="text-sm text-gray-500">Generated Report</p>
        </div>
    );
}
