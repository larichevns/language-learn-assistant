import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const BASE =
  'text-sm leading-relaxed [&_h1]:mt-4 [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[0.85em] [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline';

/**
 * Renders trusted Markdown (GFM) to styled prose. Raw HTML stays inert — we
 * deliberately omit rehype-raw so pasted `<script>`/`<img onerror>` never runs.
 * Horizontal scroll is scoped to tables only, so a wide table never pans the
 * whole note; images are capped to the content width to prevent layout blowout.
 */
export function MarkdownView({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn(BASE, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: (props) => (
            <div className="overflow-x-auto">
              <table className="my-2 w-full text-xs" {...props} />
            </div>
          ),
          th: (props) => <th className="border border-border px-2 py-1" {...props} />,
          td: (props) => <td className="border border-border px-2 py-1" {...props} />,
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          img: (props) => <img className="h-auto max-w-full rounded" loading="lazy" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
