'use client';

import { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });

export function MermaidChart({ graphDefinition }: { graphDefinition: string }) {
  const [sanitizedSvg, setSanitizedSvg] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, graphDefinition);
        if (isMounted) {
          setSanitizedSvg(DOMPurify.sanitize(svg));
        }
      } catch (err) {
        console.error('[Mermaid Render Error]:', err);
      }
    };

    renderChart();
    return () => {
      isMounted = false;
    };
  }, [graphDefinition]);

  if (!sanitizedSvg) {
    return <div className="animate-pulse bg-gray-100 h-48 rounded-lg" />;
  }

  return <div dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />;
}
