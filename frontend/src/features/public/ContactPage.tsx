import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { Button, FormField, Input, Textarea } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlays";
import { api, errorMessage } from "@/api/client";

type FormState = { name: string; email: string; subject: string; message: string };
const EMPTY: FormState = { name: "", email: "", subject: "", message: "" };

const CONTACT_INFO = [
  { icon: MapPin, title: "Visit us", lines: ["123 Education Lane, Academic District", "Hyderabad, Telangana 500032 · India"] },
  { icon: Phone, title: "Call us", lines: ["+91 98765 43210", "Mon–Sat · 9:00 AM – 6:00 PM IST"] },
  { icon: Mail, title: "Email us", lines: ["support@lms.example.com", "admissions@lms.example.com"] },
  { icon: Clock, title: "Working hours", lines: ["Mon – Fri: 9 AM – 6 PM", "Sat: 10 AM – 2 PM · Sun: Closed"] },
];

export function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const toast = useToast();

  const update = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 1) return toast.push("error", "Please enter your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return toast.push("error", "Please enter a valid email");
    if (form.message.trim().length < 10) return toast.push("error", "Message must be at least 10 characters");

    setSubmitting(true);
    try {
      await api.post("/contact", form);
      setSubmittedEmail(form.email);
      setForm(EMPTY);
      toast.push("success", "Your message has been sent. We'll get back to you soon.");
    } catch (error) {
      toast.push("error", errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/login" className="mb-7 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
          <ArrowLeft size={16} aria-hidden="true" /> Back to login
        </Link>

        <header className="mb-8 max-w-2xl">
          <h1 className="page-title">Contact us</h1>
          <p className="page-description">
            Questions about admissions, technical issues, or anything else? Send us a note and we’ll get back within one business day.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="card p-5 sm:p-6" aria-labelledby="contact-info-title">
            <h2 id="contact-info-title" className="text-lg font-semibold">Get in touch</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">We typically reply within one business day.</p>
            <ul className="mt-6 space-y-5">
              {CONTACT_INFO.map(({ icon: Icon, title, lines }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="sk-icon-disc mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    {lines.map((line) => <p key={line} className="break-words text-sm text-[var(--text-muted)]">{line}</p>)}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title" className="text-lg font-semibold">Send us a message</h2>
            {submittedEmail ? (
              <div className="neo-alert neo-alert-success mt-5 p-5" role="status">
                <p className="font-semibold text-success-700">Message sent</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Thanks for reaching out. We’ll get back to you at {submittedEmail} shortly.</p>
                <Button size="sm" variant="secondary" className="mt-4" onClick={() => setSubmittedEmail("")}>Send another message</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                <FormField label="Full name">
                  <Input value={form.name} onChange={update("name")} placeholder="Jane Doe" autoComplete="name" required />
                </FormField>
                <FormField label="Email address">
                  <Input type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" autoComplete="email" required />
                </FormField>
                <FormField label="Subject">
                  <Input value={form.subject} onChange={update("subject")} placeholder="How can we help?" />
                </FormField>
                <FormField label="Message">
                  <Textarea value={form.message} onChange={update("message")} placeholder="Tell us a little more…" rows={5} required />
                </FormField>
                <div className="flex justify-end pt-1">
                  <Button type="submit" loading={submitting}>
                    <Send size={15} aria-hidden="true" /> Send message
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
