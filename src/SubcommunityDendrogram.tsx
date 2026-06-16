import React, { useEffect, useRef, useMemo } from 'react';

interface Community {
    id: number;
    n_papers: number;
}

interface SubcommunityDendrogramProps {
    communities: Community[];
    llmLabels: Record<number, string>;
    paperNetwork?: {
        nodes: {
            id: string | number;
            community: number;
            subcommunity: number;
        }[];
    };
    selectedCommunities: Set<number>;
    onSelectionChange: (newSelection: Set<number>) => void;
}

// Generate distinct colors for communities (extended for 43)
const COMMUNITY_COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
    '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
    '#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939',
    '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39',
    '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b',
    '#e7969c', '#7b4173', '#a55194', '#ce6dbd', '#de9ed6',
    '#3182bd', '#6baed6', '#9ecae1'
];

const SubcommunityDendrogram: React.FC<SubcommunityDendrogramProps> = ({
    communities,
    llmLabels,
    paperNetwork,
    selectedCommunities,
    onSelectionChange
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const top43Communities = useMemo(() => communities.slice(0, 43), [communities]);

    // Toggle community selection
    const toggleCommunity = (id: number) => {
        const newSet = new Set(selectedCommunities);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        onSelectionChange(newSet);
    };

    const selectAll = () => {
        onSelectionChange(new Set(top43Communities.map(c => c.id)));
    };

    const clearAll = () => {
        onSelectionChange(new Set());
    };

    // Build subcommunity data from paper network
    const subcommunityData = useMemo(() => {
        if (!paperNetwork?.nodes) return [];

        const subcommunities: { communityId: number; subcommunityId: number; count: number; label: string }[] = [];
        const counts: Record<string, number> = {};

        paperNetwork.nodes.forEach(node => {
            if (selectedCommunities.has(node.community)) {
                const key = `${node.community}_${node.subcommunity}`;
                counts[key] = (counts[key] || 0) + 1;
            }
        });

        Object.entries(counts).forEach(([key, count]) => {
            const [commId, subId] = key.split('_').map(Number);
            subcommunities.push({
                communityId: commId,
                subcommunityId: subId,
                count,
                label: `C${commId + 1}-S${subId}`
            });
        });

        // Sort by community then by count (descending) within community
        return subcommunities.sort((a, b) =>
            a.communityId - b.communityId || b.count - a.count
        );
    }, [paperNetwork, selectedCommunities]);

    // Draw the dendrogram - IMPROVED: hierarchical by community
    useEffect(() => {
        if (!svgRef.current || subcommunityData.length < 2) return;

        const svg = svgRef.current;
        svg.innerHTML = '';

        const width = 900;
        const height = 500;
        const margin = { top: 50, right: 40, bottom: 120, left: 60 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;

        const n = subcommunityData.length;

        // Group subcommunities by community
        const communityGroups: Record<number, typeof subcommunityData> = {};
        subcommunityData.forEach(sub => {
            if (!communityGroups[sub.communityId]) {
                communityGroups[sub.communityId] = [];
            }
            communityGroups[sub.communityId].push(sub);
        });

        const orderedCommunities = Object.keys(communityGroups).map(Number).sort((a, b) => a - b);

        // Positions for all nodes
        const positions: Record<string, { x: number; y: number; color: string }> = {};
        let xPos = margin.left;
        const leafSpacing = plotWidth / n;

        // Position leaf nodes (subcommunities) grouped by community
        orderedCommunities.forEach(commId => {
            const subs = communityGroups[commId];
            const colorIdx = top43Communities.findIndex(c => c.id === commId);
            const color = COMMUNITY_COLORS[colorIdx % COMMUNITY_COLORS.length];

            subs.forEach(sub => {
                const key = `${sub.communityId}_${sub.subcommunityId}`;
                positions[key] = {
                    x: xPos + leafSpacing / 2,
                    y: height - margin.bottom,
                    color
                };
                xPos += leafSpacing;
            });
        });

        // Draw hierarchical structure: Community level first
        const communityMidpoints: { commId: number; x: number; y: number; color: string }[] = [];
        const communityLevel = height - margin.bottom - plotHeight * 0.5; // Midway up

        orderedCommunities.forEach(commId => {
            const subs = communityGroups[commId];
            if (subs.length === 0) return;

            const colorIdx = top43Communities.findIndex(c => c.id === commId);
            const color = COMMUNITY_COLORS[colorIdx % COMMUNITY_COLORS.length];

            // Find min and max x for this community's subcommunities
            const subXPositions = subs.map(s => positions[`${s.communityId}_${s.subcommunityId}`].x);
            const minX = Math.min(...subXPositions);
            const maxX = Math.max(...subXPositions);
            const midX = (minX + maxX) / 2;

            communityMidpoints.push({ commId, x: midX, y: communityLevel, color });

            // Draw vertical lines from each subcommunity to community level
            subs.forEach(sub => {
                const key = `${sub.communityId}_${sub.subcommunityId}`;
                const pos = positions[key];

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', pos.x.toString());
                line.setAttribute('y1', pos.y.toString());
                line.setAttribute('x2', pos.x.toString());
                line.setAttribute('y2', communityLevel.toString());
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '2');
                svg.appendChild(line);
            });

            // Draw horizontal line connecting all subcommunities at community level
            if (subs.length > 1) {
                const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                hLine.setAttribute('x1', minX.toString());
                hLine.setAttribute('y1', communityLevel.toString());
                hLine.setAttribute('x2', maxX.toString());
                hLine.setAttribute('y2', communityLevel.toString());
                hLine.setAttribute('stroke', color);
                hLine.setAttribute('stroke-width', '2');
                svg.appendChild(hLine);
            }

            // Draw community label at community level
            const commLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            commLabel.setAttribute('x', midX.toString());
            commLabel.setAttribute('y', (communityLevel - 10).toString());
            commLabel.setAttribute('text-anchor', 'middle');
            commLabel.setAttribute('font-size', '11px');
            commLabel.setAttribute('font-weight', 'bold');
            commLabel.setAttribute('fill', color);
            commLabel.setAttribute('cursor', 'pointer');
            commLabel.textContent = llmLabels[commId] ? `${commId + 1}: ${llmLabels[commId].substring(0, 12)}...` : `Community ${commId + 1}`;
            commLabel.onclick = () => toggleCommunity(commId);
            svg.appendChild(commLabel);
        });

        // Draw top-level connections (connecting all communities)
        const rootLevel = margin.top + 30;
        if (communityMidpoints.length > 1) {
            const allX = communityMidpoints.map(c => c.x);
            const minX = Math.min(...allX);
            const maxX = Math.max(...allX);

            // Vertical lines from community level to root
            communityMidpoints.forEach(cm => {
                const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                vLine.setAttribute('x1', cm.x.toString());
                vLine.setAttribute('y1', cm.y.toString());
                vLine.setAttribute('x2', cm.x.toString());
                vLine.setAttribute('y2', rootLevel.toString());
                vLine.setAttribute('stroke', cm.color);
                vLine.setAttribute('stroke-width', '2');
                svg.appendChild(vLine);
            });

            // Horizontal line at root
            const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hLine.setAttribute('x1', minX.toString());
            hLine.setAttribute('y1', rootLevel.toString());
            hLine.setAttribute('x2', maxX.toString());
            hLine.setAttribute('y2', rootLevel.toString());
            hLine.setAttribute('stroke', '#333');
            hLine.setAttribute('stroke-width', '2');
            svg.appendChild(hLine);
        }

        // Draw subcommunity labels at bottom (clickable)
        subcommunityData.forEach(sub => {
            const key = `${sub.communityId}_${sub.subcommunityId}`;
            const pos = positions[key];

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pos.x.toString());
            text.setAttribute('y', (height - margin.bottom + 15).toString());
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('transform', `rotate(-45, ${pos.x}, ${height - margin.bottom + 15})`);
            text.setAttribute('font-size', '9px');
            text.setAttribute('fill', pos.color);
            text.setAttribute('cursor', 'pointer');
            text.textContent = `${sub.label} (${sub.count})`;
            text.onclick = () => toggleCommunity(sub.communityId);
            svg.appendChild(text);
        });

        // Title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', (width / 2).toString());
        title.setAttribute('y', '20');
        title.setAttribute('text-anchor', 'middle');
        title.setAttribute('font-size', '14px');
        title.setAttribute('font-weight', 'bold');
        title.setAttribute('fill', '#333');
        title.textContent = 'Subcommunity Hierarchy (Click labels to toggle)';
        svg.appendChild(title);

    }, [subcommunityData, top43Communities, llmLabels, toggleCommunity]);

    return (
        <div className="subsection" style={{ border: '1px solid #eee', borderRadius: '8px', padding: '1rem', background: '#fafafa', marginTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>Subcommunity Hierarchy</h4>


            {/* Selection Summary - communities are selected by clicking the bar chart above */}
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fff', borderRadius: '6px', border: '1px solid #ddd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500, color: '#333' }}>
                        📊 Click bars in the chart above to select communities
                        <span style={{ marginLeft: '1rem', color: '#666', fontWeight: 'normal' }}>
                            ({selectedCommunities.size} of {top43Communities.length} selected)
                        </span>
                    </span>
                    <div>
                        <button
                            onClick={selectAll}
                            style={{ padding: '0.25rem 0.75rem', marginRight: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                            Select All
                        </button>
                        <button
                            onClick={clearAll}
                            style={{ padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* Dendrogram */}
            {subcommunityData.length >= 2 ? (
                <svg ref={svgRef} width="900" height="500" style={{ display: 'block', margin: '0 auto' }} />
            ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                    <p>Select at least 2 communities with subcommunities to display the dendrogram.</p>
                    <p style={{ fontSize: '0.9rem' }}>Currently showing {subcommunityData.length} subcommunities.</p>
                </div>
            )}
        </div>
    );
};

export default SubcommunityDendrogram;
