import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const USER_ID = '31f68460-3909-4ee4-aae6-5c8d4da32c26';

// Realistic demo applications
const demoApplications = [
  {
    user_id: USER_ID,
    company: 'Google',
    role: 'Senior Software Engineer',
    status: 'Interview Scheduled',
    date_applied: new Date('2024-12-15').toISOString(),
    job_url: 'https://careers.google.com/jobs/results/12345',
    job_description: 'We are looking for a Senior Software Engineer to join our Cloud Platform team. You will be working on large-scale distributed systems and helping to build the next generation of Google Cloud services.',
    location: 'Mountain View, CA',
    salary_range: '$180,000 - $250,000',
    job_type: 'Full-time',
    notes: 'Technical interview scheduled for Dec 28. Interviewer: Sarah Chen (Engineering Manager). Focus on system design and distributed systems.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Stripe',
    role: 'Product Manager',
    status: 'Applied',
    date_applied: new Date('2024-12-18').toISOString(),
    job_url: 'https://stripe.com/jobs/listing/product-manager/5678',
    job_description: 'Stripe is seeking a Product Manager to lead our payments infrastructure team. You will define the product roadmap and work closely with engineering teams.',
    location: 'San Francisco, CA',
    salary_range: '$150,000 - $200,000',
    job_type: 'Full-time',
    notes: 'Referral from Alex Thompson. Should follow up after holidays.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Airbnb',
    role: 'UX Designer',
    status: 'Offer',
    date_applied: new Date('2024-12-08').toISOString(),
    job_url: 'https://careers.airbnb.com/positions/ux-designer',
    job_description: 'Join our design team to create intuitive and beautiful experiences for millions of hosts and guests worldwide.',
    location: 'San Francisco, CA',
    salary_range: '$140,000 - $180,000',
    job_type: 'Full-time',
    notes: 'Offer received! $165k base + $30k signing bonus + equity. Deadline to respond: Jan 3rd. Very excited about this opportunity!',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Microsoft',
    role: 'Data Scientist',
    status: 'Rejected',
    date_applied: new Date('2024-12-05').toISOString(),
    job_url: 'https://careers.microsoft.com/data-scientist',
    job_description: 'Work with big data and machine learning to solve complex problems at scale.',
    location: 'Seattle, WA',
    salary_range: '$140,000 - $190,000',
    job_type: 'Full-time',
    notes: 'Rejected after final round. Feedback: needed more experience with Azure ML.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Netflix',
    role: 'Senior Frontend Engineer',
    status: 'Interview Scheduled',
    date_applied: new Date('2024-12-12').toISOString(),
    job_url: 'https://jobs.netflix.com/jobs/98765',
    job_description: 'Build the next generation of Netflix UI experiences using React and cutting-edge web technologies.',
    location: 'Los Gatos, CA',
    salary_range: '$200,000 - $300,000',
    job_type: 'Full-time',
    notes: 'Phone screen went well! Technical interview on Dec 27 with the UI Platform team.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Spotify',
    role: 'Backend Engineer',
    status: 'Interviewed',
    date_applied: new Date('2024-12-10').toISOString(),
    job_url: 'https://www.lifeatspotify.com/jobs/backend-engineer',
    job_description: 'Help us build scalable backend services that power music streaming for millions.',
    location: 'New York, NY',
    salary_range: '$130,000 - $170,000',
    job_type: 'Full-time',
    notes: 'Completed 3 rounds of interviews. Waiting for final decision. Team seemed great!',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Tesla',
    role: 'Machine Learning Engineer',
    status: 'Applied',
    date_applied: new Date('2024-12-20').toISOString(),
    job_url: 'https://www.tesla.com/careers/ml-engineer',
    job_description: 'Work on autonomous driving technology using cutting-edge ML techniques.',
    location: 'Palo Alto, CA',
    salary_range: '$150,000 - $220,000',
    job_type: 'Full-time',
    notes: 'Applied through employee referral. Expecting to hear back in early January.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Amazon',
    role: 'Solutions Architect',
    status: 'Interview Scheduled',
    date_applied: new Date('2024-12-14').toISOString(),
    job_url: 'https://www.amazon.jobs/en/jobs/12345',
    job_description: 'Design and implement cloud solutions for enterprise customers using AWS.',
    location: 'Seattle, WA',
    salary_range: '$140,000 - $180,000',
    job_type: 'Full-time',
    notes: 'First round scheduled for Dec 29. Need to review AWS services and system design.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Meta',
    role: 'Software Engineer',
    status: 'Applied',
    date_applied: new Date('2024-12-19').toISOString(),
    job_url: 'https://www.metacareers.com/jobs/software-engineer',
    job_description: 'Build social experiences that connect billions of people around the world.',
    location: 'Menlo Park, CA',
    salary_range: '$170,000 - $240,000',
    job_type: 'Full-time',
    notes: 'Strong application. Have a connection on the team who can provide referral.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Salesforce',
    role: 'Technical Product Manager',
    status: 'Interviewed',
    date_applied: new Date('2024-12-07').toISOString(),
    job_url: 'https://salesforce.wd1.myworkdayjobs.com/External_Career',
    job_description: 'Lead product development for our CRM platform features.',
    location: 'San Francisco, CA',
    salary_range: '$160,000 - $210,000',
    job_type: 'Full-time',
    notes: 'Great interview with the product team. They mentioned decision will come after holidays.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Adobe',
    role: 'Senior UX Designer',
    status: 'Applied',
    date_applied: new Date('2024-12-16').toISOString(),
    job_url: 'https://adobe.wd5.myworkdayjobs.com/external_experienced',
    job_description: 'Design creative tools used by millions of designers worldwide.',
    location: 'San Jose, CA',
    salary_range: '$135,000 - $175,000',
    job_type: 'Full-time',
    notes: 'Portfolio submitted. Really excited about working on Creative Cloud products.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Uber',
    role: 'Data Engineer',
    status: 'Rejected',
    date_applied: new Date('2024-11-28').toISOString(),
    job_url: 'https://www.uber.com/careers',
    job_description: 'Build data pipelines that power real-time decision making.',
    location: 'San Francisco, CA',
    salary_range: '$145,000 - $195,000',
    job_type: 'Full-time',
    notes: 'Rejected after technical assessment. Need to improve SQL and data modeling skills.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'LinkedIn',
    role: 'Full Stack Engineer',
    status: 'Interview Scheduled',
    date_applied: new Date('2024-12-13').toISOString(),
    job_url: 'https://careers.linkedin.com',
    job_description: 'Build features that help professionals connect and grow their careers.',
    location: 'Sunnyvale, CA',
    salary_range: '$150,000 - $200,000',
    job_type: 'Full-time',
    notes: 'Virtual onsite scheduled for Jan 5. Four rounds: coding, system design, behavioral, and team match.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Slack',
    role: 'Backend Engineer',
    status: 'Applied',
    date_applied: new Date('2024-12-17').toISOString(),
    job_url: 'https://slack.com/careers',
    job_description: 'Help build the platform that powers workplace communication.',
    location: 'San Francisco, CA',
    salary_range: '$140,000 - $185,000',
    job_type: 'Full-time',
    notes: 'Great match for my skills. Emphasized experience with real-time messaging systems.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Dropbox',
    role: 'iOS Developer',
    status: 'Interviewed',
    date_applied: new Date('2024-12-06').toISOString(),
    job_url: 'https://www.dropbox.com/jobs',
    job_description: 'Build native iOS experiences for file storage and collaboration.',
    location: 'San Francisco, CA',
    salary_range: '$145,000 - $190,000',
    job_type: 'Full-time',
    notes: 'Technical interview went well. They liked my SwiftUI experience. Final round next week.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Pinterest',
    role: 'Frontend Engineer',
    status: 'Applied',
    date_applied: new Date('2024-12-21').toISOString(),
    job_url: 'https://www.pinterestcareers.com',
    job_description: 'Create inspiring visual experiences for millions of users.',
    location: 'San Francisco, CA',
    salary_range: '$135,000 - $175,000',
    job_type: 'Full-time',
    notes: 'Just applied. Love their product and engineering blog. Fingers crossed!',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Square',
    role: 'Senior Software Engineer',
    status: 'Offer',
    date_applied: new Date('2024-12-01').toISOString(),
    job_url: 'https://careers.squareup.com',
    job_description: 'Build payment solutions for small businesses.',
    location: 'San Francisco, CA',
    salary_range: '$160,000 - $210,000',
    job_type: 'Full-time',
    notes: 'Offer: $185k base + equity. Great team and interesting fintech challenges. Competing with Airbnb offer.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Twilio',
    role: 'Platform Engineer',
    status: 'Interview Scheduled',
    date_applied: new Date('2024-12-11').toISOString(),
    job_url: 'https://www.twilio.com/company/jobs',
    job_description: 'Build APIs that power communication for thousands of businesses.',
    location: 'San Francisco, CA',
    salary_range: '$140,000 - $185,000',
    job_type: 'Full-time',
    notes: 'Phone screen scheduled for Dec 30. Research their API architecture and microservices.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Coinbase',
    role: 'Blockchain Engineer',
    status: 'Applied',
    date_applied: new Date('2024-12-22').toISOString(),
    job_url: 'https://www.coinbase.com/careers',
    job_description: 'Build the future of cryptocurrency and decentralized finance.',
    location: 'Remote',
    salary_range: '$170,000 - $250,000',
    job_type: 'Full-time',
    notes: 'Interesting opportunity in Web3. Remote-first culture is appealing.',
    archived: false
  },
  {
    user_id: USER_ID,
    company: 'Instacart',
    role: 'Mobile Engineer',
    status: 'Rejected',
    date_applied: new Date('2024-11-25').toISOString(),
    job_url: 'https://instacart.careers',
    job_description: 'Build mobile apps that make grocery delivery seamless.',
    location: 'San Francisco, CA',
    salary_range: '$140,000 - $180,000',
    job_type: 'Full-time',
    notes: 'Rejected after phone screen. They wanted more React Native experience.',
    archived: true
  }
];

async function seedApplications() {
  console.log('Starting to seed applications for user:', USER_ID);
  
  try {
    // Insert all applications
    const { data, error } = await supabase
      .from('applications')
      .insert(demoApplications)
      .select();

    if (error) {
      console.error('Error inserting applications:', error);
      return;
    }

    console.log(`Successfully inserted ${data.length} applications`);
    
    // Show summary
    const statusCounts = demoApplications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nApplication Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the seeding
seedApplications();