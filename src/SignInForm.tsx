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
    <Card className="w-full max-w-sm mx-auto border border-gray-200 shadow-sm">
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-semibold tracking-tight">Welcome</CardTitle>
        <CardDescription className="text-xs text-secondary">
          {flow === "signIn" ? "Sign in to continue" : "Create your account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <Tabs
          value={flow}
          onValueChange={(v) => setFlow(v as typeof flow)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 h-8 text-xs">
            <TabsTrigger value="signIn">Sign in</TabsTrigger>
            <TabsTrigger value="signUp">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value={flow} className="mt-3">
            <form
              className="space-y-3"
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
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-8 text-xs"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="h-8 px-3 text-xs"
              >
                {flow === "signIn" ? "Sign in" : "Sign up"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-4">
          <div className="relative">
            <Separator />
            <span className="absolute inset-0 -top-2.5 mx-auto w-fit bg-white px-1 text-[10px] text-secondary">
              or
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          variant="outline"
          className="w-full h-8 text-xs"
          onClick={() => void signIn("anonymous")}
        >
          Continue as guest
        </Button>
      </CardFooter>
    </Card>
  );
}
