import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Opportunity {
  id: string;
  title: string;
  source: string;
  budget: string;
  deadline: string;
  description: string;
  tags: string[];
  status: 'open' | 'urgent' | 'closed';
  url?: string;
  matchScore?: number;
  aiSummary?: string;
}

export interface CompanyService {
  id: string;
  name: string;
  description: string;
}

export interface Source {
  id: number;
  url: string;
  name: string;
  is_subscribed: number;
  last_checked?: string;
  created_at: string;
}

export async function analyzeOpportunity(opportunity: Opportunity, companyProfile: string, services: CompanyService[]) {
  const servicesList = services.map(s => `- ${s.name}: ${s.description}`).join("\n");
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Analyze this IT project opportunity for my company.
      
      General Company Profile: ${companyProfile}
      
      Specific Services We Offer:
      ${servicesList}
      
      Opportunity:
      Title: ${opportunity.title}
      Description: ${opportunity.description}
      Tags: ${opportunity.tags.join(", ")}
      
      Provide a match score (0-100) based on how well the opportunity aligns with our specific services. 
      Also provide a brief summary of why we should or shouldn't bid, mentioning specific services that match.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchScore: { type: Type.NUMBER },
          aiSummary: { type: Type.STRING }
        },
        required: ["matchScore", "aiSummary"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function scrapeOpportunitiesFromUrl(url: string) {
  // In a real app, we'd use Gemini's urlContext tool
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract IT project opportunities from this URL: ${url}. Return a list of projects with title, description, budget, and deadline.`,
    config: {
      tools: [{ urlContext: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            url: { type: Type.STRING, description: "The direct URL to the project or bid details if available" },
            description: { type: Type.STRING },
            budget: { type: Type.STRING },
            deadline: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    }
  });

  return JSON.parse(response.text);
}
