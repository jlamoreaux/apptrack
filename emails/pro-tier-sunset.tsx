import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ProTierSunsetEmailProps {
  userFirstName: string;
  currentPlanPrice: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://apptrack.work";

export default function ProTierSunsetEmail({
  userFirstName = "there",
  currentPlanPrice = "$2",
}: ProTierSunsetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Important update about your AppTrack Pro subscription - Good news inside!
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="48"
              height="48"
              alt="AppTrack"
              style={logo}
            />
            
            <Heading style={heading}>
              Hi {userFirstName},
            </Heading>
            
            <Text style={text}>
              We have an important update about your AppTrack subscription, and we think you'll be happy about it.
            </Text>
            
            <Section style={highlightBox}>
              <Text style={highlightText}>
                <strong>Your Pro plan price of {currentPlanPrice}/month is locked in forever!</strong>
              </Text>
            </Section>
            
            <Heading as="h2" style={subheading}>
              What's Changing?
            </Heading>
            
            <Text style={text}>
              We're simplifying our pricing to better serve our users. Going forward, new users will choose between:
            </Text>
            
            <Section style={planBox}>
              <Text style={planTitle}>Free Forever</Text>
              <Text style={planDescription}>
                • Up to 100 applications<br />
                • All tracking features<br />
                • Sankey charts & analytics
              </Text>
            </Section>
            
            <Section style={planBox}>
              <Text style={planTitle}>AI Career Coach - $9/month</Text>
              <Text style={planDescription}>
                • Everything in Free<br />
                • Unlimited applications<br />
                • AI-powered resume analysis<br />
                • AI interview preparation<br />
                • Custom cover letters
              </Text>
            </Section>
            
            <Heading as="h2" style={subheading}>
              What This Means for You
            </Heading>
            
            <Text style={text}>
              <strong>Nothing changes for you!</strong> As a loyal Pro subscriber, you'll:
            </Text>
            
            <ul style={list}>
              <li>Keep your {currentPlanPrice}/month price forever</li>
              <li>Continue enjoying unlimited applications</li>
              <li>Maintain all your current Pro features</li>
              <li>Have the option to upgrade to AI Coach anytime for just $9/month</li>
            </ul>
            
            <Section style={ctaBox}>
              <Text style={text}>
                Curious about our new AI features? You can try them anytime:
              </Text>
              <Button href={`${baseUrl}/dashboard/upgrade`} style={button}>
                Learn About AI Coach
              </Button>
            </Section>
            
            <Text style={text}>
              Thank you for being an early supporter of AppTrack. We're grandfathering your plan as a token of our appreciation. You helped us get to where we are today.
            </Text>
            
            <Text style={text}>
              If you have any questions, please don't hesitate to reach out to us at{" "}
              <Link href="mailto:support@apptrack.work" style={link}>
                support@apptrack.work
              </Link>
            </Text>
            
            <Text style={footer}>
              Best regards,<br />
              The AppTrack Team
            </Text>
            
            <Section style={hr} />
            
            <Text style={footerSmall}>
              You're receiving this email because you have an active Pro subscription with AppTrack. 
              Your subscription will continue at your current rate unless you choose to change it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const box = {
  padding: "0 48px",
};

const logo = {
  margin: "0 auto",
  marginBottom: "24px",
};

const heading = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.3",
  marginBottom: "24px",
};

const subheading = {
  color: "#333",
  fontSize: "20px",
  fontWeight: "600",
  lineHeight: "1.3",
  marginTop: "28px",
  marginBottom: "16px",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "1.5",
  marginBottom: "16px",
};

const highlightBox = {
  backgroundColor: "#e6f7ff",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "24px",
};

const highlightText = {
  color: "#0051a3",
  fontSize: "16px",
  lineHeight: "1.5",
  margin: "0",
};

const planBox = {
  backgroundColor: "#f8f9fa",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "16px",
  border: "1px solid #e1e4e8",
};

const planTitle = {
  color: "#333",
  fontSize: "18px",
  fontWeight: "600",
  marginBottom: "8px",
};

const planDescription = {
  color: "#666",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
};

const list = {
  paddingLeft: "24px",
  color: "#333",
  fontSize: "16px",
  lineHeight: "1.8",
  marginBottom: "24px",
};

const ctaBox = {
  textAlign: "center" as const,
  marginTop: "32px",
  marginBottom: "32px",
};

const button = {
  backgroundColor: "#6366f1",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const link = {
  color: "#6366f1",
  textDecoration: "underline",
};

const footer = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "1.5",
  marginTop: "32px",
};

const hr = {
  borderTop: "1px solid #e1e4e8",
  marginTop: "48px",
  marginBottom: "16px",
};

const footerSmall = {
  color: "#666",
  fontSize: "12px",
  lineHeight: "1.5",
};