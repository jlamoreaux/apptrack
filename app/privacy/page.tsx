import './privacy-styles.css';
import type { Metadata } from 'next';
import { SITE_CONFIG } from "@/lib/constants/site-config";

export const metadata: Metadata = {
  title: 'Privacy Policy | AppTrack',
  alternates: {
    canonical: `${SITE_CONFIG.url}/privacy`,
  },
};

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl privacy-policy">
      <div data-custom-class="body">
        <div><strong><span style={{fontSize: '26px'}}><span data-custom-class="title"><h1>PRIVACY POLICY</h1></span></span></strong></div>
        <div><span style={{color: 'rgb(127, 127, 127)'}}><strong><span style={{fontSize: '15px'}}><span data-custom-class="subtitle">Last updated March 18, 2026</span></span></strong></span></div>
        <div><br /></div>

        <div style={{lineHeight: 1.5}}><span style={{color: 'rgb(89, 89, 89)', fontSize: '15px'}} data-custom-class="body_text">This Privacy Notice for Jordan Lamoreaux (&quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; or &quot;<strong>our</strong>&quot;) describes how and why we might access, collect, store, use, and/or share (&quot;<strong>process</strong>&quot;) your personal information when you use our services (&quot;<strong>Services</strong>&quot;), including when you:</span></div>

        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Visit our website at <a target="_blank" data-custom-class="link" href="https://www.apptrack.ing" style={{color: 'rgb(0, 58, 250)'}}>https://www.apptrack.ing</a></span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Use the AppTrack Chrome extension</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Engage with us in other related ways, including sales, marketing, or events</span></li>
        </ul>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text"><strong>Questions or concerns?</strong> If you do not agree with our policies and practices, please do not use our Services. If you have questions, contact us at <a data-custom-class="link" href="mailto:support@apptrack.ing" style={{color: 'rgb(0, 58, 250)'}}>support@apptrack.ing</a>.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        <div id="toc">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">TABLE OF CONTENTS</h2></span></strong>
          <ol style={{lineHeight: 2}}>
            <li><a href="#infocollect" style={{color: 'rgb(0, 58, 250)'}}>What information do we collect?</a></li>
            <li><a href="#infouse" style={{color: 'rgb(0, 58, 250)'}}>How do we process your information?</a></li>
            <li><a href="#extension" style={{color: 'rgb(0, 58, 250)'}}>Chrome extension</a></li>
            <li><a href="#whoshare" style={{color: 'rgb(0, 58, 250)'}}>When and with whom do we share your information?</a></li>
            <li><a href="#cookies" style={{color: 'rgb(0, 58, 250)'}}>Do we use cookies and other tracking technologies?</a></li>
            <li><a href="#retention" style={{color: 'rgb(0, 58, 250)'}}>How long do we keep your information?</a></li>
            <li><a href="#security" style={{color: 'rgb(0, 58, 250)'}}>How do we keep your information safe?</a></li>
            <li><a href="#rights" style={{color: 'rgb(0, 58, 250)'}}>What are your privacy rights?</a></li>
            <li><a href="#contact" style={{color: 'rgb(0, 58, 250)'}}>How can you contact us about this notice?</a></li>
          </ol>
        </div>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 1 */}
        <div id="infocollect">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">1. WHAT INFORMATION DO WE COLLECT?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><strong><span style={{fontSize: '15px'}} data-custom-class="heading_2">Information you provide to us</span></strong></div>
        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">We collect personal information you provide when you register an account, use our Services, or contact us. This includes:</span></div>
        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Name and email address</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Job application data you enter (company names, job titles, application status, notes)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Resumes and cover letters you upload or generate</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Payment information (processed by Stripe — we do not store card numbers)</span></li>
        </ul>

        <div style={{lineHeight: 1.5}}><br /></div>

        <div style={{lineHeight: 1.5}}><strong><span style={{fontSize: '15px'}} data-custom-class="heading_2">Information collected automatically</span></strong></div>
        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">When you use our Services, we automatically collect certain information, including:</span></div>
        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Log data (IP address, browser type, pages visited, time spent)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Device information (browser type and version, operating system)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Usage analytics via PostHog (feature usage, session events — no keylogging)</span></li>
        </ul>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 2 */}
        <div id="infouse">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">2. HOW DO WE PROCESS YOUR INFORMATION?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">We use the information we collect to:</span></div>
        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Create and manage your account</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Provide the job tracking and AI coaching features</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Process payments and manage subscriptions</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Send transactional emails (account confirmation, password reset, feature updates)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Improve and debug the Services</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Comply with legal obligations</span></li>
        </ul>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 3 — Chrome Extension */}
        <div id="extension">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">3. CHROME EXTENSION</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">The AppTrack Chrome extension is a browser tool that helps you save job listings directly from job boards into your AppTrack account.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        <div style={{lineHeight: 1.5}}><strong><span style={{fontSize: '15px'}} data-custom-class="heading_2">What the extension reads</span></strong></div>
        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">When you activate the extension on a job listing page, it reads the following data from that page:</span></div>
        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Job title</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Company name</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Job description</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Listing URL</span></li>
        </ul>

        <div style={{lineHeight: 1.5}}><br /></div>

        <div style={{lineHeight: 1.5}}><strong><span style={{fontSize: '15px'}} data-custom-class="heading_2">What the extension does not do</span></strong></div>
        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>It does not run passively in the background or collect data without you triggering it</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>It does not read data from pages unrelated to job listings</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>It does not track your browsing history</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>It does not sell or share data with third parties</span></li>
        </ul>

        <div style={{lineHeight: 1.5}}><br /></div>

        <div style={{lineHeight: 1.5}}><strong><span style={{fontSize: '15px'}} data-custom-class="heading_2">Where the data goes</span></strong></div>
        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">Job listing data read by the extension is sent to apptrack.ing servers and stored in your AppTrack account. It is used solely to populate your job application tracker. You can delete any saved application at any time from your AppTrack dashboard, which permanently removes that data.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        <div style={{lineHeight: 1.5}}><strong><span style={{fontSize: '15px'}} data-custom-class="heading_2">Permissions</span></strong></div>
        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">The extension requests access to read page content on job board sites in order to extract job listing information. It also communicates with apptrack.ing to save data to your account. No other hosts or services are contacted.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 4 */}
        <div id="whoshare">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">4. WHEN AND WITH WHOM DO WE SHARE YOUR INFORMATION?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">We do not sell your personal information. We may share your information with third-party service providers that help us operate the Services, including:</span></div>
        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Supabase (database and authentication)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Stripe (payment processing)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Resend (transactional email)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>PostHog (product analytics)</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Anthropic / OpenAI (AI features — your resume/job data may be sent to generate AI responses)</span></li>
        </ul>
        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">Each of these providers has their own privacy policy. We only share the minimum data needed for the service to function.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 5 */}
        <div id="cookies">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">5. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">Yes. We use cookies and similar tracking technologies to keep you logged in, remember your preferences, and understand how you use the Services. You can control cookies through your browser settings. Disabling cookies may affect your ability to log in and use the Services.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 6 */}
        <div id="retention">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">6. HOW LONG DO WE KEEP YOUR INFORMATION?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">We retain your personal information for as long as your account is active or as needed to provide the Services. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal or tax purposes.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 7 */}
        <div id="security">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">7. HOW DO WE KEEP YOUR INFORMATION SAFE?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">We use industry-standard technical and organizational measures to protect your personal information, including encryption in transit (TLS) and at rest. That said, no system is perfectly secure. We encourage you to use a strong password and to notify us immediately at <a data-custom-class="link" href="mailto:support@apptrack.ing" style={{color: 'rgb(0, 58, 250)'}}>support@apptrack.ing</a> if you suspect unauthorized access to your account.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 8 */}
        <div id="rights">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">8. WHAT ARE YOUR PRIVACY RIGHTS?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">Depending on where you are located, you may have the right to:</span></div>
        <ul>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Access the personal information we hold about you</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Request correction of inaccurate data</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Request deletion of your data</span></li>
          <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}>Opt out of marketing emails (unsubscribe link in every email)</span></li>
        </ul>
        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">To exercise any of these rights, email us at <a data-custom-class="link" href="mailto:support@apptrack.ing" style={{color: 'rgb(0, 58, 250)'}}>support@apptrack.ing</a>.</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        {/* Section 9 */}
        <div id="contact">
          <strong><span style={{fontSize: '15px'}}><h2 data-custom-class="heading_1">9. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2></span></strong>
        </div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">If you have questions or comments about this notice, you may email us at <a data-custom-class="link" href="mailto:support@apptrack.ing" style={{color: 'rgb(0, 58, 250)'}}>support@apptrack.ing</a> or contact us at:</span></div>

        <div style={{lineHeight: 1.5}}><br /></div>

        <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}} data-custom-class="body_text">Jordan Lamoreaux<br />United States<br /><a data-custom-class="link" href="mailto:support@apptrack.ing" style={{color: 'rgb(0, 58, 250)'}}>support@apptrack.ing</a></span></div>
      </div>
    </div>
  );
}
