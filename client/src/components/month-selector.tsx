import { format, addMonths, subMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { getKSTNow } from "@shared/kst-utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
  const goToPrevMonth = () => {
    onMonthChange(subMonths(selectedMonth, 1));
  };

  const goToNextMonth = () => {
    onMonthChange(addMonths(selectedMonth, 1));
  };

  const goToCurrentMonth = () => {
    onMonthChange(getKSTNow());
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={goToPrevMonth}
        data-testid="button-prev-month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[140px] text-center">
        <span className="font-semibold text-lg">
          {format(selectedMonth, "yyyy년 M월", { locale: ko })}
        </span>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={goToNextMonth}
        data-testid="button-next-month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={goToCurrentMonth}
        className="ml-2"
        data-testid="button-today"
      >
        <CalendarDays className="h-4 w-4 mr-2" />
        오늘
      </Button>
    </div>
  );
}
