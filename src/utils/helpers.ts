import { createHash } from 'node:crypto';

export function generateHash(content: string, algorithm = 'sha256'): string {
  return createHash(algorithm).update(content).digest('hex');
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');
}

export function urlToFilename(url: string): string {
  // Remove domain and protocol
  let filename = url.replace(/^https?:\/\/docs\.bucketeer\.io\/?/, '');
  // Replace invalid file characters
  filename = filename.replace(/[\/?<>\\:*|"]/g, '-');
  // Clean up repeated hyphens
  filename = filename.replace(/-+/g, '-');
  // Remove leading and trailing hyphens
  filename = filename.replace(/^-|-$/g, '');

  // Handle long filenames with hash
  if (filename.length > 100) {
    const hash = createHash('md5').update(url).digest('hex').substring(0, 8);
    filename = `${filename.substring(0, 92)}-${hash}`;
  }

  // Default name for empty filename
  if (!filename || filename === '-') {
    filename = 'index';
  }

  return `${filename}.json`;
}

// Extract keywords from content - enhanced for Bucketeer docs
export function extractKeywords(content: string): string[] {
  // Technical terms common in Bucketeer docs
  const technicalTerms = new Set([
    'feature',
    'flag',
    'bucket',
    'targeting',
    'segment',
    'variation',
    'rollout',
    'experiment',
    'api',
    'sdk',
    'environment',
    'evaluation',
    'event',
    'goal',
    'conversion',
    'track',
    'metrics',
    'webhook',
    'integration',
    'token',
  ]);

  // Common stop words to filter out
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'in',
    'on',
    'at',
    'to',
    'for',
    'with',
    'by',
    'about',
    'against',
    'between',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'from',
    'up',
    'down',
    'of',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'they',
    'them',
    'their',
    'what',
    'which',
    'who',
    'whom',
    'when',
    'where',
    'why',
    'how',
    'all',
    'any',
    'both',
    'each',
    'few',
    'more',
    'most',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'can',
    'will',
    'just',
    'should',
    'now',
  ]);

  // Extract all words
  const words = content
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[[^\]]*\]\([^)]*\)/g, '') // Remove markdown links
    .replace(/[^\w\s-]/g, ' ') // Remove special chars except hyphen
    .split(/\s+/)
    .filter((word) => {
      // Keep technical terms regardless of length
      if (technicalTerms.has(word)) return true;

      // Filter out stop words and short words
      return word.length > 2 && !stopWords.has(word);
    });

  // Return unique keywords
  return Array.from(new Set(words));
}
