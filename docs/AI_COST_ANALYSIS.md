# AI Feature Cost Analysis

## Token Pricing

### GPT-4 (Current pricing)
- **Input**: $3 per million tokens ($0.003 per 1K tokens)
- **Output**: $15 per million tokens ($0.015 per 1K tokens)

### GPT-3.5 (Alternative for cost savings)
- **Input**: $3.75 per million tokens ($0.00375 per 1K tokens) - 25% MORE expensive than GPT-4!
- **Output**: $18.75 per million tokens ($0.01875 per 1K tokens) - 25% MORE expensive than GPT-4!

⚠️ **IMPORTANT: GPT-3.5 is actually MORE EXPENSIVE than GPT-4!**

### GPT-4o-mini (Best for cost optimization)
- **Input**: $0.15 per million tokens ($0.00015 per 1K tokens) - 95% cheaper than GPT-4!
- **Output**: $0.60 per million tokens ($0.0006 per 1K tokens) - 96% cheaper than GPT-4!

## Cost Comparison Table

| Model | Input (per 1K) | Output (per 1K) | vs GPT-4 |
|-------|---------------|-----------------|----------|
| GPT-4 | $0.003 | $0.015 | Baseline |
| GPT-3.5 | $0.00375 | $0.01875 | 25% MORE expensive |
| GPT-4o-mini | $0.00015 | $0.0006 | 95% cheaper |
| Claude Haiku | $0.00025 | $0.00125 | 92% cheaper |

## Estimated Token Usage Per Feature

### Resume Analysis
- **Input**: ~2,000 tokens (resume + prompt)
- **Output**: ~1,500 tokens (detailed analysis)
- **Total Cost**: $0.029 per analysis
  - Input: 2K × $0.003 = $0.006
  - Output: 1.5K × $0.015 = $0.023

### Interview Preparation
- **Input**: ~1,500 tokens (job description + context)
- **Output**: ~2,000 tokens (10-15 questions with answers)
- **Total Cost**: $0.035 per session
  - Input: 1.5K × $0.003 = $0.005
  - Output: 2K × $0.015 = $0.030

### Cover Letter Generation
- **Input**: ~2,500 tokens (job desc + resume + prompt)
- **Output**: ~800 tokens (cover letter)
- **Total Cost**: $0.020 per letter
  - Input: 2.5K × $0.003 = $0.008
  - Output: 0.8K × $0.015 = $0.012

### Career Advice Chat
- **Input**: ~500 tokens per message (with context)
- **Output**: ~400 tokens per response
- **Total Cost**: $0.008 per exchange
  - Input: 0.5K × $0.003 = $0.002
  - Output: 0.4K × $0.015 = $0.006

### Job Fit Analysis
- **Input**: ~3,000 tokens (job desc + resume + prompt)
- **Output**: ~1,200 tokens (analysis)
- **Total Cost**: $0.027 per analysis
  - Input: 3K × $0.003 = $0.009
  - Output: 1.2K × $0.015 = $0.018

## Cost Analysis by Subscription Tier

### Free Tier ($0/month)
**NO AI ACCESS** - No costs incurred

### Pro Tier ($X/month)
Daily limits with estimated max monthly cost:

| Feature | Daily Limit | Monthly Uses (30 days) | Cost per Use | Max Monthly Cost |
|---------|------------|------------------------|--------------|------------------|
| Resume Analysis | 10 | 300 | $0.029 | $8.70 |
| Interview Prep | 20 | 600 | $0.035 | $21.00 |
| Cover Letter | 15 | 450 | $0.020 | $9.00 |
| Career Advice | 50 | 1,500 | $0.008 | $12.00 |
| Job Fit Analysis | 30 | 900 | $0.027 | $24.30 |
| **TOTAL** | | | | **$75.00** |

**Realistic usage** (30% of limits): ~$22.50/month per user

### AI Coach Tier ($Y/month) 
Daily limits with estimated max monthly cost:

| Feature | Daily Limit | Monthly Uses (30 days) | Cost per Use | Max Monthly Cost |
|---------|------------|------------------------|--------------|------------------|
| Resume Analysis | 50 | 1,500 | $0.029 | $43.50 |
| Interview Prep | 100 | 3,000 | $0.035 | $105.00 |
| Cover Letter | 75 | 2,250 | $0.020 | $45.00 |
| Career Advice | 500 | 15,000 | $0.008 | $120.00 |
| Job Fit Analysis | 150 | 4,500 | $0.027 | $121.50 |
| **TOTAL** | | | | **$435.00** |

**Realistic usage** (20% of limits): ~$87.00/month per user

## Hourly Burst Limits Cost Impact

### Pro Tier - Hourly Maximums
If a Pro user maxes out their hourly limits repeatedly:

| Feature | Hourly Limit | Max Daily (8 active hours) | Daily Cost |
|---------|-------------|---------------------------|------------|
| Resume Analysis | 3 | 24 (capped at 10) | $0.29 |
| Interview Prep | 5 | 40 (capped at 20) | $0.70 |
| Cover Letter | 3 | 24 (capped at 15) | $0.30 |
| Career Advice | 10 | 80 (capped at 50) | $0.40 |
| Job Fit Analysis | 5 | 40 (capped at 30) | $0.81 |

### AI Coach Tier - Hourly Maximums
If an AI Coach user maxes out their hourly limits:

| Feature | Hourly Limit | Max Daily (8 active hours) | Daily Cost |
|---------|-------------|---------------------------|------------|
| Resume Analysis | 10 | 80 (capped at 50) | $1.45 |
| Interview Prep | 20 | 160 (capped at 100) | $3.50 |
| Cover Letter | 15 | 120 (capped at 75) | $1.50 |
| Career Advice | 50 | 400 (capped at 500) | $4.00 |
| Job Fit Analysis | 30 | 240 (capped at 150) | $4.05 |

