import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Twitter,
  Youtube,
} from "lucide-react";
import { Button, FormField, Input, Textarea } from "@/components/ui/forms";
import { RotarySelector, Waveform, PowerButton, StatReadout } from "@/components/ui/hardware";
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

const SOCIALS = [
  { icon: Facebook, label: "Facebook", href: "#" },
  { icon: Twitter, label: "Twitter", href: "#" },
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
  { icon: Youtube, label: "YouTube", href: "#" },
  { icon: Github, label: "GitHub", href: "#" },
  { icon: Globe, label: "Website", href: "#" },
  { icon: MessageSquare, label: "Chat", href: "#" },
];

export function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [powered, setPowered] = useState(true);
  const [activeChannel, setActiveChannel] = useState(0);
  const toast = useToast();

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 1) return toast.push("error", "Please enter your name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return toast.push("error", "Please enter a valid email");
    if (form.message.trim().length < 10) return toast.push("error", "Message must be at least 10 characters");
    setSubmitting(true);
    try {
      await api.post("/contact", form);
      setSubmitted(true);
      setForm(EMPTY);
      toast.push("success", "Your message has been sent. We'll get back to you soon.");
    } catch (err) {
      toast.push("error", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-5xl">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-bold transition"
          style={{ color: "var(--text)" }}
        >
          <ArrowLeft size={14} /> Back to login
        </Link>

        {/* Top brand strip */}
        <div className="brand-strip mb-2 flex items-center justify-between rounded-t-2xl px-5 py-2.5">
          <div className="flex items-center gap-2">
            <div className="led led-pulse-bg" />
            <span className="tech-label tech-label-hi">SYS · ONLINE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="tech-label">LMS · CONTACT · v1.0</span>
            <div className="screw" />
          </div>
        </div>

        {/* Hero chassis with hero title + LCD matrix */}
        <div
          className="rounded-b-2xl p-6 sm:p-8"
          style={{
            
            boxShadow: "var(--neo-out)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderTop: "none",
          }}
        >
          {/* Hero header */}
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <div className="screw" />
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
              >
                <Mail size={24} />
              </div>
              <div className="screw" />
            </div>
            <h1
              className="font-extrabold tracking-tight"
              style={{
                color: "var(--text)",
                fontFamily: "Outfit, sans-serif",
                fontSize: "clamp(1.75rem, 3vw, 2.75rem)",
              }}
            >
              Contact Us
            </h1>
            <p className="max-w-xl text-sm leading-relaxed" style={{ color: "var(--text)" }}>
              Questions about admissions, technical issues, or anything else? Send us a note
              and we'll get back within one business day.
            </p>
          </div>

          {/* Vent grille */}
          <div className="mx-auto mb-6 flex max-w-md flex-col gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="vent" />)}
          </div>

          {/* Heavy animation showcase panel */}
          <div
            className="mb-5 card p-5 animate-power-on"
            style={{ position: "relative" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="tech-label tech-label-hi">CH · MATRIX · CTRL</span>
              <div className="flex items-center gap-1.5">
                <div className={"led " + (powered ? "led-pulse-bg" : "")} />
                <span className="tech-label">PWR</span>
              </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-3">
              {/* Rotary selector */}
              <div className="flex flex-col items-center gap-2">
                <RotarySelector positions={["EMAIL", "PHONE", "CHAT", "FORM"]} onChange={setActiveChannel} />
                <p className="tech-label">CHANNEL · {["EMAIL","PHONE","CHAT","FORM"][activeChannel]}</p>
              </div>

              {/* Live waveform */}
              <div className="flex flex-col gap-3">
                <Waveform bars={20} />
                <div className="grid grid-cols-3 gap-2">
                  <StatReadout label="AVG REPLY" value={24} unit="H" />
                  <StatReadout label="CSAT" value={98.4} suffix="%" />
                  <StatReadout label="AGENTS" value={12} />
                </div>
                <p className="text-center tech-label">SIGNAL · NOMINAL</p>
              </div>

              {/* Power button + LEDs */}
              <div className="flex flex-col items-center gap-4">
                <PowerButton on={powered} onClick={() => setPowered((p) => !p)} />
                <div className="lcd p-3 w-full">
                  <div className="flex items-center justify-between">
                    <span className="tech-label tech-label-hi">STATUS</span>
                    <div className="flex items-center gap-1.5">
                      {powered ? (
                        <>
                          <div className="led led-on" />
                          <div className="led led-blink" />
                          <div className="led" />
                        </>
                      ) : (
                        <>
                          <div className="led" />
                          <div className="led" />
                          <div className="led" />
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] tracking-[2px]" style={{ color: "var(--text)", fontFamily: "Outfit, sans-serif" }}>
                    {powered ? "CHANNEL ACTIVE" : "STANDBY MODE"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Two-column body */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Contact info: LCD panel */}
            <div className="lcd p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="tech-label tech-label-hi">CHANNEL · INFO</span>
                <div className="flex items-center gap-1.5">
                  <div className="led led-on" />
                  <div className="led" />
                </div>
              </div>
              <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>Get in touch</h2>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text)" }}>
                We typically reply within one business day.
              </p>
              <ul className="mt-5 space-y-4">
                {CONTACT_INFO.map((row) => (
                  <li key={row.title} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[20px]"
                      style={{
                        
                        
                        
                        boxShadow: "0 0 8px rgba(255, 255, 255, 0.18)",
                      }}
                    >
                      <row.icon size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold" style={{ color: "var(--text)" }}>{row.title}</p>
                      {row.lines.map((line) => (
                        <p key={line} className="text-[12px]" style={{ color: "var(--text)" }}>{line}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Form: dark panel */}
            <div className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="tech-label">FORM · TX</span>
                <div className="flex items-center gap-1.5">
                  <div className="led" />
                  <div className="led" />
                </div>
              </div>
              <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>Send us a message</h2>
              {submitted ? (
                <div
                  className="mt-5 rounded-2xl p-5 text-center"
                  style={{
                    background: "var(--bezel-deep)",
                    border: "1px solid var(--hi)",
                    boxShadow: "0 0 12px rgba(255, 255, 255, 0.30), var(--neo-in-deep-sm)",
                  }}
                >
                  <p className="text-2xl" style={{ color: "var(--text)" }}>✓</p>
                  <p className="mt-2 text-sm font-bold" style={{ color: "var(--text)" }}>MESSAGE SENT</p>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--text)" }}>
                    Thanks for reaching out. We'll get back to you at <strong>{form.email || "your email"}</strong> shortly.
                  </p>
                  <Button size="sm" variant="ghost" className="mt-3" onClick={() => setSubmitted(false)}>
                    Send another
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
                  <FormField label="Full name">
                    <Input value={form.name} onChange={update("name")} placeholder="Jane Doe" autoComplete="name" />
                  </FormField>
                  <FormField label="Email address">
                    <Input type="email" value={form.email} onChange={update("email")} placeholder="you@example.com" autoComplete="email" />
                  </FormField>
                  <FormField label="Subject">
                    <Input value={form.subject} onChange={update("subject")} placeholder="How can we help?" />
                  </FormField>
                  <FormField label="Message">
                    <Textarea value={form.message} onChange={update("message")} placeholder="Tell us a little more…" rows={5} />
                  </FormField>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="tech-label">ENCRYPTED · PRIVATE</p>
                    <Button type="submit" loading={submitting}>
                      <Send size={14} /> Transmit <ArrowRight size={13} />
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Social: dark panel with LED tiles */}
        <div className="mt-5 card p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="tech-label tech-label-amber">CHANNELS · SOCIAL</span>
            <div className="flex items-center gap-1.5">
              <div className="led led-amber-on" />
              <div className="led" />
            </div>
          </div>
          <h2 className="text-center text-base font-bold" style={{ color: "var(--text)" }}>Find us on</h2>
          <p className="mt-1 text-center text-[12px]" style={{ color: "var(--text)" }}>
            Follow along for product updates, tips and student stories.
          </p>
          <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-8">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="group flex aspect-square items-center justify-center rounded-[20px] transition"
                style={{
                  background: "var(--bezel-deep)",
                  color: "var(--text)",
                  
                  boxShadow: "var(--neo-in-deep-sm)",
                }}
              >
                <s.icon size={20} />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom brand strip */}
        <div className="brand-strip mt-3 flex items-center justify-between rounded-2xl px-5 py-2">
          <span className="tech-label">LMS · CONTACT</span>
          <div className="flex items-center gap-2">
            <span className="tech-label">2025-26</span>
            <div className="screw" />
          </div>
        </div>
      </div>
    </div>
  );
}