
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

interface EmailRecipientSelectorProps {
    presets: string[]; // List of available emails (e.g. from site config)
    value: string; // Current comma-separated value
    onChange: (value: string) => void;
    placeholder?: string;
}

export function EmailRecipientSelector({ presets, value, onChange, placeholder }: EmailRecipientSelectorProps) {
    // Helper to parse current value into array
    const getCurrentEmails = () => value.split(',').map(s => s.trim()).filter(Boolean);

    const isChecked = (email: string) => {
        return getCurrentEmails().includes(email);
    };

    const handleToggle = (email: string, checked: boolean) => {
        let current = getCurrentEmails();
        if (checked) {
            if (!current.includes(email)) {
                current.push(email);
            }
        } else {
            current = current.filter(e => e !== email);
        }
        onChange(current.join(', '));
    };

    return (
        <div className="space-y-3">
            {presets.length > 0 && (
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">저장된 담당자 (선택)</Label>
                    <div className="flex flex-wrap gap-4">
                        {presets.map((email, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`preset-${idx}`}
                                    checked={isChecked(email)}
                                    onCheckedChange={(checked) => handleToggle(email, checked as boolean)}
                                />
                                <Label htmlFor={`preset-${idx}`} className="text-sm cursor-pointer font-normal">
                                    {email}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">받는 사람 (직접 입력 가능)</Label>
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder || "example@email.com, another@email.com"}
                />
            </div>
        </div>
    );
}
