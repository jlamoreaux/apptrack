import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type { JobFitAnalysisResult } from '@/types/ai-analysis';

interface PDFRequest {
  analysis: JobFitAnalysisResult;
  applicationInfo?: {
    company: string;
    role: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: PDFRequest = await req.json();
    const { analysis, applicationInfo } = body;

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis data is required' },
        { status: 400 }
      );
    }

    // Generate HTML content (same as client-side but optimized for PDF)
    const htmlContent = generatePDFHTML(analysis, applicationInfo);

    // For now, we'll use a client-side PDF generation approach
    // In production, you'd want to use Puppeteer or similar
    
    // Return the HTML and let the client convert it
    // This is a temporary solution until we add Puppeteer
    return NextResponse.json({ 
      html: htmlContent,
      filename: generateFilename(applicationInfo)
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

function generatePDFHTML(
  analysis: JobFitAnalysisResult, 
  applicationInfo?: { company: string; role: string }
): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const scoreColor = analysis.overallScore >= 85 ? '#059669' : 
                     analysis.overallScore >= 75 ? '#2563eb' : 
                     analysis.overallScore >= 65 ? '#d97706' : '#dc2626';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Job Fit Analysis Report</title>
    <style>
        @page {
            margin: 1in;
            size: letter;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 0;
            font-size: 14px;
        }
        
        .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
            page-break-after: avoid;
        }
        
        .header h1 {
            color: #1e40af;
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 700;
        }
        
        .header .subtitle {
            color: #6b7280;
            margin: 8px 0;
            font-size: 16px;
        }
        
        .score-section {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 2px solid #93c5fd;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .score {
            font-size: 48px;
            font-weight: 900;
            color: ${scoreColor};
            margin: 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .score-label {
            font-size: 20px;
            font-weight: 600;
            color: #374151;
            margin-top: 8px;
        }
        
        .match-breakdown {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .match-item {
            text-align: center;
            padding: 20px 15px;
            background: #f9fafb;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .match-item h4 {
            margin: 0 0 10px 0;
            color: #374151;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .match-item .percentage {
            font-size: 24px;
            font-weight: 800;
            color: #1f2937;
        }
        
        .section {
            margin: 35px 0;
            page-break-inside: avoid;
        }
        
        .section h3 {
            color: #1f2937;
            border-left: 5px solid #2563eb;
            padding-left: 20px;
            margin-bottom: 20px;
            font-size: 20px;
            font-weight: 700;
            page-break-after: avoid;
        }
        
        .section.strengths h3 { border-left-color: #059669; }
        .section.weaknesses h3 { border-left-color: #dc2626; }
        .section.requirements h3 { border-left-color: #2563eb; }
        .section.recommendations h3 { border-left-color: #7c3aed; }
        
        .list-item {
            background: #f9fafb;
            margin: 12px 0;
            padding: 15px 20px;
            border-radius: 8px;
            border-left: 4px solid #e5e7eb;
            font-size: 15px;
            line-height: 1.5;
            break-inside: avoid;
        }
        
        .list-item.strength { border-left-color: #059669; background: #f0fdf4; }
        .list-item.weakness { border-left-color: #dc2626; background: #fef2f2; }
        .list-item.requirement { border-left-color: #2563eb; background: #eff6ff; }
        .list-item.recommendation { border-left-color: #7c3aed; background: #faf5ff; }
        
        .footer {
            margin-top: 50px;
            padding-top: 25px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            page-break-inside: avoid;
        }
        
        .footer p {
            margin: 8px 0;
        }
        
        @media print {
            body { 
                margin: 0; 
                padding: 0;
                font-size: 12px;
            }
            .header { 
                page-break-after: avoid; 
            }
            .section { 
                page-break-inside: avoid; 
            }
            .score-section {
                page-break-inside: avoid;
                margin: 15px 0;
            }
            .match-breakdown {
                page-break-inside: avoid;
                margin: 15px 0;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Job Fit Analysis Report</h1>
        ${applicationInfo ? `<div class="subtitle"><strong>${applicationInfo.role}</strong> at <strong>${applicationInfo.company}</strong></div>` : ''}
        <div class="subtitle">Generated on ${formatDate(analysis.generatedAt)}</div>
    </div>
    
    <div class="score-section">
        <div class="score">${analysis.overallScore}%</div>
        <div class="score-label">${analysis.scoreLabel}</div>
    </div>
    
    <div class="match-breakdown">
        <div class="match-item">
            <h4>Skills Match</h4>
            <div class="percentage">${analysis.matchDetails?.skillsMatch || 0}%</div>
        </div>
        <div class="match-item">
            <h4>Experience Match</h4>
            <div class="percentage">${analysis.matchDetails?.experienceMatch || 0}%</div>
        </div>
        <div class="match-item">
            <h4>Education Match</h4>
            <div class="percentage">${analysis.matchDetails?.educationMatch || 0}%</div>
        </div>
    </div>
    
    <div class="section strengths">
        <h3>Your Strengths</h3>
        ${analysis.strengths?.length ? 
          analysis.strengths.map(strength => 
            `<div class="list-item strength">${strength}</div>`
          ).join('') : 
          '<div class="list-item">No strengths data available</div>'
        }
    </div>
    
    <div class="section weaknesses">
        <h3>Areas to Address</h3>
        ${analysis.weaknesses?.length ? 
          analysis.weaknesses.map(weakness => 
            `<div class="list-item weakness">${weakness}</div>`
          ).join('') : 
          '<div class="list-item">No areas for improvement data available</div>'
        }
    </div>
    
    <div class="section requirements">
        <h3>Key Requirements</h3>
        ${analysis.keyRequirements?.length ? 
          analysis.keyRequirements.map(req => 
            `<div class="list-item requirement">${req}</div>`
          ).join('') : 
          '<div class="list-item">No key requirements data available</div>'
        }
    </div>
    
    <div class="section recommendations">
        <h3>Recommendations</h3>
        ${analysis.recommendations?.length ? 
          analysis.recommendations.map(rec => 
            `<div class="list-item recommendation">${rec}</div>`
          ).join('') : 
          '<div class="list-item">No recommendations data available</div>'
        }
    </div>
    
    <div class="footer">
        <p><strong>This report was generated by AppTrack AI Coach</strong></p>
        <p>For the most up-to-date analysis, visit your AppTrack dashboard</p>
        <p>Generated on ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
    </div>
</body>
</html>`;
}

function generateFilename(applicationInfo?: { company: string; role: string }): string {
  if (applicationInfo) {
    const company = applicationInfo.company.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const role = applicationInfo.role.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `job-fit-analysis-${company}-${role}.pdf`;
  }
  return `job-fit-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
}