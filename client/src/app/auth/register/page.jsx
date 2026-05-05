"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { register } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import {
  AuthLayout, Field, PasswordField, ErrorBanner, SubmitBtn
} from "../../../components/auth/AuthComponents";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await register(form);
      login(data.user, data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start running technical interviews"
      link={{ href: "/auth/login", label: "Already have an account?", cta: "Sign in" }}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <Field
          label="Username"
          type="text"
          placeholder="e.g. saswat_dev"
          value={form.username}
          onChange={(v) => setForm({ ...form, username: v })}
        />
        <Field
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
        />
        <PasswordField
          label="Password"
          placeholder="Min 6 characters"
          value={form.password}
          onChange={(v) => setForm({ ...form, password: v })}
        />
        <SubmitBtn loading={loading} label="Create account" />
      </form>
    </AuthLayout>
  );
}

