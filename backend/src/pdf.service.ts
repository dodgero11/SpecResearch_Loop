import { Injectable } from '@nestjs/common';
// markdown-it and pdfkit are CommonJS modules; the `import = require` form is
// required under this project's CommonJS tsconfig (no esModuleInterop).
// eslint-disable-next-line @typescript-eslint/no-require-imports
import MarkdownIt = require('markdown-it');
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

/**
 * Pure-JS Markdown → PDF renderer (pdfkit + markdown-it). No browser/Chromium
 * dependency, so it installs and runs reliably on any platform.
 */
@Injectable()
export class PdfService {
  private readonly md = new MarkdownIt();

  async render(markdown: string): Promise<Buffer> {
    const tokens = this.md.parse(markdown, {});
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    this.renderTokens(doc, tokens);
    doc.end();
    return done;
  }

  private renderTokens(doc: PDFKit.PDFDocument, tokens: Token[]): void {
    for (const token of tokens) {
      switch (token.type) {
        case 'heading_open': {
          const level = Number(token.tag.slice(1)) || 1;
          doc.fontSize(Math.max(12, 22 - (level - 1) * 4)).moveDown(0.4);
          break;
        }
        case 'paragraph_open':
          doc.moveDown(0.3);
          break;
        case 'bullet_list_open':
        case 'ordered_list_open':
          doc.moveDown(0.2);
          break;
        case 'inline':
          doc.text(token.content, { lineGap: 4 });
          break;
        default:
          break;
      }
    }
  }
}

type Token = {
  type: string;
  tag: string;
  content: string;
};