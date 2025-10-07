import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronRight, Hash, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import 'katex/dist/katex.min.css';

interface EnhancedMarkdownProps {
  content: string;
  className?: string;
}

interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

const EnhancedMarkdown: React.FC<EnhancedMarkdownProps> = ({ content, className = '' }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [tableSortConfig, setTableSortConfig] = useState<{ [tableId: string]: { columnIndex: number; direction: 'asc' | 'desc' } }>({});
  const [tableOfContents, setTableOfContents] = useState<TableOfContentsItem[]>([]);
  const [showToc, setShowToc] = useState(false);

  // Generate table of contents
  useEffect(() => {
    const toc: TableOfContentsItem[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];
        const id = `heading-${index}`;
        toc.push({ id, title, level });
      }
    });
    
    setTableOfContents(toc);
  }, [content]);

  const copyToClipboard = async (text: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(codeId);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleTableSort = (tableId: string, columnIndex: number, rows: Element[]) => {
    const currentSort = tableSortConfig[tableId];
    const newDirection = currentSort?.columnIndex === columnIndex && currentSort.direction === 'asc' ? 'desc' : 'asc';
    
    setTableSortConfig(prev => ({
      ...prev,
      [tableId]: { columnIndex, direction: newDirection }
    }));

    // Convert to HTMLTableRowElement and extract data from table rows (skip header row)
    const tableRows = rows.filter(row => row instanceof HTMLTableRowElement) as HTMLTableRowElement[];
    const dataRows = tableRows.slice(1);
    
    const sortedRows = dataRows.sort((a, b) => {
      const aCell = a.cells[columnIndex]?.textContent?.trim() || '';
      const bCell = b.cells[columnIndex]?.textContent?.trim() || '';
      
      // Try to parse as numbers first
      const aNum = parseFloat(aCell);
      const bNum = parseFloat(bCell);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return newDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Sort as strings
      return newDirection === 'asc' ? aCell.localeCompare(bCell) : bCell.localeCompare(aCell);
    });

    // Reorder the DOM elements
    const tbody = tableRows[0]?.parentElement;
    if (tbody) {
      sortedRows.forEach(row => tbody.appendChild(row));
    }
  };

  const getSortIcon = (tableId: string, columnIndex: number) => {
    const sortConfig = tableSortConfig[tableId];
    if (!sortConfig || sortConfig.columnIndex !== columnIndex) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="h-3 w-3 text-primary" /> : 
      <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Table of Contents */}
      {tableOfContents.length > 0 && (
        <div className="mb-6 border border-gray-600 rounded-lg bg-gray-800/30">
          <button
            onClick={() => setShowToc(!showToc)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-700/30 transition-colors"
          >
            <span className="font-medium text-primary">Table of Contents</span>
            {showToc ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {showToc && (
            <div className="border-t border-gray-600 p-3">
              <nav className="space-y-1">
                {tableOfContents.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToHeading(item.id)}
                    className={`block w-full text-left px-2 py-1 text-sm hover:bg-gray-700/30 rounded transition-colors ${
                      item.level === 1 ? 'font-medium' : 
                      item.level === 2 ? 'ml-4' : 
                      item.level === 3 ? 'ml-8' : 'ml-12'
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Markdown Content */}
      <div className="prose prose-invert prose-headings:text-primary prose-a:text-primary max-w-full">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
            // Enhanced headings with anchor links
            h1: ({children, ...props}) => {
              const id = `heading-${props.node?.position?.start.line}`;
              return (
                <h1 id={id} className="group flex items-center text-2xl font-bold mb-3 text-primary" {...props}>
                  {children}
                  <button
                    onClick={() => scrollToHeading(id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Hash className="h-4 w-4" />
                  </button>
                </h1>
              );
            },
            h2: ({children, ...props}) => {
              const id = `heading-${props.node?.position?.start.line}`;
              return (
                <h2 id={id} className="group flex items-center text-xl font-bold mb-2 text-primary" {...props}>
                  {children}
                  <button
                    onClick={() => scrollToHeading(id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Hash className="h-4 w-4" />
                  </button>
                </h2>
              );
            },
            h3: ({children, ...props}) => {
              const id = `heading-${props.node?.position?.start.line}`;
              return (
                <h3 id={id} className="group flex items-center text-lg font-semibold mb-2 text-primary" {...props}>
                  {children}
                  <button
                    onClick={() => scrollToHeading(id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Hash className="h-4 w-4" />
                  </button>
                </h3>
              );
            },
            h4: ({children, ...props}) => {
              const id = `heading-${props.node?.position?.start.line}`;
              return (
                <h4 id={id} className="group flex items-center text-base font-semibold mb-2 text-primary" {...props}>
                  {children}
                  <button
                    onClick={() => scrollToHeading(id)}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Hash className="h-4 w-4" />
                  </button>
                </h4>
              );
            },
            p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
            a: ({href, children}) => (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary underline hover:text-primary/80"
              >
                {children}
              </a>
            ),
            // Enhanced code blocks with syntax highlighting and copy functionality
            code: ({node, className, children, ...props}) => {
              const isInline = !className || !className.includes('language-');
              const language = className?.replace('language-', '') || 'text';
              const codeString = String(children).replace(/\n$/, '');
              const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
              
              if (isInline) {
                return <code className="bg-gray-800 px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
              }
              
              return (
                <div className="relative group my-4">
                  <div className="flex items-center justify-between bg-gray-900 px-4 py-2 border-b border-gray-700">
                    <span className="text-sm text-gray-400 font-medium capitalize">{language}</span>
                    <button
                      onClick={() => copyToClipboard(codeString, codeId)}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors border border-gray-600"
                    >
                      {copiedCode === codeId ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="overflow-auto">
                    <SyntaxHighlighter
                      language={language}
                      style={vscDarkPlus}
                      showLineNumbers={true}
                      lineNumberStyle={{
                        minWidth: '3em',
                        paddingRight: '1em',
                        color: '#6B7280',
                        backgroundColor: '#1F2937',
                        borderRight: '1px solid #374151',
                        textAlign: 'right',
                        fontSize: '0.75rem'
                      }}
                      customStyle={{
                        margin: 0,
                        backgroundColor: '#111827',
                        fontSize: '0.875rem',
                        lineHeight: '1.5'
                      }}
                      codeTagProps={{
                        style: {
                          fontSize: '0.875rem',
                          fontFamily: 'JetBrains Mono, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                        }
                      }}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            },
            blockquote: ({children}) => (
              <blockquote className="border-l-4 border-primary pl-4 italic my-2 bg-gray-800/30 py-2 rounded-r">
                {children}
              </blockquote>
            ),
            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
            li: ({children}) => <li className="ml-2">{children}</li>,
            hr: () => <hr className="my-4 border-gray-600" />,
            strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
            em: ({children}) => <em className="italic">{children}</em>,
            // Enhanced table with working sorting functionality
            table: ({children, ...props}) => {
              const tableId = `table-${Math.random().toString(36).substr(2, 9)}`;
              return (
                <div className="overflow-x-auto my-4 border border-gray-600 rounded-lg">
                  <table className="w-full border-collapse bg-gray-800/50" data-table-id={tableId}>
                    {children}
                  </table>
                </div>
              );
            },
            thead: ({children}) => (
              <thead className="bg-gray-700/50 sticky top-0">
                {children}
              </thead>
            ),
            tbody: ({children}) => (
              <tbody>
                {children}
              </tbody>
            ),
            tr: ({children}) => (
              <tr className="border-b border-gray-600 hover:bg-gray-700/30 transition-colors">
                {children}
              </tr>
            ),
            th: ({children, ...props}) => {
              return (
                <th 
                  className="px-4 py-3 text-left font-medium text-primary border-r border-gray-600 last:border-r-0 cursor-pointer hover:bg-gray-600/30 transition-colors"
                  onClick={(e) => {
                    const thElement = e.currentTarget;
                    const trElement = thElement.parentElement as HTMLTableRowElement;
                    const theadElement = trElement?.parentElement as HTMLTableSectionElement;
                    const tableElement = theadElement?.parentElement as HTMLTableElement;
                    const tbodyElement = tableElement?.querySelector('tbody');
                    
                    if (tbodyElement && tableElement) {
                      const tableId = tableElement.getAttribute('data-table-id') || 'default';
                      const columnIndex = Array.from(trElement.children).indexOf(thElement);
                      const rows = Array.from(tbodyElement.children);
                      handleTableSort(tableId, columnIndex, rows);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    {children}
                    <span className="ml-2">
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </span>
                  </div>
                </th>
              );
            },
            td: ({children}) => (
              <td className="px-4 py-3 border-r border-gray-600 last:border-r-0">
                {children}
              </td>
            ),
            // Math equation styling
            div: ({children, className}) => {
              if (className?.includes('math-display')) {
                return (
                  <div className="my-4 p-4 bg-gray-800/30 rounded-lg border border-gray-600 overflow-x-auto">
                    {children}
                  </div>
                );
              }
              return <div className={className}>{children}</div>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default EnhancedMarkdown;
