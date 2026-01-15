import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogIn } from "lucide-react";
import miraeLogoPath from "@assets/미래ABM_LOGO_1768444471519.png";

const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      login(data.user);
      toast({
        title: "로그인 성공",
        description: `${data.user.name}님 환영합니다!`,
      });
      if (data.user.role === "admin") {
        setLocation("/admin");
      } else {
        setLocation("/guard");
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: "아이디 또는 비밀번호를 확인해주세요.",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-16 border-b flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4">
          <img src={miraeLogoPath} alt="미래에이비엠" className="h-8 object-contain" />
          <span className="font-bold text-lg">경비원 근태관리</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={miraeLogoPath} 
                alt="미래에이비엠" 
                className="h-12 object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold">경비원 근태관리</CardTitle>
            <CardDescription>
              QR코드 기반 출근 관리 시스템에 로그인하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>아이디</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="아이디를 입력하세요"
                          data-testid="input-username"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="비밀번호를 입력하세요"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-12"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      로그인 중...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <LogIn className="h-5 w-5" />
                      로그인
                    </span>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>

      <footer className="h-12 border-t flex items-center justify-center text-sm text-muted-foreground">
        <p>&copy; 2024 미래에이비엠. All rights reserved.</p>
      </footer>
    </div>
  );
}
