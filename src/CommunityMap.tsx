import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { CsvAnalysisResult } from "./api";

import { COLORS } from "./constants";

interface CommunityMapProps {
    result: CsvAnalysisResult;
    llmLabels?: Record<number, string>;
}

const CommunityMap: React.FC<CommunityMapProps> = ({ result, llmLabels }) => {
    const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
    const [highlightNode, setHighlightNode] = useState<any>(null);
    const [selectedNode, setSelectedNode] = useState<any>(null);

    // Temporal evolution state
    const [isPlaying, setIsPlaying] = useState(false);

    // Calculate year range
    const { minYear, maxYear } = useMemo(() => {
        if (!result.paper_network?.nodes || result.paper_network.nodes.length === 0) {
            return { minYear: 2000, maxYear: new Date().getFullYear() };
        }
        const years = result.paper_network.nodes
            .map(n => n.year)
            .filter((y): y is number => typeof y === 'number' && y > 0);

        return {
            minYear: years.length ? Math.min(...years) : 2000,
            maxYear: years.length ? Math.max(...years) : new Date().getFullYear()
        };
    }, [result]);

    const [currentYear, setCurrentYear] = useState(maxYear);

    // Reset current year when dataset changes
    useEffect(() => {
        setCurrentYear(maxYear);
        setIsPlaying(false);
    }, [maxYear]);

    // Animation loop
    useEffect(() => {
        let interval: any;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentYear(prev => {
                    if (prev >= maxYear) {
                        setIsPlaying(false);
                        return maxYear;
                    }
                    return prev + 1;
                });
            }, 800); // 800ms per year
        }
        return () => clearInterval(interval);
    }, [isPlaying, maxYear]);

    // Theme state
    const [isDarkMode, setIsDarkMode] = useState(true);

    // Network Source State
    const [networkSource, setNetworkSource] = useState<"s3" | "bc" | "cc">("s3");

    const graphData = useMemo(() => {
        let nodes: any[] = [];
        let edges: any[] = [];

        if (networkSource === "s3") {
            if (result.paper_network) {
                nodes = result.paper_network.nodes || [];
                edges = result.paper_network.edges || [];
            }
        } else if (networkSource === "bc") {
            if (result.bc_network) {
                nodes = result.bc_network.nodes || [];
                edges = result.bc_network.edges || [];
            }
        } else if (networkSource === "cc") {
            if (result.cc_network) {
                nodes = result.cc_network.nodes || [];
                edges = result.cc_network.edges || [];
            }
        }

        if (nodes.length === 0) return { nodes: [], links: [] };

        // Filter nodes by year (only for S3 and BC where nodes are papers with year)
        // CC nodes are references (no year usually, or we didn't parse it)
        let visibleNodes = nodes;
        if (networkSource !== "cc") {
            visibleNodes = nodes.filter(n =>
                // Show node if year is null/undefined (always visible) or <= currentYear
                !n.year || n.year <= currentYear
            );
        }

        const nodeIds = new Set(visibleNodes.map(n => n.id));

        // Filter edges: both source and target must be visible
        const visibleLinks = edges.filter(e => {
            // Check if source/target are objects (already processed by graph) or IDs
            const sourceId = typeof e.source === 'object' ? (e.source as any).id : e.source;
            const targetId = typeof e.target === 'object' ? (e.target as any).id : e.target;
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
        });

        return {
            nodes: visibleNodes,
            links: visibleLinks
        };
    }, [result, currentYear, networkSource]);

    const colorScale = useMemo(() => {
        const scale: Record<number, string> = {};

        // Use ALL nodes for color scale stability, not just visible ones
        // Apply only to paper networks
        if (result.paper_network?.nodes) {
            result.paper_network.nodes.forEach(n => {
                const c = n.community;
                if (c === undefined || c === null || c < 0) {
                    scale[c] = "#999999";
                } else {
                    scale[c] = COLORS[c % COLORS.length];
                }
            });
        }
        return scale;
    }, [result]);

    const handleNodeClick = useCallback((node: any) => {
        if (networkSource === "cc") return; // No details for references yet
        setSelectedNode(node);
    }, [networkSource]);

    const getNodeLabel = useCallback((node: any) => {
        if (networkSource === "cc") {
            return `${node.id}\n(Cited ${node.count} times)`;
        }

        const hasLabel = llmLabels?.[node.community];
        const communityLabel = hasLabel
            ? `Community ${node.community + 1}: ${llmLabels[node.community]}`
            : `Community ${node.community + 1}`;

        return `${communityLabel}\n${node.title}\n${node.author} (${node.year})`;
    }, [llmLabels, networkSource]);

    const getNodeColor = useCallback((node: any) => {
        if (networkSource === "cc") return "#888";
        return colorScale[node.community] || "#ccc"
    }, [colorScale, networkSource]);

    const getLinkColor = useCallback(() => isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)", [isDarkMode]);

    return (
        <div style={{ display: "flex", flexDirection: "column", border: isDarkMode ? "1px solid #333" : "1px solid #ddd", borderRadius: "8px", overflow: "hidden", backgroundColor: isDarkMode ? "#000" : "#fff" }}>

            {/* Control Panel */}
            <div style={{
                padding: "0.5rem 1rem",
                background: isDarkMode ? "#222" : "#f5f5f5",
                borderBottom: isDarkMode ? "1px solid #333" : "1px solid #ddd",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap"
            }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        onClick={() => setNetworkSource("s3")}
                        style={{
                            background: networkSource === "s3" ? (isDarkMode ? "#555" : "#ccc") : "transparent",
                            color: isDarkMode ? "#fff" : "#000",
                            border: isDarkMode ? "1px solid #444" : "1px solid #aaa",
                            borderRadius: "4px",
                            padding: "0.3rem 0.6rem",
                            cursor: "pointer",
                            fontSize: "0.85rem"
                        }}
                    >
                        S3 (Semantic)
                    </button>
                    <button
                        onClick={() => setNetworkSource("bc")}
                        style={{
                            background: networkSource === "bc" ? (isDarkMode ? "#555" : "#ccc") : "transparent",
                            color: isDarkMode ? "#fff" : "#000",
                            border: isDarkMode ? "1px solid #444" : "1px solid #aaa",
                            borderRadius: "4px",
                            padding: "0.3rem 0.6rem",
                            cursor: "pointer",
                            fontSize: "0.85rem"
                        }}
                        title="Bibliographic Coupling: Papers sharing references"
                    >
                        BC (Bib. Coupling)
                    </button>
                    <button
                        onClick={() => setNetworkSource("cc")}
                        style={{
                            background: networkSource === "cc" ? (isDarkMode ? "#555" : "#ccc") : "transparent",
                            color: isDarkMode ? "#fff" : "#000",
                            border: isDarkMode ? "1px solid #444" : "1px solid #aaa",
                            borderRadius: "4px",
                            padding: "0.3rem 0.6rem",
                            cursor: "pointer",
                            fontSize: "0.85rem"
                        }}
                        title="Co-Citation: References cited together"
                    >
                        CC (Co-Citation)
                    </button>
                </div>

                <div style={{ borderLeft: isDarkMode ? "1px solid #444" : "1px solid #ccc", height: "24px", margin: "0 0.5rem" }}></div>

                <button
                    onClick={() => {
                        if (currentYear >= maxYear) setCurrentYear(minYear);
                        setIsPlaying(!isPlaying);
                    }}
                    disabled={networkSource === "cc"}
                    style={{
                        background: isPlaying ? "#d62728" : "#2ca02c",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "0.3rem 0.8rem",
                        cursor: networkSource === "cc" ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                        width: "80px",
                        opacity: networkSource === "cc" ? 0.5 : 1
                    }}
                >
                    {isPlaying ? "Pause" : currentYear >= maxYear ? "Replay" : "Play"}
                </button>

                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", opacity: networkSource === "cc" ? 0.5 : 1 }}>
                    <span style={{ color: isDarkMode ? "#aaa" : "#555", fontSize: "0.85rem" }}>{minYear}</span>
                    <input
                        type="range"
                        min={minYear}
                        max={maxYear}
                        value={currentYear}
                        disabled={networkSource === "cc"}
                        onChange={(e) => {
                            setCurrentYear(parseInt(e.target.value));
                            setIsPlaying(false);
                        }}
                        style={{ flex: 1, cursor: networkSource === "cc" ? "not-allowed" : "pointer" }}
                    />
                    <span style={{ color: isDarkMode ? "#aaa" : "#555", fontSize: "0.85rem" }}>{maxYear}</span>
                </div>

                {/* ... rest of tools ... */}

                <div style={{
                    background: isDarkMode ? "#333" : "#ddd",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "4px",
                    color: isDarkMode ? "#fff" : "#000",
                    fontWeight: "bold",
                    minWidth: "60px",
                    textAlign: "center"
                }}>
                    {currentYear}
                </div>

                <div style={{ borderLeft: isDarkMode ? "1px solid #444" : "1px solid #ccc", height: "24px", margin: "0 0.5rem" }}></div>

                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    style={{
                        background: isDarkMode ? "#444" : "#ddd",
                        color: isDarkMode ? "#fff" : "#000",
                        border: "none",
                        borderRadius: "4px",
                        padding: "0.3rem 0.8rem",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem"
                    }}
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDarkMode ? "☀️ Light" : "🌙 Dark"}
                </button>
            </div>

            {/* Map Container */}
            <div style={{ display: "flex", height: "700px" }}>
                <div style={{ flex: 1, position: "relative" }}>
                    <ForceGraph2D
                        ref={fgRef}
                        graphData={graphData}
                        nodeLabel={getNodeLabel}
                        nodeColor={getNodeColor}
                        nodeRelSize={networkSource === "cc" ? 2 : 3}
                        linkColor={getLinkColor}
                        backgroundColor={isDarkMode ? "#000000" : "#ffffff"}
                        onNodeClick={handleNodeClick}
                        onNodeHover={setHighlightNode}
                        cooldownTicks={100}
                        enableNodeDrag={true}
                    />
                    {highlightNode && (
                        <div style={{
                            position: "absolute",
                            top: 10,
                            left: 10,
                            background: isDarkMode ? "rgba(20, 20, 20, 0.9)" : "rgba(255, 255, 255, 0.9)",
                            color: isDarkMode ? "#eee" : "#111",
                            padding: "8px 12px",
                            borderRadius: "4px",
                            pointerEvents: "none",
                            maxWidth: "350px",
                            fontSize: "0.85rem",
                            border: isDarkMode ? "1px solid #444" : "1px solid #ccc",
                            zIndex: 10,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                        }}>
                            <strong style={{ color: colorScale[highlightNode.community] }}>{highlightNode.title}</strong>
                            <div style={{ marginTop: "4px", color: isDarkMode ? "#aaa" : "#555" }}>
                                {highlightNode.author} ({highlightNode.year})
                            </div>
                            <div style={{ marginTop: "2px", fontSize: "0.75rem", color: isDarkMode ? "#888" : "#777" }}>
                                Comm {highlightNode.community + 1} {llmLabels?.[highlightNode.community] ? `(${llmLabels[highlightNode.community]})` : ""}
                            </div>
                            {highlightNode.abstract && (
                                <div style={{ marginTop: "6px", fontSize: "0.75rem", color: isDarkMode ? "#ccc" : "#333", maxHeight: "100px", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" }}>
                                    {highlightNode.abstract}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {selectedNode && (
                    <div style={{
                        width: "320px",
                        padding: "1.5rem",
                        borderLeft: isDarkMode ? "1px solid #333" : "1px solid #ddd",
                        overflowY: "auto",
                        background: isDarkMode ? "#111" : "#fff",
                        color: isDarkMode ? "#eee" : "#111"
                    }}>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: isDarkMode ? "#fff" : "#000" }}>{selectedNode.title}</h3>
                        <div style={{ fontSize: "0.9rem", color: isDarkMode ? "#aaa" : "#555", marginBottom: "1rem" }}>
                            {selectedNode.author} • {selectedNode.year}
                        </div>

                        <div style={{ marginBottom: "1rem" }}>
                            <span className="pill" style={{ background: colorScale[selectedNode.community], color: "white", border: "none" }}>
                                Community {selectedNode.community + 1}
                                {llmLabels?.[selectedNode.community] ? <span style={{ display: "block", fontSize: "0.8em", opacity: 0.9 }}>{llmLabels[selectedNode.community]}</span> : null}
                            </span>
                            {selectedNode.subcommunity > 0 && (
                                <span className="pill" style={{ marginLeft: "0.5rem", background: isDarkMode ? "#333" : "#eee", color: isDarkMode ? "#ccc" : "#444", border: isDarkMode ? "1px solid #555" : "1px solid #ccc" }}>
                                    Sub {selectedNode.subcommunity}
                                </span>
                            )}
                        </div>

                        <div style={{ marginBottom: "1rem" }}>
                            <strong style={{ color: isDarkMode ? "#ccc" : "#444" }}>Citations:</strong> {selectedNode.citations}
                        </div>

                        <div style={{ fontSize: "0.85rem", lineHeight: "1.5", color: isDarkMode ? "#ccc" : "#333" }}>
                            <strong style={{ color: isDarkMode ? "#fff" : "#000" }}>Abstract:</strong>
                            <p style={{ marginTop: "0.4rem" }}>{selectedNode.abstract || "No abstract available."}</p>
                        </div>

                        <button
                            className="secondary-button"
                            style={{ marginTop: "1.5rem", width: "100%", background: isDarkMode ? "#333" : "#f0f0f0", color: isDarkMode ? "#fff" : "#000", border: isDarkMode ? "1px solid #555" : "1px solid #ccc" }}
                            onClick={() => setSelectedNode(null)}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunityMap;
