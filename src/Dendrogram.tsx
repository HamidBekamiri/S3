import React, { useEffect, useRef } from 'react';

interface DendrogramProps {
    dendrogramData: {
        linkage: number[][];
        labels: number[];
        n_communities: number;
    } | null;
    llmLabels: Record<number, string>;
}

const Dendrogram: React.FC<DendrogramProps> = ({ dendrogramData, llmLabels }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!dendrogramData || !svgRef.current) return;

        const { linkage, labels } = dendrogramData;
        const n = labels.length;

        // SVG dimensions
        const width = 800;
        const height = 400;
        const margin = { top: 40, right: 40, bottom: 80, left: 60 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        // Clear previous content
        const svg = svgRef.current;
        svg.innerHTML = '';

        // Compute node positions
        const positions: Record<number, { x: number; y: number }> = {};

        // Initial positions for leaves (bottom of dendrogram)
        for (let i = 0; i < n; i++) {
            positions[i] = {
                x: margin.left + (i + 0.5) * (plotWidth / n),
                y: height - margin.bottom
            };
        }

        // Find max height for scaling
        const maxHeight = Math.max(...linkage.map(row => row[2]));

        // Process linkage matrix to position internal nodes
        linkage.forEach((row, idx) => {
            const [left, right, dist] = row;
            const leftIdx = Math.floor(left);
            const rightIdx = Math.floor(right);
            const newIdx = n + idx;

            // Position new cluster node
            const leftPos = positions[leftIdx];
            const rightPos = positions[rightIdx];

            positions[newIdx] = {
                x: (leftPos.x + rightPos.x) / 2,
                y: height - margin.bottom - (dist / maxHeight) * plotHeight
            };

            // Draw lines
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            // Vertical line for left child
            const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line1.setAttribute('x1', leftPos.x.toString());
            line1.setAttribute('y1', leftPos.y.toString());
            line1.setAttribute('x2', leftPos.x.toString());
            line1.setAttribute('y2', positions[newIdx].y.toString());
            line1.setAttribute('stroke', '#666');
            line1.setAttribute('stroke-width', '2');
            g.appendChild(line1);

            // Vertical line for right child
            const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line2.setAttribute('x1', rightPos.x.toString());
            line2.setAttribute('y1', rightPos.y.toString());
            line2.setAttribute('x2', rightPos.x.toString());
            line2.setAttribute('y2', positions[newIdx].y.toString());
            line2.setAttribute('stroke', '#666');
            line2.setAttribute('stroke-width', '2');
            g.appendChild(line2);

            // Horizontal line connecting
            const line3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line3.setAttribute('x1', leftPos.x.toString());
            line3.setAttribute('y1', positions[newIdx].y.toString());
            line3.setAttribute('x2', rightPos.x.toString());
            line3.setAttribute('y2', positions[newIdx].y.toString());
            line3.setAttribute('stroke', '#666');
            line3.setAttribute('stroke-width', '2');
            g.appendChild(line3);

            svg.appendChild(g);
        });

        // Draw labels at the bottom
        labels.forEach((commId, idx) => {
            const pos = positions[idx];
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x.toString());
            text.setAttribute('y', (height - margin.bottom + 20).toString());
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('transform', `rotate(-45, ${pos.x}, ${height - margin.bottom + 20})`);
            text.setAttribute('font-size', '11px');
            text.setAttribute('fill', '#333');

            const label = llmLabels[commId] ? `${commId}: ${llmLabels[commId]}` : `Comm ${commId}`;
            text.textContent = label.length > 20 ? label.substring(0, 17) + '...' : label;
            svg.appendChild(text);
        });

        // Draw Y-axis label
        const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        yLabel.setAttribute('x', '20');
        yLabel.setAttribute('y', (height / 2).toString());
        yLabel.setAttribute('text-anchor', 'middle');
        yLabel.setAttribute('transform', `rotate(-90, 20, ${height / 2})`);
        yLabel.setAttribute('font-size', '12px');
        yLabel.setAttribute('fill', '#333');
        yLabel.textContent = 'Distance';
        svg.appendChild(yLabel);

        // Draw title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', (width / 2).toString());
        title.setAttribute('y', '20');
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-size', '14px');
        title.setAttribute('font-weight', 'bold');
        title.setAttribute('fill', '#333');
        title.textContent = 'Community Hierarchy (Dendrogram)';
        svg.appendChild(title);

    }, [dendrogramData, llmLabels]);

    if (!dendrogramData) {
        return (
            <div className="subsection" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                <p>No hierarchical clustering data available. Need at least 2 communities.</p>
            </div>
        );
    }

    return (
        <div className="subsection" style={{ border: '1px solid #eee', borderRadius: '8px', padding: '1rem', background: '#fafafa' }}>
            <svg ref={svgRef} width="800" height="400" style={{ display: 'block', margin: '0 auto' }} />
        </div>
    );
};

export default Dendrogram;
