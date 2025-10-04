"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Separator } from "./components/ui/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "./components/ui/tabs";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Card className="w-full backdrop-blur-sm bg-white/80 border-0 shadow-2xl shadow-indigo-500/10 rounded-3xl overflow-hidden">
      <CardHeader className="px-8 pt-8 pb-6">
        <CardTitle className="text-xl font-semibold text-slate-800 text-center">
          {flow === "signIn" ? "Welcome back" : "Create account"}
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 text-center">
          {flow === "signIn" ? "Sign in to your account to continue" : "Get started with your new account"}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="px-8 pb-6">
        <Tabs
          value={flow}
          onValueChange={(v) => setFlow(v as typeof flow)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 h-12 bg-slate-100 rounded-xl p-1 mb-6">
            <TabsTrigger 
              value="signIn" 
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 rounded-lg transition-all duration-200"
            >
              Sign in
            </TabsTrigger>
            <TabsTrigger 
              value="signUp"
              className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 rounded-lg transition-all duration-200"
            >
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value={flow} className="mt-0">
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitting(true);
                const formData = new FormData(e.target as HTMLFormElement);
                formData.set("flow", flow);
                void signIn("password", formData).catch((error) => {
                  const message = error.message.includes("Invalid password")
                    ? "Invalid password. Please try again."
                    : flow === "signIn"
                      ? "Could not sign in, did you mean to sign up?"
                      : "Could not sign up, did you mean to sign in?";
                  toast.error(message);
                  setSubmitting(false);
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  required
                  className="h-12 text-sm border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  className="h-12 text-sm border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl transition-all duration-200"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  flow === "signIn" ? "Sign in" : "Create account"
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <div className="relative">
            <Separator className="bg-slate-200" />
            <span className="absolute inset-0 -top-2.5 mx-auto w-fit bg-white px-3 text-xs text-slate-500 font-medium">
              or continue with
            </span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="px-8 pb-8">
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all duration-200"
          onClick={() => void signIn("anonymous")}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Continue as guest
        </Button>
      </CardFooter>
    </Card>
  );
}
