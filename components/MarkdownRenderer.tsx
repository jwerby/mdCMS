import React, { useMemo, memo, useEffect, useState } from 'react';
import { ArrowRight, Zap } from 'lucide-react';
import { getSafeUrl, getSafeImageSrc } from '../lib/security/url-sanitizer';
import { parseInlineText, contentHash } from '../lib/markdown/inline-parser';

interface MarkdownRendererProps {
  content: string;
}

// Types for nested structures
interface ListItem {
  content: string;
  children: ListItem[];
  isTask?: boolean;
  isChecked?: boolean;
}

// Memoized inline parser for this component's styles
const parseInline = (text: string, key: number = 0): React.ReactNode[] => {
  return parseInlineText(text, key);
};

// Helper to get indentation level (number of leading spaces/tabs)
const getIndent = (line: string): number => {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  // Count tabs as 2 spaces
  return match[1].replace(/\t/g, '  ').length;
};

// Recursive list renderer
const renderNestedList = (
  items: ListItem[],
  ordered: boolean,
  depth: number,
  keyPrefix: string
): React.ReactNode => {
  if (items.length === 0) return null;

  const ListTag = ordered ? 'ol' : 'ul';

  return (
    <ListTag key={keyPrefix} className={`${depth === 0 ? 'my-6' : 'mt-2'} space-y-2 ${depth > 0 ? 'ml-6' : 'ml-6'}`}>
      {items.map((item, idx) => {
        // Task list item
        if (item.isTask !== undefined) {
          return (
            <li key={`${keyPrefix}-${idx}`} className="flex items-start gap-3">
              <span className={`w-5 h-5 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                item.isChecked
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-300 bg-white'
              }`} role="checkbox" aria-checked={item.isChecked}>
                {item.isChecked && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <div className={`flex-1 ${item.isChecked ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--a11y-text)' }}>
                <span className="text-lg leading-relaxed">{parseInline(item.content)}</span>
                {item.children.length > 0 && renderNestedList(item.children, ordered, depth + 1, `${keyPrefix}-${idx}-c`)}
              </div>
            </li>
          );
        }

        // Regular list item
        return (
          <li key={`${keyPrefix}-${idx}`} className="text-lg leading-relaxed flex items-start gap-3" style={{ color: 'var(--a11y-text)' }}>
            {ordered ? (
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {idx + 1}
              </span>
            ) : (
              <span className={`w-2 h-2 rounded-full bg-indigo-${depth === 0 ? '500' : depth === 1 ? '400' : '300'} mt-2.5 flex-shrink-0`}></span>
            )}
            <div className="flex-1">
              <span>{parseInline(item.content)}</span>
              {item.children.length > 0 && renderNestedList(item.children, ordered, depth + 1, `${keyPrefix}-${idx}-c`)}
            </div>
          </li>
        );
      })}
    </ListTag>
  );
};

// Recursive blockquote renderer for nested quotes
const renderNestedBlockquote = (
  lines: string[],
  depth: number,
  keyPrefix: string,
  parseInlineFn: typeof parseInline
): React.ReactNode => {
  const content: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts a deeper nested quote
    if (line.startsWith('>')) {
      const nestedLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        nestedLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      content.push(
        <div key={`${keyPrefix}-nested-${i}`} className="mt-3">
          {renderNestedBlockquote(nestedLines, depth + 1, `${keyPrefix}-${i}`, parseInlineFn)}
        </div>
      );
      continue;
    }

    // Regular text
    if (line.trim()) {
      content.push(
        <p key={`${keyPrefix}-p-${i}`} className={i > 0 ? 'mt-2' : ''}>
          {parseInlineFn(line)}
        </p>
      );
    }
    i++;
  }

  const borderColors = ['border-indigo-400', 'border-indigo-300', 'border-indigo-200'];
  const bgColors = ['bg-indigo-50/50', 'bg-indigo-50/30', 'bg-indigo-50/20'];

  return (
    <blockquote className={`pl-4 border-l-4 ${borderColors[Math.min(depth, 2)]} ${bgColors[Math.min(depth, 2)]} py-3 pr-3 rounded-r-lg`}>
      <div className="text-lg leading-relaxed" style={{ color: 'var(--a11y-text-heading)' }}>
        {content}
      </div>
    </blockquote>
  );
};

const MarkdownRendererComponent: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [showRenderTime, setShowRenderTime] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) {
      setShowRenderTime(true);
    }
  }, []);

  const start = import.meta.env.DEV && typeof performance !== 'undefined' ? performance.now() : 0;

  const elements = useMemo(() => {
    const lines = content.split('\n');
    const result: React.ReactNode[] = [];

    // First pass: collect footnote definitions
    const footnotes: Map<string, string> = new Map();
    for (const line of lines) {
      const footnoteDefMatch = line.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
      if (footnoteDefMatch) {
        footnotes.set(footnoteDefMatch[1], footnoteDefMatch[2]);
      }
    }

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Skip footnote definitions (already collected)
      if (trimmed.match(/^\[\^[^\]]+\]:\s*.+$/)) {
        i++;
        continue;
      }

      // Code Blocks - capture language for syntax highlighting
      if (trimmed.startsWith('```')) {
        const language = trimmed.slice(3).trim() || 'text';
        const codeBlock: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeBlock.push(lines[i]);
          i++;
        }
        i++;
        result.push(
          <div key={`code-${i}`} className="my-10 rounded-2xl overflow-hidden border border-slate-200 shadow-xl shadow-slate-100">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Zap className="w-3 h-3 text-indigo-500" /> {language !== 'text' ? language : 'Code'}
              </span>
            </div>
            <pre className="p-8 bg-slate-900 text-slate-200 overflow-x-auto font-mono text-sm leading-relaxed">
              <code className={`language-${language}`}>{codeBlock.join('\n')}</code>
            </pre>
          </div>
        );
        continue;
      }

      // Breakouts
      if (trimmed.startsWith('> BREAKOUT:')) {
        result.push(
          <div key={`breakout-${i}`} className="my-20 -mx-4 md:-mx-24 lg:-mx-48 bg-indigo-600 text-white p-12 md:p-24 rounded-[3.5rem] shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -mr-48 -mt-48 blur-[100px]"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full -ml-48 -mb-48 blur-[100px]"></div>
            <div className="max-w-3xl mx-auto relative z-10 italic text-3xl md:text-5xl font-light leading-tight serif tracking-tight">
              {parseInline(trimmed.replace('> BREAKOUT:', '').trim().replace(/^"|"$/g, ''))}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // CTAs
      if (trimmed.startsWith('> CTA:')) {
        const title = trimmed.replace('> CTA:', '').trim();
        let description = '';
        let buttonLabel = '';
        let buttonLink = '';

        i++;
        if (i < lines.length && lines[i].startsWith('>')) {
          description = lines[i].replace(/^>\s*/, '').trim();
          i++;
        }
        if (i < lines.length && lines[i].startsWith('>')) {
          const match = lines[i].match(/\[(.*?)\]\((.*?)\)/);
          if (match) {
            buttonLabel = match[1];
            buttonLink = match[2];
          }
          i++;
        }

        result.push(
          <div key={`cta-${i}`} className="my-16 p-12 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl border border-white/5">
            <div className="flex-1">
              <h4 className="text-3xl font-bold mb-4 serif tracking-tight">{parseInline(title)}</h4>
              <p className="text-slate-400 text-lg leading-relaxed font-light">{parseInline(description)}</p>
            </div>
            {buttonLabel && (
              <a href={getSafeUrl(buttonLink)} className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 flex items-center gap-3 whitespace-nowrap active:scale-95 text-lg">
                {buttonLabel} <ArrowRight className="w-5 h-5" />
              </a>
            )}
          </div>
        );
        continue;
      }

      // Images
      const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imageMatch) {
        const [, alt, src] = imageMatch;
        const safeSrc = getSafeImageSrc(src);
        result.push(
          <figure key={`img-${i}`} className="my-12">
            <img
              src={safeSrc}
              alt={alt}
              loading="lazy"
              className="w-full rounded-2xl shadow-lg"
            />
            {alt && <figcaption className="text-center text-sm text-slate-500 mt-4">{alt}</figcaption>}
          </figure>
        );
        i++;
        continue;
      }

      // Headers (check longer patterns first) - with reduced margins
      if (trimmed.startsWith('###### ')) {
        result.push(<h6 key={`h6-${i}`} className="text-sm font-semibold mt-6 mb-3 uppercase tracking-wide" style={{ color: 'var(--a11y-text)' }}>{parseInline(trimmed.replace('###### ', ''))}</h6>);
        i++; continue;
      }
      if (trimmed.startsWith('##### ')) {
        result.push(<h5 key={`h5-${i}`} className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--a11y-text-heading)' }}>{parseInline(trimmed.replace('##### ', ''))}</h5>);
        i++; continue;
      }
      if (trimmed.startsWith('#### ')) {
        result.push(<h4 key={`h4-${i}`} className="text-lg font-bold mt-8 mb-4" style={{ color: 'var(--a11y-text-heading)' }}>{parseInline(trimmed.replace('#### ', ''))}</h4>);
        i++; continue;
      }
      if (trimmed.startsWith('### ')) {
        result.push(<h3 key={`h3-${i}`} className="text-2xl font-bold mt-10 mb-4 tracking-tight leading-snug" style={{ color: 'var(--a11y-text-heading)' }}>{parseInline(trimmed.replace('### ', ''))}</h3>);
        i++; continue;
      }
      if (trimmed.startsWith('## ')) {
        result.push(<h2 key={`h2-${i}`} className="text-3xl md:text-4xl font-bold mt-12 mb-5 tracking-tight leading-tight" style={{ color: 'var(--a11y-text-heading)', fontFamily: 'var(--a11y-font-heading)' }}>{parseInline(trimmed.replace('## ', ''))}</h2>);
        i++; continue;
      }
      if (trimmed.startsWith('# ')) {
        result.push(<h1 key={`h1-${i}`} className="text-4xl md:text-6xl font-black mb-8 leading-tight tracking-tight" style={{ color: 'var(--a11y-text-heading)', fontFamily: 'var(--a11y-font-heading)' }}>{parseInline(trimmed.replace('# ', ''))}</h1>);
        i++; continue;
      }

      // Definition Lists: Term followed by : Definition
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith(': ')) {
        const definitions: { term: string; defs: string[] }[] = [];

        while (i < lines.length) {
          const termLine = lines[i].trim();
          if (!termLine || termLine.startsWith(': ')) break;

          const defs: string[] = [];
          i++;

          while (i < lines.length && lines[i].trim().startsWith(': ')) {
            defs.push(lines[i].trim().replace(/^:\s*/, ''));
            i++;
          }

          if (defs.length > 0) {
            definitions.push({ term: termLine, defs });
          } else {
            i--; // Put back the line if no definitions found
            break;
          }
        }

        if (definitions.length > 0) {
          result.push(
            <dl key={`dl-${i}`} className="my-8 space-y-4">
              {definitions.map((def, idx) => (
                <div key={idx} className="border-l-4 border-indigo-200 pl-4">
                  <dt className="text-lg font-semibold" style={{ color: 'var(--a11y-text-heading)' }}>{parseInline(def.term)}</dt>
                  {def.defs.map((d, dIdx) => (
                    <dd key={dIdx} className="mt-1 ml-4" style={{ color: 'var(--a11y-text)' }}>{parseInline(d)}</dd>
                  ))}
                </div>
              ))}
            </dl>
          );
          continue;
        }
      }

      // Nested Lists (unordered and ordered with indentation support)
      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
      if (listMatch) {
        const isOrdered = /^\d+\./.test(listMatch[2]);
        const baseIndent = getIndent(line);
        const items: ListItem[] = [];
        const stack: { indent: number; items: ListItem[] }[] = [{ indent: baseIndent, items }];

        while (i < lines.length) {
          const currentLine = lines[i];
          const currentMatch = currentLine.match(/^(\s*)([-*]|\d+\.)\s(\[[ xX]\]\s)?(.*)$/);

          if (!currentMatch) break;

          const indent = getIndent(currentLine);
          const isTask = !!currentMatch[3];
          const isChecked = currentMatch[3] ? /\[[xX]\]/.test(currentMatch[3]) : false;
          const content = currentMatch[4];

          // Find the right parent level
          while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
            stack.pop();
          }

          const newItem: ListItem = {
            content,
            children: [],
            ...(isTask && { isTask, isChecked })
          };

          if (indent > stack[stack.length - 1].indent) {
            // This is a child of the previous item
            const parent = stack[stack.length - 1].items;
            if (parent.length > 0) {
              const lastItem = parent[parent.length - 1];
              lastItem.children.push(newItem);
              stack.push({ indent, items: lastItem.children });
            } else {
              stack[stack.length - 1].items.push(newItem);
            }
          } else {
            stack[stack.length - 1].items.push(newItem);
          }

          i++;
        }

        result.push(renderNestedList(items, isOrdered, 0, `list-${i}`));
        continue;
      }

      // Horizontal Rule
      if (trimmed.match(/^[-*_]{3,}$/) && !trimmed.includes(' ')) {
        result.push(<hr key={`hr-${i}`} className="my-12 border-t-2 border-slate-200" />);
        i++;
        continue;
      }

      // Tables
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableRows: string[][] = [];
        let hasHeader = false;
        const alignments: ('left' | 'center' | 'right')[] = [];

        // Collect all table rows
        while (i < lines.length) {
          const tableLine = lines[i].trim();
          if (!tableLine.startsWith('|') || !tableLine.endsWith('|')) break;

          // Check if this is a separator row (|---|---|) and capture alignment
          const sepMatch = tableLine.match(/^\|([\s\-:]+\|)+$/);
          if (sepMatch) {
            hasHeader = tableRows.length > 0;
            // Parse alignment from separator
            const sepCells = tableLine.slice(1, -1).split('|');
            sepCells.forEach(cell => {
              const trimCell = cell.trim();
              if (trimCell.startsWith(':') && trimCell.endsWith(':')) {
                alignments.push('center');
              } else if (trimCell.endsWith(':')) {
                alignments.push('right');
              } else {
                alignments.push('left');
              }
            });
            i++;
            continue;
          }

          // Parse cells
          const cells = tableLine
            .slice(1, -1)
            .split('|')
            .map(cell => cell.trim());
          tableRows.push(cells);
          i++;
        }

        if (tableRows.length > 0) {
          const headerRow = hasHeader ? tableRows[0] : null;
          const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;

          result.push(
            <div key={`table-${i}`} className="my-8 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-left">
                {headerRow && (
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {headerRow.map((cell, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-sm font-semibold text-slate-700"
                          style={{ textAlign: alignments[idx] || 'left' }}
                        >
                          {parseInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody className="divide-y divide-slate-100">
                  {bodyRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-4 py-3 text-slate-600"
                          style={{ textAlign: alignments[cellIdx] || 'left' }}
                        >
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        continue;
      }

      // Nested Blockquotes (not BREAKOUT or CTA)
      if (trimmed.startsWith('>') && !trimmed.startsWith('> BREAKOUT:') && !trimmed.startsWith('> CTA:')) {
        const quoteLines: string[] = [];
        while (i < lines.length) {
          const quoteLine = lines[i].trim();
          if (!quoteLine.startsWith('>')) break;
          if (quoteLine.startsWith('> BREAKOUT:') || quoteLine.startsWith('> CTA:')) break;
          quoteLines.push(quoteLine.replace(/^>\s?/, ''));
          i++;
        }

        // Check if blockquote contains a table
        const hasTable = quoteLines.some(l => l.startsWith('|') && l.endsWith('|'));

        if (hasTable) {
          // Parse blockquote with table support
          const blockquoteContent: React.ReactNode[] = [];
          let j = 0;

          while (j < quoteLines.length) {
            const qLine = quoteLines[j];

            // Handle nested blockquote
            if (qLine.startsWith('>')) {
              const nestedQuoteLines: string[] = [];
              while (j < quoteLines.length && quoteLines[j].startsWith('>')) {
                nestedQuoteLines.push(quoteLines[j].replace(/^>\s?/, ''));
                j++;
              }
              blockquoteContent.push(
                <div key={`bq-nested-${j}`} className="mt-3">
                  {renderNestedBlockquote(nestedQuoteLines, 1, `bq-${i}-${j}`, parseInline)}
                </div>
              );
              continue;
            }

            // Table inside blockquote
            if (qLine.startsWith('|') && qLine.endsWith('|')) {
              const tableRows: string[][] = [];
              let hasHeader = false;

              while (j < quoteLines.length) {
                const tableLine = quoteLines[j];
                if (!tableLine.startsWith('|') || !tableLine.endsWith('|')) break;

                if (tableLine.match(/^\|[\s\-:]+\|$/)) {
                  hasHeader = tableRows.length > 0;
                  j++;
                  continue;
                }

                const cells = tableLine.slice(1, -1).split('|').map(cell => cell.trim());
                tableRows.push(cells);
                j++;
              }

              if (tableRows.length > 0) {
                const headerRow = hasHeader ? tableRows[0] : null;
                const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;

                blockquoteContent.push(
                  <div key={`bq-table-${j}`} className="my-4 overflow-x-auto rounded-lg border border-indigo-200 bg-white">
                    <table className="w-full text-left text-sm">
                      {headerRow && (
                        <thead className="bg-indigo-100/50 border-b border-indigo-200">
                          <tr>
                            {headerRow.map((cell, idx) => (
                              <th key={idx} className="px-3 py-2 font-semibold text-slate-700">
                                {parseInline(cell)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody className="divide-y divide-indigo-100">
                        {bodyRows.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-3 py-2 text-slate-600">
                                {parseInline(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
              continue;
            }

            // Regular text line
            if (qLine.trim()) {
              blockquoteContent.push(
                <p key={`bq-p-${j}`} className={j > 0 ? 'mt-2' : ''}>
                  {parseInline(qLine)}
                </p>
              );
            }
            j++;
          }

          result.push(
            <blockquote key={`bq-${i}`} className="my-8 pl-6 border-l-4 border-indigo-400 bg-indigo-50/50 py-4 pr-4 rounded-r-xl">
              <div className="text-lg text-slate-700 leading-relaxed">
                {blockquoteContent}
              </div>
            </blockquote>
          );
        } else {
          // Simple blockquote or nested without tables
          result.push(
            <div key={`bq-wrapper-${i}`} className="my-8">
              {renderNestedBlockquote(quoteLines, 0, `bq-${i}`, parseInline)}
            </div>
          );
        }
        continue;
      }

      // Default Paragraph (with footnote reference support)
      let paragraphText = trimmed;

      // Replace footnote references with superscript links
      const footnoteRefRegex = /\[\^([^\]]+)\]/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      let partKey = 0;

      while ((match = footnoteRefRegex.exec(paragraphText)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push(...parseInline(paragraphText.slice(lastIndex, match.index), partKey++));
        }

        const footnoteId = match[1];
        const footnoteContent = footnotes.get(footnoteId);

        parts.push(
          <sup key={`fn-${footnoteId}-${i}`} className="text-indigo-600">
            <a
              href={`#fn-${footnoteId}`}
              id={`fnref-${footnoteId}`}
              className="hover:underline"
              title={footnoteContent || `Footnote ${footnoteId}`}
            >
              [{footnoteId}]
            </a>
          </sup>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < paragraphText.length) {
        parts.push(...parseInline(paragraphText.slice(lastIndex), partKey++));
      }

      result.push(
        <p key={`p-${i}`} className="text-xl mb-5 font-light selection:bg-indigo-100" style={{ color: 'var(--a11y-text)', lineHeight: 'var(--a11y-line-height)' }}>
          {parts.length > 0 ? parts : parseInline(trimmed)}
        </p>
      );
      i++;
    }

    // Add footnotes section at the end if there are any
    if (footnotes.size > 0) {
      result.push(
        <footer key="footnotes" className="mt-10 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Footnotes</h4>
          <ol className="space-y-2 text-sm text-slate-600">
            {Array.from(footnotes.entries()).map(([id, text]) => (
              <li key={id} id={`fn-${id}`} className="flex gap-2">
                <span className="text-indigo-600 font-semibold">[{id}]</span>
                <span>
                  {parseInline(text)}{' '}
                  <a href={`#fnref-${id}`} className="text-indigo-600 hover:underline">↩</a>
                </span>
              </li>
            ))}
          </ol>
        </footer>
      );
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentHash(content)]);

  const end = import.meta.env.DEV && typeof performance !== 'undefined' ? performance.now() : 0;
  const renderTime = (end - start).toFixed(2);

  return (
    <div className="relative" style={{
      fontFamily: 'var(--a11y-font-body)',
      lineHeight: 'var(--a11y-line-height)',
      fontSize: 'calc(1rem * var(--a11y-font-scale))'
    }}>
      {showRenderTime && (
        <div className="absolute -top-12 right-0 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">
          <Zap className="w-3 h-3" /> Static Render: {renderTime}ms
        </div>
      )}
      <article className="max-w-screen-md mx-auto" role="article">{elements}</article>
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const MarkdownRenderer = memo(MarkdownRendererComponent);
