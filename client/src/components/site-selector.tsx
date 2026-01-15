import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building } from "lucide-react";
import type { Site } from "@shared/schema";

interface SiteSelectorProps {
  sites: Site[];
  selectedSiteId?: string;
  onSiteChange: (siteId: string | undefined) => void;
  company?: "mirae_abm" | "dawon_pmc";
}

export function SiteSelector({
  sites,
  selectedSiteId,
  onSiteChange,
  company,
}: SiteSelectorProps) {
  const filteredSites = company
    ? sites.filter((s) => s.company === company && s.isActive)
    : sites.filter((s) => s.isActive);

  return (
    <div className="flex items-center gap-2">
      <Building className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedSiteId || "all"}
        onValueChange={(val) => onSiteChange(val === "all" ? undefined : val)}
      >
        <SelectTrigger className="w-[200px]" data-testid="select-site">
          <SelectValue placeholder="현장 선택" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 현장</SelectItem>
          {filteredSites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
