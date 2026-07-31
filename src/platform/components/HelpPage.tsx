import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { checkAuthRateLimit, formatRetryAfter } from '@/lib/authRateLimit';
import GatewayPageLayout from '@/platform/components/GatewayPageLayout';

const MAX_CHARS = 200;
const MIN_CHARS = 5;

export default function HelpPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const canSubmit = email.trim() && isValidEmail(email) && message.length >= MIN_CHARS;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length <= MAX_CHARS) {
      setMessage(e.target.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);

    // Check rate limit
    const rl = await checkAuthRateLimit('help_request');
    if (rl.rateLimited) {
      toast({
        title: 'Too Many Requests',
        description: `Please wait ${formatRetryAfter(rl.retryAfterSeconds)} before submitting again.`,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('submit-help-request', {
        body: { email: email.toLowerCase().trim(), message },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setEmail('');
      setMessage('');
      toast({ title: 'Message Sent', description: "We'll get back to you soon." });
      handleBack();
    } catch (err) {
      console.error('Help submission error:', err);
      toast({
        title: 'Submission Failed',
        description: 'Unable to send your message. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GatewayPageLayout contentClassName="max-w-md">
      <div className="space-y-3">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground "
          onClick={handleBack}
        >
          ← Back
        </Button>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Need Help?</CardTitle>
            <CardDescription>
              Question, issue, or suggestion?
              <br />
              Tell me about it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="help-email" className="mb-1 block text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="help-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={submitting}
                  autoCapitalize="none"
                />
                <p className="mt-1 text-xs text-muted-foreground">I'll reply to this address</p>
              </div>

              <div>
                <label htmlFor="help-message" className="mb-1 block text-sm font-medium">
                  Message
                </label>
                <Textarea
                  id="help-message"
                  value={message}
                  onChange={handleMessageChange}
                  placeholder="What's Up?"
                  className="min-h-[120px] resize-none"
                  disabled={submitting}
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  <span className={message.length < MIN_CHARS ? 'text-destructive' : ''}>
                    {message.length}
                  </span>{' '}
                  / {MAX_CHARS}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!canSubmit || submitting}>
                {submitting ? 'Sending...' : 'Send Message'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </GatewayPageLayout>
  );
}
