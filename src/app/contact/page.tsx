import { Metadata } from 'next';
import { ContactFormClient } from './ContactFormClient';
import { Mail, Clock, MessageSquare, ShieldCheck, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact Us | Sandy\'s Gaming Lounge',
  description:
    'Send an inquiry to our team for questions, gaming workstation bookings, or assistance. No login required.',
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 mb-3">
          <Mail className="h-3.5 w-3.5" />
          <span>Guest Inquiry Desk</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
          Get in Touch with Our Team
        </h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          Have a question about our high-performance setups, events, or reservations?
          Submit your inquiry below — no account or login required.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Public Contact Form (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
              Send a Message
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Fill out the form below. All fields marked with an asterisk (<span className="text-red-500">*</span>) are required.
            </p>

            <ContactFormClient />
          </div>
        </div>

        {/* Right Column: Support Context & Live Chat Upsell (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Authenticated Chat Notice */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-600 p-2 text-white shrink-0 mt-0.5">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Looking for Real-Time Support?
                </h3>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Active customer account holders can access our dedicated Live Chat portal
                  for real-time instant messaging with support staff.
                </p>
                <div className="mt-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    <span>Sign in for Live Chat</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Response Expectations */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Support Information
            </h3>

            <div className="space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">Response Time:</span>{' '}
                  Our staff reviews incoming inquiries during operational hours and responds via email within 24 hours.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">Privacy Protected:</span>{' '}
                  Guest contact inquiries are strictly private and accessible only to authorized staff.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">Location:</span>{' '}
                  Sandy&apos;s Gaming Lounge, 404 Cyber Arcade Way, Level 2
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-white">Phone Inquiries:</span>{' '}
                  +1 (555) 726-3974 (10:00 AM – 11:00 PM EST)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
