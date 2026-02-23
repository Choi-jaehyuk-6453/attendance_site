
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

interface EmailListEditorProps {
    value: string; // Comma separated string from DB
    onChange: (value: string) => void;
    placeholder?: string;
}

export function EmailListEditor({ value, onChange, placeholder = "example@email.com" }: EmailListEditorProps) {
    const [emails, setEmails] = useState<string[]>([]);
    const [newItem, setNewItem] = useState("");

    useEffect(() => {
        // Initialize from prop
        if (value) {
            setEmails(value.split(',').map(s => s.trim()).filter(Boolean));
        } else {
            setEmails([]);
        }
    }, [value]);

    const handleAdd = () => {
        if (newItem && newItem.trim()) {
            const updated = [...emails, newItem.trim()];
            setEmails(updated);
            onChange(updated.join(',')); // Sync back to parent as string
            setNewItem("");
        }
    };

    const handleRemove = (index: number) => {
        const updated = emails.filter((_, i) => i !== index);
        setEmails(updated);
        onChange(updated.join(','));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {emails.map((email, index) => (
                    <div key={index} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
                        <span>{email}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 hover:bg-destructive/20 rounded-full"
                            onClick={() => handleRemove(index)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-1"
                    type="email"
                />
                <Button type="button" onClick={handleAdd} size="sm" variant="secondary">
                    <Plus className="h-4 w-4 mr-1" />
                    추가
                </Button>
            </div>
        </div>
    );
}
