import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building2, MapPin, Trash2 } from "lucide-react";
import type { Site } from "@shared/schema";

const siteSchema = z.object({
  name: z.string().min(1, "현장명을 입력해주세요"),
  address: z.string().optional(),
  company: z.enum(["mirae_abm", "dawon_pmc"]),
});

type SiteForm = z.infer<typeof siteSchema>;

export default function SitesPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const form = useForm<SiteForm>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: "",
      address: "",
      company: "mirae_abm",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SiteForm) => {
      const res = await apiRequest("POST", "/api/sites", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "현장 등록 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "현장 등록 완료",
        description: "새 현장이 등록되었습니다.",
      });
    },
    onError: (error: Error) => {
      console.error("Site creation error:", error);
      toast({
        variant: "destructive",
        title: "등록 실패",
        description: error.message || "현장 등록 중 오류가 발생했습니다.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({
        title: "삭제 완료",
        description: "현장이 삭제되었습니다.",
      });
    },
  });

  const onSubmit = (data: SiteForm) => {
    createMutation.mutate(data);
  };

  const miraeSites = sites.filter((s) => s.company === "mirae_abm");
  const dawonSites = sites.filter((s) => s.company === "dawon_pmc");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">현장 관리</h1>
          <p className="text-muted-foreground">
            총 {sites.length}개의 현장이 등록되어 있습니다
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-site">
              <Plus className="h-4 w-4 mr-2" />
              현장 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 현장 등록</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>현장명</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="현장명을 입력하세요"
                          data-testid="input-site-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>주소</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="주소를 입력하세요 (선택)"
                          data-testid="input-site-address"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>소속 법인</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-company">
                            <SelectValue placeholder="법인 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="mirae_abm">미래에이비엠</SelectItem>
                          <SelectItem value="dawon_pmc">다원피엠씨</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-site"
                >
                  {createMutation.isPending ? "등록 중..." : "현장 등록"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SiteList
            title="미래에이비엠"
            sites={miraeSites}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
          <SiteList
            title="다원피엠씨"
            sites={dawonSites}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </div>
      )}
    </div>
  );
}

function SiteList({
  title,
  sites,
  onDelete,
}: {
  title: string;
  sites: Site[];
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {title}
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            {sites.length}개
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sites.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            등록된 현장이 없습니다
          </p>
        ) : (
          sites.map((site) => (
            <div
              key={site.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              data-testid={`card-site-${site.id}`}
            >
              <div>
                <p className="font-medium">{site.name}</p>
                {site.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {site.address}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(site.id)}
                data-testid={`button-delete-site-${site.id}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
