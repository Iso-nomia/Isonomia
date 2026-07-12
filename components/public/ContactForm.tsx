"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

/**
 * Contact form for the public landing page. Posts to /api/contact, which
 * emails the team via SES. On any failure it degrades gracefully to a
 * direct mailto so a visitor is never left without a way to reach us.
 */

const CONTACT_EMAIL = "rohan@isonomia.app";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot — bots fill this hidden field; humans never see it.
  const [company, setCompany] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message, company }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
        <p className="font-medium">Thanks — your message is on its way.</p>
        <p className="mt-1 text-emerald-800">
          We&rsquo;ll get back to you at the email you provided.
        </p>
      </div>
    );
  }

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    "Isonomia — getting in touch",
  )}&body=${encodeURIComponent(message || "")}`;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Honeypot: visually hidden, off-screen, not tabbable. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="contact-name"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            placeholder="Your name"
          />
        </div>
        <div>
          <label
            htmlFor="contact-email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="contact-message"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          required
          rows={4}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          placeholder="Tell us a little about your interest — who you are and what you'd like to build or explore."
        />
      </div>

      {status === "error" ? (
        <p className="text-sm text-rose-600">
          Something went wrong sending your message. Please email us directly at{" "}
          <a
            href={mailtoHref}
            className="font-medium underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Send message"}
          {status === "sending" ? null : <ArrowRight className="h-4 w-4" />}
        </button>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          or email {CONTACT_EMAIL}
        </a>
      </div>
    </form>
  );
}
