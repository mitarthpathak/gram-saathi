import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

/** A scheme document from data/schemes, without front matter and HTML comments. */
export interface SchemeDocument {
  schemeId: string;
  schemeName: string;
  /** File name inside data/schemes, e.g. "pm-kisan.md". */
  sourceFile: string;
  officialUrl?: string;
  /** Front matter `sample: true`: placeholder text to be replaced by the official text. */
  sample: boolean;
  /** Front matter `verified: true`: someone checked every fact against officialUrl. */
  verified: boolean;
  /** Markdown or plain text. */
  body: string;
}

export const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt', '.pdf'];

/** Loads every supported file in `dir` except README.md, sorted by file name. */
export async function loadSchemeDocuments(dir: string): Promise<SchemeDocument[]> {
  const files = (await readdir(dir))
    .filter((file) => SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .filter((file) => file.toLowerCase() !== 'readme.md')
    .sort();

  const documents: SchemeDocument[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const raw =
        path.extname(file).toLowerCase() === '.pdf'
          ? await readPdfText(fullPath)
          : await readFile(fullPath, 'utf8');
      documents.push(parseSchemeDocument(file, raw));
    } catch (error) {
      throw new Error(`Could not read ${file}: ${(error as Error).message}`, { cause: error });
    }
  }

  const seen = new Map<string, string>();
  for (const document of documents) {
    const other = seen.get(document.schemeId);
    if (other) {
      throw new Error(
        `schemeId "${document.schemeId}" is used by both ${other} and ${document.sourceFile}`,
      );
    }
    seen.set(document.schemeId, document.sourceFile);
  }
  return documents;
}

/** Returns only material explicitly verified against a secure official government source. */
export function verifiedOfficialDocuments(documents: SchemeDocument[]): SchemeDocument[] {
  return documents.filter(
    (document) =>
      document.verified && !document.sample && isOfficialSourceUrl(document.officialUrl),
  );
}

/** Accept government domains and PFRDA, the statutory pension regulator's official domain. */
export function isOfficialSourceUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return (
      url.protocol === 'https:' &&
      (host.endsWith('.gov.in') || host.endsWith('.nic.in') || host === 'pfrda.org.in')
    );
  } catch {
    return false;
  }
}

/** Parses one file's text. Front matter fields win; otherwise the id comes from the file name. */
export function parseSchemeDocument(sourceFile: string, raw: string): SchemeDocument {
  const { data, body } = splitFrontMatter(raw);
  const text = body.replace(/<!--[\s\S]*?-->/g, '').trim();
  const fileId = slugify(path.parse(sourceFile).name);
  return {
    schemeId: stringField(data.schemeId) ?? fileId,
    schemeName: stringField(data.schemeName) ?? /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? fileId,
    sourceFile,
    officialUrl: stringField(data.officialUrl),
    sample: data.sample === true,
    verified: data.verified === true,
    body: text,
  };
}

const FRONT_MATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Separates a leading `---` YAML block from the rest of the file. */
export function splitFrontMatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = FRONT_MATTER.exec(raw);
  if (!match) return { data: {}, body: raw };
  const parsed: unknown = parseYaml(match[1]);
  const data =
    typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  return { data, body: raw.slice(match[0].length) };
}

/** "PM-KISAN: How to apply" -> "pm-kisan-how-to-apply" */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Fingerprint of the documents' content, used to warn when the vector store is out of date. */
export function fingerprintDocuments(documents: SchemeDocument[]): string {
  const hash = createHash('sha256');
  const sorted = [...documents].sort((a, b) => a.sourceFile.localeCompare(b.sourceFile));
  for (const document of sorted) {
    hash.update(
      `${document.sourceFile}\0${document.schemeId}\0${document.schemeName}\0` +
        `${document.officialUrl ?? ''}\0${document.sample}\0${document.verified}\0`,
    );
    hash.update(`${document.body}\0`);
  }
  return hash.digest('hex').slice(0, 16);
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Plain text of a PDF. PDFs have no headings, so they become one "Overview" section. */
async function readPdfText(filePath: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await readFile(filePath)));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
