
import React from 'react';
import Tree from 'react-d3-tree';

interface SubCommunity {
    id: string;
    parent_id: number;
    nodes: string[];
    size: number;
    top_terms: string[];
}

interface TreeProps {
    data: SubCommunity[];
    llmLabels: Record<number, string>;
}

const SubCommunityTree: React.FC<TreeProps> = ({ data, llmLabels }) => {
    if (!data || data.length === 0) return null;

    // Transform flat list to tree structure
    const buildTree = () => {
        const root = {
            name: "Communities",
            children: [] as any[]
        };

        // Group by parent
        const byParent: Record<number, SubCommunity[]> = {};
        data.forEach(sub => {
            if (!byParent[sub.parent_id]) byParent[sub.parent_id] = [];
            byParent[sub.parent_id].push(sub);
        });

        Object.keys(byParent).forEach(parentIdStr => {
            const parentId = parseInt(parentIdStr);
            const subs = byParent[parentId];
            const parentLabel = llmLabels[parentId] ? `${parentId + 1}: ${llmLabels[parentId]}` : `Community ${parentId + 1}`;

            const communityNode = {
                name: parentLabel,
                attributes: {
                    Type: "Community",
                    ID: parentId
                },
                children: subs.map(sub => ({
                    name: sub.id, // e.g. "0_1"
                    attributes: {
                        Size: sub.size,
                        Terms: sub.top_terms.slice(0, 3).join(", ")
                    }
                }))
            };

            root.children.push(communityNode);
        });

        return root;
    };

    const treeData = buildTree();

    return (
        <div className="subsection" style={{ height: '600px', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
            <h4 style={{ padding: '1rem', margin: 0, borderBottom: '1px solid #eee', background: '#fafafa' }}>
                Sub-community Hierarchy
            </h4>
            <Tree
                data={treeData}
                orientation="vertical"
                pathFunc="step"
                translate={{ x: 400, y: 50 }}
                nodeSize={{ x: 200, y: 150 }}
                renderCustomNodeElement={(rd3tProps) => renderNode(rd3tProps)}
            />
        </div>
    );
};

const renderNode = ({ nodeDatum, toggleNode }: any) => {
    const isRoot = nodeDatum.name === "Communities";
    const isParent = nodeDatum.attributes?.Type === "Community";

    return (
        <g>
            <circle r={isRoot ? 10 : 8} fill={isRoot ? "#ccc" : isParent ? "#8884d8" : "#82ca9d"} onClick={toggleNode} />
            <text fill="black" x="20" dy="-5" strokeWidth="0" fontSize="14px" fontWeight={isParent ? "bold" : "normal"}>
                {nodeDatum.name}
            </text>
            {nodeDatum.attributes?.Terms && (
                <text fill="#666" x="20" dy="15" strokeWidth="0" fontSize="11px">
                    {nodeDatum.attributes.Terms}
                </text>
            )}
            {nodeDatum.attributes?.Size && (
                <text fill="#999" x="20" dy="28" strokeWidth="0" fontSize="10px">
                    Size: {nodeDatum.attributes.Size}
                </text>
            )}
        </g>
    );
};

export default SubCommunityTree;
