import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <article className="prose prose-sm dark:prose-invert max-w-none">
          <h1>BathOS Terms of Service and Privacy Policy</h1>

          <p><strong>Version:</strong> 1.0.0, 2026 February 17</p>

          <p>
            This document combines the Terms of Service ("Terms") and Privacy Policy ("Privacy Policy") for{' '}
            <strong>BathOS</strong> (the "Service").
            <br />
            By creating an account or using the Service, you agree to these Terms and this Privacy Policy.
          </p>

          <p>If you do not agree, do not use the Service.</p>

          <hr />

          <h2>1. Who runs BathOS</h2>
          <p>
            BathOS is operated by <strong>Art</strong> as an independent personal software project ("we", "us", or "the operator").
          </p>
          <p>The Service is offered from California, United States, and is governed by California law.</p>

          <hr />

          <h2>2. Eligibility</h2>
          <p>By creating an account, you represent that you have the legal capacity to enter into these Terms.</p>

          <hr />

          <h2>3. What BathOS is (and is not)</h2>
          <p>BathOS provides users with tools to record, analyze, and interact with personal data, activity, or behavioral signals for purposes including self‑reflection, productivity, experimentation, and social or experiential features where applicable.</p>
          <ul>
            <li>All user data is <strong>self‑reported or user‑generated</strong></li>
            <li>We do <strong>not verify accuracy</strong></li>
            <li>The Service is provided for <strong>informational, reflective, and experiential purposes</strong></li>
          </ul>
          <p>BathOS is <strong>not</strong> medical, psychological, financial, legal, or therapeutic advice of any kind.</p>
          <p>You are solely responsible for how you interpret and use the Service and for any consequences in your personal or professional life.</p>

          <hr />

          <h2>4. Accounts and profiles</h2>
          <p>To use BathOS, you must create an account.</p>
          <p>Depending on features enabled, account data may include:</p>
          <ul>
            <li>Username</li>
            <li>Profile icon or avatar</li>
            <li>Optional profile metadata</li>
          </ul>
          <p>You are responsible for maintaining the security of your account credentials.</p>

          <hr />

          <h2>5. User content and responsibility</h2>
          <p>You retain ownership of your data.</p>
          <p>By using the Service, you grant us a <strong>limited, non-exclusive license</strong> to host, process, analyze, transmit, and display your data solely for:</p>
          <ul>
            <li>Operating the Service</li>
            <li>Maintaining functionality</li>
            <li>Improving performance and reliability</li>
            <li>Developing new features</li>
          </ul>
          <p>You are responsible for:</p>
          <ul>
            <li>All data you submit</li>
            <li>Ensuring you have the right to submit it</li>
            <li>Any outcomes resulting from use of the Service</li>
          </ul>
          <p>We are not responsible for disputes, damages, losses, or harms arising from user-submitted data.</p>

          <hr />

          <h2>6. Prohibited use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Harass, threaten, impersonate, or abuse others</li>
            <li>Submit unlawful or infringing content</li>
            <li>Scrape or automate access to the Service</li>
            <li>Attempt to reverse engineer or disrupt the Service</li>
            <li>Use the Service for surveillance or coercion of others</li>
          </ul>
          <p>We reserve the right to remove content or terminate accounts at our sole discretion.</p>

          <hr />

          <h2>7. Termination and shutdown</h2>
          <p>We may suspend or terminate your account at any time, with or without notice.</p>
          <p>We may also modify, pause, or discontinue the Service entirely.</p>
          <p>You acknowledge the Service may be discontinued without liability.</p>

          <hr />

          <h2>8. Disclaimers</h2>
          <p>The Service is provided "as is" and "as available."</p>
          <p>We make no warranties, express or implied, including:</p>
          <ul>
            <li>Accuracy</li>
            <li>Reliability</li>
            <li>Availability</li>
            <li>Fitness for a particular purpose</li>
          </ul>
          <p>No system is 100% secure. Use is at your own risk.</p>

          <hr />

          <h2>9. Limitation of liability</h2>
          <p>To the fullest extent permitted by law:</p>
          <ul>
            <li>We are not liable for indirect or consequential damages</li>
            <li>We are not liable for loss of data or opportunity</li>
            <li>Total liability will not exceed the amount you paid to use the Service</li>
          </ul>

          <hr />

          <h2>10. Governing law</h2>
          <p>These Terms are governed by the laws of the State of California.</p>
          <p>Disputes must be brought in California courts.</p>

          <hr />
          <hr />

          <h1>Privacy Policy</h1>
          <p>This section explains what data we collect, how we use it, and your rights.</p>

          <hr />

          <h2>11. Data we collect</h2>
          <p>We may collect:</p>
          <ul>
            <li>Email address</li>
            <li>Username</li>
            <li>Password hash (via authentication provider)</li>
            <li>User‑generated content and activity records</li>
            <li>Configuration and preference settings</li>
            <li>Friend or social graph data (if applicable)</li>
            <li>Device/browser metadata</li>
            <li>IP address and access logs</li>
            <li>Cookies or local storage required for functionality</li>
            <li>Limited anonymous telemetry</li>
          </ul>
          <p>We intentionally aim to minimize collection of sensitive personal data wherever possible.</p>

          <hr />

          <h2>12. Telemetry and performance monitoring</h2>
          <p>We collect limited telemetry strictly to operate and improve the Service, such as:</p>
          <ul>
            <li>Page load timing</li>
            <li>Feature usage frequency</li>
            <li>Error rates</li>
            <li>Regional access patterns</li>
            <li>Infrastructure performance signals</li>
          </ul>
          <p>This data is used to:</p>
          <ul>
            <li>Debug issues</li>
            <li>Optimize infrastructure deployment</li>
            <li>Improve reliability and speed</li>
            <li>Guide performance enhancements</li>
          </ul>
          <p>Telemetry is anonymized where feasible and retained only as long as operationally necessary.</p>

          <hr />

          <h2>13. How we use your data</h2>
          <p>We use data to:</p>
          <ul>
            <li>Operate core functionality</li>
            <li>Authenticate users</li>
            <li>Maintain security</li>
            <li>Prevent abuse</li>
            <li>Provide support</li>
            <li>Debug and fix issues</li>
            <li>Analyze aggregate usage patterns</li>
            <li>Improve product design and performance</li>
          </ul>
          <p>We may inspect individual accounts when necessary for debugging or support.</p>
          <p>We do <strong>not</strong> sell user data.</p>

          <hr />

          <h2>14. Analytics and subprocessors</h2>
          <p>We may use third‑party providers to operate the Service, such as:</p>
          <ul>
            <li>Hosting and infrastructure providers</li>
            <li>Authentication platforms</li>
            <li>Database services</li>
            <li>Email delivery services</li>
            <li>Error monitoring tools</li>
          </ul>
          <p>These providers process data only as necessary to perform their functions.</p>

          <hr />

          <h2>15. Data sharing</h2>
          <p>We may disclose data:</p>
          <ul>
            <li>To service providers operating the Service</li>
            <li>To comply with legal obligations</li>
            <li>To protect rights, safety, or property</li>
            <li>In the event of a merger, transfer, or shutdown</li>
          </ul>
          <p>We do not sell personal data.</p>

          <hr />

          <h2>16. Data control and deletion</h2>
          <p>You may:</p>
          <ul>
            <li>Access your data</li>
            <li>Modify your data</li>
            <li>Delete your data</li>
            <li>Delete your account</li>
          </ul>
          <p>Deletion removes data from active systems, subject to backup and legal retention constraints.</p>

          <hr />

          <h2>17. Security</h2>
          <p>We use reasonable technical and organizational safeguards.</p>
          <p>However, no system is perfectly secure.</p>
          <p>In the event of a breach, we will notify affected users as required by law.</p>

          <hr />

          <h2>18. Changes to these terms</h2>
          <p>We may update these Terms and Privacy Policy.</p>
          <p>If changes are material:</p>
          <ul>
            <li>Users will be notified</li>
            <li>Continued use constitutes acceptance</li>
          </ul>

          <hr />

          <h2>19. Contact</h2>
          <p>For questions or concerns, contact us via the in‑app contact method or designated support channel.</p>
        </article>
      </div>
    </div>
  );
}
