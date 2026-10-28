'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

interface FormState {
  name: string;
  email: string;
  phone: string;
  message: string;
  honeypot: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  message: '',
  honeypot: '',
};

export function ContactFormClient() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!form.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!form.phone.trim()) {
      errs.phone = 'Phone number with country code is required.';
    } else if (form.phone.trim().length < 7) {
      errs.phone = 'Phone number must be at least 7 characters.';
    } else if (!/^\+?[0-9\s\-()]+$/.test(form.phone.trim())) {
      errs.phone = 'Please include country code (e.g. +1 555-123-4567).';
    }

    if (!form.message.trim()) {
      errs.message = 'Message is required.';
    } else if (form.message.trim().length < 10) {
      errs.message = 'Message must be at least 10 characters long.';
    } else if (form.message.length > 5000) {
      errs.message = 'Message cannot exceed 5000 characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email: form.email.trim(),
          phone: form.phone.trim(),
          message: form.message.trim(),
          honeypot: form.honeypot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit inquiry. Please try again.');
      }

      setIsSuccess(true);
      setForm(INITIAL_FORM);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 mb-3">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-neutral-900 dark:text-white">
          Inquiry Successfully Sent!
        </h3>
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300 max-w-md mx-auto leading-relaxed">
          Thank you for contacting us. Your message has been routed to our staff inbox.
          We will review your inquiry and get back to you via email shortly.
        </p>

        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSuccess(false)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Send Another Inquiry</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {serverError && (
        <Alert variant="error" title="Submission Failed">
          {serverError}
        </Alert>
      )}

      {/* Anti-spam Honeypot (Visually hidden for screen readers & bots) */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0 }}>
        <label htmlFor="form-website-field">Leave this empty</label>
        <input
          id="form-website-field"
          type="text"
          name="website"
          value={form.honeypot}
          onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Name Field (Optional) */}
      <div>
        <label
          htmlFor="contact-name"
          className="block text-xs font-bold uppercase tracking-wider text-[#F7F7F8]"
        >
          Your Name <span className="text-[#A5A5AD] font-normal normal-case">(Optional)</span>
        </label>
        <input
          id="contact-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Alex Morgan"
          maxLength={100}
          className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-[#171719] px-3.5 py-2.5 text-xs text-white placeholder:text-[#64646D] focus:border-[#D71932] focus:ring-1 focus:ring-[#D71932] focus:outline-none transition-colors"
        />
      </div>

      {/* Email Field (Required) */}
      <div>
        <label
          htmlFor="contact-email"
          className="block text-xs font-bold uppercase tracking-wider text-[#F7F7F8]"
        >
          Email Address <span className="text-[#D71932]">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'contact-email-error' : undefined}
          value={form.email}
          onChange={(e) => {
            setForm({ ...form, email: e.target.value });
            if (errors.email) setErrors({ ...errors, email: '' });
          }}
          placeholder="e.g. alex@example.com"
          maxLength={254}
          className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-xs text-white placeholder:text-[#64646D] focus:outline-none focus:ring-1 bg-[#171719] transition-colors ${
            errors.email
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-white/[0.1] focus:border-[#D71932] focus:ring-[#D71932]'
          }`}
        />
        {errors.email && (
          <p id="contact-email-error" className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>{errors.email}</span>
          </p>
        )}
      </div>

      {/* Phone Field with Country Code (Required) */}
      <div>
        <label
          htmlFor="contact-phone"
          className="block text-xs font-bold uppercase tracking-wider text-[#F7F7F8]"
        >
          Phone Number with Country Code <span className="text-[#D71932]">*</span>
        </label>
        <input
          id="contact-phone"
          type="tel"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? 'contact-phone-error' : undefined}
          value={form.phone}
          onChange={(e) => {
            setForm({ ...form, phone: e.target.value });
            if (errors.phone) setErrors({ ...errors, phone: '' });
          }}
          placeholder="+1 555-726-3974"
          maxLength={25}
          className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-xs text-white placeholder:text-[#64646D] focus:outline-none focus:ring-1 bg-[#171719] transition-colors ${
            errors.phone
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-white/[0.1] focus:border-[#D71932] focus:ring-[#D71932]'
          }`}
        />
        <p className="mt-1 text-[11px] text-[#A5A5AD]">
          Include your country code (e.g. +1 for US/CA, +44 for UK, +977 for Nepal).
        </p>
        {errors.phone && (
          <p id="contact-phone-error" className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>{errors.phone}</span>
          </p>
        )}
      </div>

      {/* Message Field (Required) */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="contact-message"
            className="block text-xs font-bold uppercase tracking-wider text-[#F7F7F8]"
          >
            Message <span className="text-[#D71932]">*</span>
          </label>
          <span className="text-[11px] text-[#A5A5AD]">
            {form.message.length} / 5000
          </span>
        </div>
        <textarea
          id="contact-message"
          rows={5}
          required
          aria-required="true"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          value={form.message}
          onChange={(e) => {
            setForm({ ...form, message: e.target.value });
            if (errors.message) setErrors({ ...errors, message: '' });
          }}
          placeholder="Please describe how our team can assist you..."
          maxLength={5000}
          className={`mt-1.5 w-full rounded-lg border p-3 text-xs text-white placeholder:text-[#64646D] focus:outline-none focus:ring-1 bg-[#171719] transition-colors ${
            errors.message
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-white/[0.1] focus:border-[#D71932] focus:ring-[#D71932]'
          }`}
        />
        {errors.message && (
          <p id="contact-message-error" className="mt-1 text-[11px] text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            <span>{errors.message}</span>
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting}
          className="w-full justify-center bg-[#D71932] hover:bg-[#b01328] text-white text-xs font-bold uppercase tracking-wider py-2.5 shadow-[0_0_15px_rgba(215,25,50,0.35)] transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Sending Inquiry...</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5 mr-2" />
              <span>Submit Guest Inquiry</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
