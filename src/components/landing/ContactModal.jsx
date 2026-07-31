import { useState } from 'react';
import { X, Mail } from 'lucide-react';

// General inquiry form — composes a mailto to hello@evrica.tech.
// Uses mailto (zero credits, no recipient-registration dependency) so the
// inquiry always reaches the team regardless of whether the visitor is logged in.
export default function ContactModal({ onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const body = `Name: ${name || '—'}\nEmail: ${email || '—'}\n\n${message || ''}`;
    const url = `mailto:hello@evrica.tech?subject=${encodeURIComponent(
      subject || 'General Inquiry — HEX6 BLE'
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-lg w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-foreground" /> General Inquiry
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors" style={{ minWidth: 'auto', minHeight: 'auto' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="overflow-y-auto flex-1 px-6 py-6 space-y-4">
          <p className="text-sm text-secondary">
            Send us a note at <span className="font-medium text-foreground">hello@evrica.tech</span> — we&apos;ll get back to you.
          </p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2 rounded-sm border border-border bg-background text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email" className="w-full px-3 py-2 rounded-sm border border-border bg-background text-sm" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 rounded-sm border border-border bg-background text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message" rows={4} className="w-full px-3 py-2 rounded-sm border border-border bg-background text-sm resize-none" />
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-sm bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors" style={{ minWidth: 'auto', minHeight: 'auto' }}>
              Send Inquiry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}