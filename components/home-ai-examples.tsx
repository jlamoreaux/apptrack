import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Sparkles } from "lucide-react";

const EXAMPLES = {
  resume: {
    before: {
      title: "Before AI Analysis",
      content: `EXPERIENCE
Marketing Manager
- Managed social media accounts
- Created content 
- Ran campaigns
- Worked with team`
    },
    after: {
      title: "After AI Enhancement",
      content: `EXPERIENCE
Marketing Manager | ABC Corp | 2021-2023
• Increased social media engagement by 145% through data-driven content strategy
• Generated $2.3M in attributed revenue from integrated marketing campaigns
• Led cross-functional team of 8 to launch 3 successful product campaigns
• Reduced customer acquisition cost by 32% through A/B testing and optimization`
    }
  },
  coverLetter: {
    before: {
      title: "Generic Opening",
      content: `Dear Hiring Manager,

I am writing to apply for the Software Engineer position at your company. I have experience in programming and would be a good fit for this role.`
    },
    after: {
      title: "AI-Personalized Opening",
      content: `Dear Sarah Chen,

Your team's recent launch of the real-time collaboration feature in ProductX caught my attention – particularly the elegant WebSocket implementation that handles 10K+ concurrent users. As a senior engineer who reduced latency by 68% in a similar system at TechCorp, I'm excited about contributing to your mission of revolutionizing remote teamwork.`
    }
  },
  interview: {
    before: {
      title: "Unprepared Answer",
      content: `"Tell me about a time you handled conflict"

Um, well, I had a disagreement with a coworker once about a project deadline. We talked about it and figured it out eventually.`
    },
    after: {
      title: "AI-Coached STAR Answer",
      content: `"Tell me about a time you handled conflict"

Situation: Our product and engineering teams disagreed on feature prioritization, risking a critical Q4 launch.

Task: As tech lead, I needed to align both teams while maintaining our deadline.

Action: I organized a data-driven workshop where we mapped features to user impact metrics and created a phased rollout plan.

Result: We launched on time with 95% of features, and user adoption exceeded targets by 40%.`
    }
  }
};

export function HomeAIExamples() {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            See the AI Coach Difference
          </h2>
          <p className="text-lg text-muted-foreground">
            Real examples of how our AI transforms your job search materials
          </p>
        </div>

        <Tabs defaultValue="resume" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="resume">Resume</TabsTrigger>
            <TabsTrigger value="coverLetter">Cover Letter</TabsTrigger>
            <TabsTrigger value="interview">Interview Prep</TabsTrigger>
          </TabsList>

          {Object.entries(EXAMPLES).map(([key, example]) => (
            <TabsContent key={key} value={key} className="mt-0">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Before */}
                <Card className="border-2 border-destructive/20 bg-destructive/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">{example.before.title}</h3>
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                        Before
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-pre-line font-mono bg-background/50 p-4 rounded">
                      {example.before.content}
                    </div>
                  </CardContent>
                </Card>

                {/* After */}
                <Card className="border-2 border-green-500/20 bg-green-500/5 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <Sparkles className="h-5 w-5 text-green-600" />
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">{example.after.title}</h3>
                      <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
                        After AI
                      </Badge>
                    </div>
                    <div className="text-sm text-foreground whitespace-pre-line font-mono bg-background/50 p-4 rounded">
                      {example.after.content}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Arrow indicator */}
              <div className="hidden md:flex items-center justify-center -mt-12 mb-8">
                <div className="bg-primary/10 rounded-full p-3">
                  <ArrowRight className="h-6 w-6 text-primary" />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            All examples are from real AppTrack users (details anonymized)
          </p>
        </div>
      </div>
    </section>
  );
}