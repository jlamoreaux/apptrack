# AppTrack SEO Plan: Revised Approach

## Current State

- **Weekly traffic:** ~277 visitors
- **Top channel:** LinkedIn (organic + paid credits)
- **Technical SEO:** Foundation complete (sitemap, robots.txt, JSON-LD, metadata, canonicals)
- **Stage:** Early - need to validate before scaling investment

## Implementation Status

| Item | Status |
|------|--------|
| Sitemap.xml | Done |
| robots.txt | Done |
| JSON-LD structured data | Done |
| Unique metadata per tool page | Done |
| Canonical URLs | Done |
| LinkedIn share on Roast results | Done |
| Role-specific landing pages (3) | Done |
| /free-tools hub page | Done |

## Immediate Priorities (Next 2 Weeks)

### 1. Get Visibility into What's Working

| Task | Why | Time |
|------|-----|------|
| Submit sitemap to Google Search Console | Can't improve what you can't measure | 30 min |
| Submit to Bing Webmaster Tools | Low effort, incremental traffic | 15 min |
| Set up basic keyword tracking | Track 10-15 target keywords manually or via free tier tools | 1 hr |

### 2. Manual Competitor Audit (No Paid Tools)

Pick 3-4 competitors and document:

**Suggested competitors to analyze:**

- Teal (tealhq.com) - job tracker + resume tools
- Huntr (huntr.co) - job application tracker
- Jobscan (jobscan.co) - resume/job matching
- Kickresume or similar cover letter tools

**What to look for:**

- What pages are they ranking for? (Google their brand + your target keywords)
- What blog topics do they cover?
- How deep is their content? (word count, structure)
- What landing pages exist beyond the homepage?
- Where are they getting backlinks? (use free Ahrefs Webmaster Tools or Ubersuggest)

## Phase 1: Double Down on What's Working (Weeks 1-4)

### LinkedIn-First Content Strategy

Since LinkedIn is already your best channel, create content there that drives traffic back to your tools:

| Content Type | Example | CTA |
|--------------|---------|-----|
| Hot take posts | "Most cover letters fail in the first sentence. Here's why." | Link to cover letter generator |
| Before/after | Show a resume transformation (anonymized) | Link to Roast My Resume |
| Data/insights | "I analyzed 100 job postings for [role]. Here's what they actually want." | Link to Job Fit tool |
| Personal story | Your own job search experiences | General brand awareness |

**Cadence:** 3-4 posts/week on LinkedIn, repurpose best performers to blog later

This flips the typical SEO approach - instead of writing blog posts hoping they rank, you're validating content ideas on LinkedIn first, then turning winners into SEO content.

### Viral Loop: Roast My Resume

This tool has the most sharing potential. Prioritize:

- [x] Add LinkedIn share button to results
- [x] Create a shareable summary card/image (OG image already exists)
- [ ] Track shares as a conversion event in PostHog

## Phase 2: High-Intent Landing Pages (Weeks 3-6)

Skip the blog initially. Focus on pages where searchers are ready to use a tool:

| Page | Target Keyword | Status |
|------|----------------|--------|
| `/cover-letter-generator/software-engineer` | "software engineer cover letter" | Done |
| `/cover-letter-generator/product-manager` | "product manager cover letter" | Done |
| `/cover-letter-generator/data-analyst` | "data analyst cover letter" | Done |
| `/free-tools` | "free job search tools" | Done |

**Why these first:**

- Higher conversion intent than blog readers
- Less content to produce than full articles
- Can rank for long-tail keywords faster than competitive head terms

**Template for each page:**

1. H1 targeting the keyword
2. Brief intro (2-3 sentences)
3. The tool itself (embedded via CTA link)
4. Example output for that role
5. FAQ section (helps with featured snippets)
6. Internal links to related tools

## Phase 3: Lightweight Link Building (Weeks 4-8)

### Directory Submissions (Low Effort, Legitimate Links)

| Platform | Priority | Notes |
|----------|----------|-------|
| AlternativeTo | High | List as alternative to Teal, Huntr |
| Product Hunt | High | Time this strategically, not rushed |
| Indie Hackers | Medium | Share building journey, not just product |
| GitHub (if any open source components) | Medium | Readme links back to main site |

### Hold Off On

- Guest posting (time-intensive, validate other channels first)
- HARO (hit or miss, time sink)
- Podcast outreach (save for when you have more traction/story)

## Phase 4: Blog (Only After Validation) - Month 2+

Once you've validated which topics resonate on LinkedIn and which landing pages convert, *then* invest in blog content:

### Content Prioritization Framework

Only write blog posts that meet at least 2 of these criteria:

1. Already performed well on LinkedIn
2. Has clear keyword search volume (check via Ubersuggest free tier)
3. Directly relates to a tool you offer
4. Competitors are ranking but content is weak/outdated

### Realistic Cadence

- **Month 2:** 2 posts (test the workflow)
- **Month 3+:** 2-4 posts/month if seeing traction

## Tools Budget Recommendation

| Tool | Cost | When to Add |
|------|------|-------------|
| Google Search Console | Free | Now |
| Bing Webmaster Tools | Free | Now |
| Ahrefs Webmaster Tools | Free | Now (for your own site's backlink data) |
| Ubersuggest | Free tier / $29/mo | Now for free tier; paid if you need more queries |
| PostHog | Free tier | Already using |
| Ahrefs/SEMrush | $99-129/mo | Only after Month 3 if SEO is clearly working |

## Revised Metrics & Targets

| Metric | Baseline | 3-Month Target | 6-Month Target |
|--------|----------|----------------|----------------|
| Weekly visitors | 277 | 500 | 1,000 |
| Indexed pages | TBD (check Search Console) | 100% of public pages | - |
| Keywords in top 50 | TBD | 10 | 25 |
| Keywords in top 10 | TBD | 2-3 | 5-10 |
| LinkedIn → Site clicks | TBD | Track and grow 25% | - |
| Tool → Signup conversion | TBD | 10% | 15% |

## Weekly Time Investment

| Activity | Hours/Week |
|----------|------------|
| LinkedIn content creation | 2-3 hrs |
| Monitoring Search Console / analytics | 30 min |
| Landing page creation (during Phase 2) | 2-4 hrs |
| Competitor monitoring | 30 min |
| **Total** | **5-8 hrs/week** |

This is sustainable alongside other work. The original plan was solid but spread across too many initiatives simultaneously. This version sequences things so you're not fighting on all fronts at once.

## Decision Points

**End of Month 1:**

- Is organic traffic up from baseline?
- Which LinkedIn content drove the most clicks?
- Are role-specific landing pages getting indexed?

**End of Month 3:**

- Worth investing in Ahrefs/SEMrush?
- Is blog content ranking? Double down or deprioritize?
- Ready for Product Hunt launch?

## Questions Resolved

| Original Question | Recommendation |
|-------------------|----------------|
| Capacity for 2-4 blog posts/month? | Start with 0. Validate on LinkedIn first, then 2/month in Month 2+ |
| Budget for Ahrefs/SEMrush? | Not yet. Use free tools until Month 3+ |
| Product Hunt timing? | After landing pages are live and you have some social proof |
| Brand voice? | Let LinkedIn engagement tell you - test professional vs. casual |
