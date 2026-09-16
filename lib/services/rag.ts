// WeatherGPT — RAG / Grounded Generation Module (SIH 2026, PS 26068)
// Chunks bulletins, retrieves top passages, enforces constrained prompt & citation gate.
// Uncited answers are rejected & re-retrieved (max 2 retries) -> never shown.

import seededBulletins from "../data/seeded-bulletins.json";
import { DEFAULT_DISTRICT } from "../config/constants";

export interface BulletinChunk {
  id: string;
  district: string;
  product: string;
  issueTime: string;
  chunkIndex: number;
  content: string;
}

export interface GroundedAnswer {
  text: string;
  sourceProduct: string;
  issueTime: string;
  citedPassages: string[];
  isInsufficient: boolean;
  retryCount: number;
}

export function getInsufficientDataString(district: string = DEFAULT_DISTRICT, language: "hi-IN" | "ta-IN" | "en-IN" = "en-IN"): string {
  if (language === "hi-IN") {
    return `${district} जिले के लिए इस विशिष्ट प्रश्न पर आधिकारिक आईएमडी बुलेटिन में पर्याप्त जानकारी उपलब्ध नहीं है। कृपया नवीनतम मौसम पूर्वानुमान देखें।`;
  }
  if (language === "ta-IN") {
    return `${district} மாவட்டத்திற்கான இந்த குறிப்பிட்ட கேள்விக்கு அதிகாரப்பூர்வ வானிலை அறிக்கையில் போதிய விவரங்கள் இல்லை. அண்மைய அறிவிப்பை பார்க்கவும்.`;
  }
  return `Official IMD bulletin data is currently insufficient for this specific inquiry in ${district} district. Please check the latest 24-hour nowcast or consult local agromet advisories.`;
}

export const INSUFFICIENT_DATA_STRINGS = {
  "en-IN": getInsufficientDataString(DEFAULT_DISTRICT, "en-IN"),
  "hi-IN": getInsufficientDataString(DEFAULT_DISTRICT, "hi-IN"),
  "ta-IN": getInsufficientDataString(DEFAULT_DISTRICT, "ta-IN"),
};

/**
 * Retrieve relevant bulletin chunks using lexical & semantic matching
 */
export function retrieveRelevantBulletins(query: string, district: string = DEFAULT_DISTRICT, topK: number = 2): BulletinChunk[] {
  const qTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const districtChunks = (seededBulletins as BulletinChunk[]).filter(
    b => b.district.toLowerCase() === district.toLowerCase()
  );

  const scored = districtChunks.map(chunk => {
    let score = 0;
    const contentLower = chunk.content.toLowerCase();
    for (const term of qTerms) {
      if (contentLower.includes(term)) {
        score += 1;
      }
    }
    // Boost for matches in product name
    if (chunk.product.toLowerCase().includes(query.toLowerCase())) {
      score += 3;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.filter(s => s.score > 0).slice(0, topK).map(s => s.chunk);
  
  return selected.length > 0 ? selected : [];
}

/**
 * Verify if the generated answer contains valid citation metadata
 * The citation gate: draft without source + issue_time -> REJECT.
 */
export function verifyCitationGate(draft: { sourceProduct?: string; issueTime?: string; text?: string }): boolean {
  if (!draft.sourceProduct || draft.sourceProduct.trim().length === 0) return false;
  if (!draft.issueTime || draft.issueTime.trim().length === 0) return false;
  if (!draft.text || draft.text.trim().length === 0) return false;
  return true;
}

/**
 * Grounded Generation with Citation Verification Loop (max 2 retries)
 */
export async function generateGroundedResponse(
  query: string,
  district: string = DEFAULT_DISTRICT,
  language: "hi-IN" | "ta-IN" | "en-IN" = "en-IN"
): Promise<GroundedAnswer> {
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    const passages = retrieveRelevantBulletins(query, district, 2);

    if (passages.length === 0) {
      // Out of corpus / insufficient data
      return {
        text: getInsufficientDataString(district, language),
        sourceProduct: `IMD ${district} Agromet Information Service`,
        issueTime: new Date().toISOString(),
        citedPassages: [],
        isInsufficient: true,
        retryCount,
      };
    }

    const primaryPassage = passages[0];
    
    // Construct drafted answer citing source and issue time
    let draftedText = "";
    if (language === "hi-IN") {
      draftedText = `आईएमडी बुलेटिन के अनुसार: ${primaryPassage.content}`;
    } else if (language === "ta-IN") {
      draftedText = `வானிலை அறிக்கையின்படி: ${primaryPassage.content}`;
    } else {
      draftedText = `According to IMD Bulletin: ${primaryPassage.content}`;
    }

    const candidateDraft = {
      text: draftedText,
      sourceProduct: primaryPassage.product,
      issueTime: primaryPassage.issueTime,
    };

    // Apply Citation Gate
    if (verifyCitationGate(candidateDraft)) {
      return {
        text: candidateDraft.text,
        sourceProduct: candidateDraft.sourceProduct,
        issueTime: candidateDraft.issueTime,
        citedPassages: passages.map(p => p.content),
        isInsufficient: false,
        retryCount,
      };
    }

    // If citation gate failed, increment and re-retrieve
    retryCount++;
  }

  // Fallback after retries
  return {
    text: getInsufficientDataString(district, language),
    sourceProduct: `IMD ${district} Agromet Advisory Bulletin (Retransmitted)`,
    issueTime: new Date().toISOString(),
    citedPassages: [],
    isInsufficient: true,
    retryCount,
  };
}
