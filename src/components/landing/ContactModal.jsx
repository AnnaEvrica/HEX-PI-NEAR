import { useState } from 'react';
import { X, Mail, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// General inquiry form — validated in-app submission (stored + relayed to the
// team). No mailto: the QA-reported "separate mailbox" and silent-failure
// issues came from depending on the visitor's mail client.
export default function ContactModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState(null);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (!form.subject.trim()) errs.subject = 'Subject is required.';
    if (!form.message.trim()) errs.message = 'Message is required.';
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSending(true);
    setServerError(null);
    try {
      const res = await base44.functions.invoke('contactInquiry', {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      if (res.data?.error) {
        setServerError(res.data.error);
        return;
      }
      setSent(true);
    } catch (err) {
      setServerError(err?.response?.data?.error || 'Could not send your inquiry. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const inputClass = (field) =>
    `w-full px-3 py-2 rounded-sm border ${errors[field] ? 'border-destructive' : 'border-border'} bg-card text-sm focus:outline-none focus:border-accent`;

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

        {sent ? (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Check className="w-6 h-6 text-accent" />
            </div>
            <p className="font-bold">Inquiry sent</p>
            <p className="text-sm text-secondary">Thanks — we&apos;ll get back to you at {form.email.trim()}.</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors" style={{ minWidth: 'auto', minHeight: 'auto' }}>
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="overflow-y-auto flex-1 px-6 py-6 space-y-4">
            <p className="text-sm text-secondary">Send us a note — we&apos;ll get back to you.</p>
            <div>
              <input value={form.name} onChange={set('name')} maxLength={100} placeholder="Your name *" className={inputClass('name')} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <input value={form.email} onChange={set('email')} type="email" maxLength={254} placeholder="Your email *" className={inputClass('email')} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>
            <div>
              <input value={form.subject} onChange={set('subject')} maxLength={120} placeholder="Subject *" className={inputClass('subject')} />
              <div className="flex justify-between mt-1">
                {errors.subject ? <p className="text-xs text-destructive">{errors.subject}</p> : <span />}
                <p className="text-[10px] text-secondary">{form.subject.length}/120</p>
              </div>
            </div>
            <div>
              <textarea value={form.message} onChange={set('message')} maxLength={2000} placeholder="Message *" rows={4} className={`${inputClass('message')} resize-none`} />
              <div className="flex justify-between mt-1">
                {errors.message ? <p className="text-xs text-destructive">{errors.message}</p> : <span />}
                <p className="text-[10px] text-secondary">{form.message.length}/2000</p>
              </div>
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={sending} className="px-4 py-2 rounded-sm bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-2" style={{ minWidth: 'auto', minHeight: 'auto' }}>
                {sending && <Loader2 className="w-4 h-4 animate-spin" />} Send Inquiry
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}