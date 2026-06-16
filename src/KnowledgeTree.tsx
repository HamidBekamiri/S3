
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import { API_BASE } from './api';

interface KnowledgeTreeProps {
    jobId: string;
}

interface Paper {
    Title: string;
    Authors: string;
    Year: number | string;
    Citations: number | string;
    Source: string;
    DOI: string;
    EID: string;
}

const KnowledgeTree: React.FC<KnowledgeTreeProps> = ({ jobId }) => {
    const [plotData, setPlotData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [citationScale, setCitationScale] = useState<number>(0.15);
    const [topN, setTopN] = useState<number>(20);
    const [minCitations, setMinCitations] = useState<number>(5);
    const [showSelfCitations, setShowSelfCitations] = useState<boolean>(true);
    const [linkType, setLinkType] = useState<string>("citation");
    const [zoom, setZoom] = useState<number>(1.0);

    // Modal state
    const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
    const [communityPapers, setCommunityPapers] = useState<Paper[]>([]);
    const [loadingPapers, setLoadingPapers] = useState<boolean>(false);
    const [showModal, setShowModal] = useState<boolean>(false);

    const fetchTreeData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${API_BASE}/analyze/knowledge-tree/${jobId}`, {
                citation_scale: citationScale,
                top_n_communities: topN,
                min_citations: minCitations,
                show_self_citations: showSelfCitations,
                link_type: linkType
            });
            console.log("DEBUG: Knowledge Tree Response", response.data);
            if (response.data) {
                // Parse JSON if string, or use directly if object
                const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
                setPlotData(data);
            }
        } catch (err: any) {
            console.error("Failed to fetch knowledge tree data", err);
            setError(err.response?.data?.detail || err.message || "Failed to load Knowledge Tree.");
        } finally {
            setLoading(false);
        }
    };

    const fetchCommunityPapers = async (communityId: number) => {
        setLoadingPapers(true);
        try {
            const response = await axios.post(`${API_BASE}/analyze/community-papers/${jobId}`, {
                community_id: communityId
            });
            setCommunityPapers(response.data.papers || []);
            setSelectedCommunity(communityId);
            setShowModal(true);
        } catch (err: any) {
            console.error("Failed to fetch community papers", err);
            alert("Failed to load papers for this community.");
        } finally {
            setLoadingPapers(false);
        }
    };

    const handlePlotClick = (event: any) => {
        // Extract community ID from clicked node
        if (event.points && event.points.length > 0) {
            const point = event.points[0];

            // In Sankey diagrams, nodes have labels
            // The label format from knowledge_tree.py is "C{community_id+1} ({year})"
            // We need to extract the community ID
            const label = point.label;

            if (label && typeof label === 'string') {
                // Match pattern like "1 (N=...)" or "C1 (N=...)"
                // Backend now sends 1-based IDs without "C" prefix usually, but we handle both.
                const match = label.match(/^C?(\d+)\s*[(\s]/);
                if (match) {
                    const frontendId = parseInt(match[1]);
                    // Convert to backend 0-based ID
                    const backendId = frontendId - 1;
                    console.log(`Clicked community: Frontend ID ${frontendId}, Backend ID ${backendId}`);
                    fetchCommunityPapers(backendId);
                }
            }
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedCommunity(null);
        setCommunityPapers([]);
    };

    const downloadCSV = () => {
        if (communityPapers.length === 0) return;

        // Create CSV content
        const headers = ['Title', 'Authors', 'Year', 'Citations', 'Source', 'DOI'];
        const rows = communityPapers.map(paper => [
            `"${(paper.Title || '').replace(/"/g, '""')}"`,
            `"${(paper.Authors || '').replace(/"/g, '""')}"`,
            paper.Year || '',
            paper.Citations || '',
            `"${(paper.Source || '').replace(/"/g, '""')}"`,
            paper.DOI || ''
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        // Trigger download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `community_${(selectedCommunity || 0) + 1}_papers.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    useEffect(() => {
        if (jobId) {
            fetchTreeData();
        }
    }, [jobId, citationScale, topN, minCitations, showSelfCitations, linkType]);

    return (
        <div className="knowledge-tree-container" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '10px', background: '#f8f9fa', borderRadius: '8px' }}>
                <button
                    className="secondary-button"
                    onClick={fetchTreeData}
                    disabled={loading}
                >
                    {loading ? "Loading..." : "🔄 Refresh Tree"}
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Type:</span>
                    <select
                        value={linkType}
                        onChange={(e) => setLinkType(e.target.value)}
                        style={{ padding: '2px 5px' }}
                    >
                        <option value="citation">Explicit (Citation)</option>
                        <option value="similarity">Implicit (Similarity)</option>
                    </select>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Scale:</span>
                    <input
                        type="number"
                        step="0.05"
                        min="0.01"
                        max="1.0"
                        value={citationScale}
                        onChange={(e) => setCitationScale(parseFloat(e.target.value))}
                        style={{ width: '70px' }}
                    />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Top Clusters:</span>
                    <input
                        type="number"
                        step="10"
                        min="5"
                        max="100"
                        value={topN}
                        onChange={(e) => setTopN(parseInt(e.target.value))}
                        style={{ width: '70px' }}
                    />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>Min Weight:</span>
                    <input
                        type="number"
                        step="1"
                        min="0"
                        max="50"
                        value={minCitations}
                        onChange={(e) => setMinCitations(parseInt(e.target.value))}
                        style={{ width: '70px' }}
                    />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showSelfCitations}
                        onChange={(e) => setShowSelfCitations(e.target.checked)}
                    />
                    <span>Self-Loops</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #ccc', paddingLeft: '1rem' }}>
                    <span>Zoom:</span>
                    <button className="icon-button" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} style={{ padding: '2px 8px', cursor: 'pointer' }}>-</button>
                    <span style={{ minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                    <button className="icon-button" onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} style={{ padding: '2px 8px', cursor: 'pointer' }}>+</button>
                </div>
            </div>

            {error && (
                <div className="message error">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {loading && !plotData && (
                <div className="message info">Loading Knowledge Tree (this may take a moment)...</div>
            )}

            {plotData && (
                <div style={{
                    overflow: 'auto',
                    width: '100%',
                    height: '80vh',
                    border: '1px solid #eee',
                    position: 'relative'
                }}>
                    <div style={{
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        width: '100%',
                        height: '100%',
                        minWidth: `${100 * zoom}%`,
                        minHeight: `${100 * zoom}%`
                    }}>
                        <Plot
                            data={plotData.data}
                            layout={{
                                ...plotData.layout,
                                autosize: true,
                                width: undefined,
                            }}
                            useResizeHandler={true}
                            style={{ width: "100%", height: "100%" }}
                            config={{ responsive: true, displayModeBar: true, scrollZoom: true }}
                            onClick={handlePlotClick}
                        />
                    </div>
                </div>
            )}

            {/* Modal for displaying papers */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 9999
                }} onClick={closeModal}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '8px',
                        maxWidth: '90%',
                        maxHeight: '90%',
                        overflow: 'auto',
                        position: 'relative'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2>Community {(selectedCommunity || 0) + 1} Papers ({communityPapers.length})</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="secondary-button" onClick={downloadCSV}>
                                    📥 Download CSV
                                </button>
                                <button className="secondary-button" onClick={closeModal}>
                                    ✕ Close
                                </button>
                            </div>
                        </div>

                        {loadingPapers ? (
                            <div>Loading papers...</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #ddd' }}>
                                            <th style={{ padding: '8px', textAlign: 'left', minWidth: '300px' }}>Title</th>
                                            <th style={{ padding: '8px', textAlign: 'left', minWidth: '200px' }}>Authors</th>
                                            <th style={{ padding: '8px', textAlign: 'left', width: '80px' }}>Year</th>
                                            <th style={{ padding: '8px', textAlign: 'left', width: '80px' }}>Citations</th>
                                            <th style={{ padding: '8px', textAlign: 'left', minWidth: '150px' }}>Source</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {communityPapers.map((paper, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '8px' }}>{paper.Title}</td>
                                                <td style={{ padding: '8px' }}>{paper.Authors}</td>
                                                <td style={{ padding: '8px' }}>{paper.Year}</td>
                                                <td style={{ padding: '8px' }}>{paper.Citations}</td>
                                                <td style={{ padding: '8px' }}>{paper.Source}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default KnowledgeTree;

