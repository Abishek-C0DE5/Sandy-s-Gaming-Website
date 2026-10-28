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
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D71932]/40 bg-[#171719] px-3.5 py-1 text-xs font-bold text-[#D71932] shadow-[0_0_12px_rgba(215,25,50,0.2)] mb-3">
          <Mail className="h-3.5 w-3.5 text-[#D71932]" />
          <span>Guest Inquiry Desk</span>
        </div>
        <h1 className="text-3xl font-black tracking-wider uppercase text-white sm:text-4xl">
          Get in Touch with Our Team
        </h1>
        <p className="mt-3 text-sm text-[#A5A5AD] leading-relaxed">
          Have a question about our high-performance setups, events, or reservations? Submit your inquiry below. No account or login required.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Public Contact Form (7 cols) */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-white/[0.08] bg-[#101012] p-6 sm:p-8 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">
              Send a Message
            </h2>
            <p className="text-xs text-[#A5A5AD] mb-6">
              Fill out the form below. All fields marked with an asterisk (<span className="text-[#D71932]">*</span>) are required.
            </p>

            <ContactFormClient />
          </div>
        </div>

        {/* Right Column: Support Context & Live Chat Upsell (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Authenticated Chat Notice */}
          <div className="rounded-2xl border border-[#D71932]/30 bg-[#171719] p-6 shadow-[0_0_20px_rgba(215,25,50,0.1)]">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#D71932] p-2 text-white shrink-0 mt-0.5 shadow-[0_0_12px_rgba(215,25,50,0.4)]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Looking for Real-Time Support?
                </h3>
                <p className="mt-1 text-xs text-[#A5A5AD] leading-relaxed">
                  Active customer account holders can access our dedicated Live Chat portal
                  for real-time instant messaging with support staff.
                </p>
                <div className="mt-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D71932] hover:text-[#ff3856] transition-colors"
                  >
                    <span>Sign in for Live Chat</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Response Expectations */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#101012] p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white">
              Support Information
            </h3>

            <div className="space-y-3 text-xs text-[#A5A5AD]">
              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-[#D71932] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Response Time:</span>{' '}
                  Our staff reviews incoming inquiries during operational hours and responds via email within 24 hours.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Privacy Protected:</span>{' '}
                  Guest contact inquiries are strictly private and accessible only to authorized staff.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[#D71932] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Location:</span>{' '}
                  Sandy&apos;s Gaming Lounge, 404 Cyber Arcade Way, Level 2
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-[#D71932] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Phone Inquiries:</span>{' '}
                  +1 (555) 726-3974 (10:00 AM &ndash; 11:00 PM EST)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