## Cost Management Strategies

### 1. Pricing Recommendations

#### Pro Tier Pricing
- **Suggested Price**: $29-39/month
- **Max API Cost**: $75/month (if fully utilized)
- **Realistic Cost**: $20-25/month (30% usage)
- **Gross Margin**: 40-60% after API costs

#### AI Coach Tier Pricing  
- **Suggested Price**: $99-149/month
- **Max API Cost**: $435/month (if fully utilized)
- **Realistic Cost**: $80-90/month (20% usage)
- **Gross Margin**: 40-50% after API costs

### 2. Cost Optimization Techniques

1. **Implement Caching** ✅
   - Cache similar job analyses for 24 hours
   - Reuse interview questions for same role/company
   - Saves ~20-30% on API costs

2. **Alternative Model Options**
   - ❌ **GPT-3.5 is MORE expensive** (25% higher costs!)
   - ✅ Consider **Claude Haiku** ($0.25/1M input, $1.25/1M output) - 90% cheaper
   - ✅ Consider **Mixtral** via Groq (even cheaper)
   - ✅ Use **GPT-4o-mini** ($0.15/1M input, $0.60/1M output) - 95% cheaper!

3. **Use GPT-4o-mini for High-Volume Features**
   - Career advice chat: $0.00015 input, $0.0006 output per 1K tokens
   - Cost reduction: 95% compared to GPT-4
   - Monthly savings: ~$115 per power user on chat features alone

4. **Smart Batching**
   - Combine multiple analyses in single API call
   - Reduces redundant context tokens
   - Saves 15-20% on input costs

## Break-Even Analysis

### Pro Tier
- **Subscription Price**: $35/month
- **Average API Cost**: $22.50/month
- **Other Costs** (infrastructure, support): $5/month
- **Profit per User**: $7.50/month
- **Break-even**: Immediate (positive from day 1)

### AI Coach Tier
- **Subscription Price**: $125/month
- **Average API Cost**: $87/month
- **Other Costs** (infrastructure, support): $8/month
- **Profit per User**: $30/month
- **Break-even**: Immediate (positive from day 1)

## Risk Scenarios

### Worst Case: Power User Maxes Everything
- **AI Coach User**: $435/month cost
- **At $125/month price**: Loss of $310/month
- **Mitigation**: 
  - Monitor usage patterns
  - Implement surge pricing
  - Temporary throttling for extreme usage

### Best Case: Typical Professional User
- **Uses 15-20% of limits**
- **Pro Tier Cost**: $15/month → $20 profit
- **AI Coach Cost**: $65/month → $60 profit

## Recommendations

### Immediate Actions
1. **Set Pro Tier at $35/month** - Good margins with moderate usage
2. **Set AI Coach at $125/month** - Premium pricing for power users
3. **Implement GPT-3.5 for chat** - Huge cost savings
4. **Add usage-based pricing tier** - For enterprise/extreme users

### Monitoring Metrics
- Track per-user API costs daily
- Alert when user exceeds 50% of subscription price in API costs
- Weekly cohort analysis of usage patterns
- Monthly review of pricing vs actual costs

### Long-term Strategy
1. **Negotiate volume discounts** with OpenAI/Anthropic
2. **Build in-house models** for common tasks
3. **Implement smart caching** to reduce redundant calls
4. **Consider usage-based pricing** for power users exceeding 2x normal usage

## Cost Optimization with GPT-4o-mini

### Dramatic Savings Using GPT-4o-mini

If we use GPT-4o-mini for appropriate features (career chat, initial analyses):

#### Pro Tier with GPT-4o-mini
| Feature | Daily Limit | Cost with GPT-4 | Cost with 4o-mini | Savings |
|---------|------------|-----------------|-------------------|---------|
| Career Advice | 50 | $0.40/day | $0.016/day | 96% |
| Interview Prep | 20 | $0.70/day | $0.028/day | 96% |
| **Monthly Total** | | $33/month | $1.32/month | **$31.68 saved** |

#### AI Coach Tier with GPT-4o-mini  
| Feature | Daily Limit | Cost with GPT-4 | Cost with 4o-mini | Savings |
|---------|------------|-----------------|-------------------|---------|
| Career Advice | 500 | $4.00/day | $0.16/day | 96% |
| Interview Prep | 100 | $3.50/day | $0.14/day | 96% |
| **Monthly Total** | | $225/month | $9/month | **$216 saved** |

### Recommended Model Strategy

1. **Use GPT-4** for:
   - Resume Analysis (needs high quality)
   - Cover Letter Generation (final output quality matters)
   - Job Fit Analysis (complex reasoning)

2. **Use GPT-4o-mini** for:
   - Career Advice Chat (conversational, high volume)
   - Interview Prep (can generate good questions)
   - Initial drafts that users can refine

This hybrid approach reduces costs by **60-70%** while maintaining quality.

## Summary

With the new limits:

| Tier | Monthly Price | Max API Cost | Typical API Cost | Gross Margin |
|------|--------------|--------------|------------------|--------------|
| Free | $0 | $0 | $0 | N/A |
| Pro | $35 | $75 | $22.50 | 36% |
| AI Coach | $125 | $435 | $87 | 30% |

**Key Insights:**
- Free tier has zero AI costs (no access)
- Pro tier is profitable with good margins at typical usage
- AI Coach tier needs monitoring for power users but profitable on average
- Consider implementing surge pricing or usage-based pricing for users consistently exceeding 150% of typical usage

---

*Note: All calculations assume GPT-4 level pricing. Using GPT-3.5 for appropriate features can reduce costs by 80-90%.*